import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createSocialPostAction,
  updateSocialPostDraftAction,
  publishSocialPostNowAction,
  scheduleSocialPostAction,
  rescheduleSocialPostAction,
  cancelSocialPostScheduleAction,
  getSocialPostInsightsAction,
  listSocialPostsAction,
  getSocialPostAction,
} from "@/modules/socialPosts/socialPostActions";
import { installProvider, attachCredential, applyConnectionEvent, setConnectionConfig } from "@/core/integrations/integrationManager";
import { issueOAuthCredential, resetEncryptionProvider } from "@/core/integrations/credentialManager";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetSocialPostsStore } from "@/lib/data/mock/socialPostsStore";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { uploadMediaAsset, setMediaAssetStatus } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const PUBLISH_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"];
const DISCOVERY_ONLY_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic"];
const FULL_SCOPES = [...PUBLISH_SCOPES, "instagram_manage_insights"];

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["social.view", "social.create", "social.publish"],
  workspaceDisplayName: "Amoré Bloom",
};

const staffSession: MemberSessionSnapshot = { ...session, permissions: ["social.view", "social.create"] };
const noPermissionSession: MemberSessionSnapshot = { ...session, permissions: [] };
const crossTenantSession: MemberSessionSnapshot = {
  ...session,
  workspace: { id: "ws_other_tenant", name: "Other Workspace" },
  membership: { id: "member_other_ws", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

async function makeApprovedImageAsset(): Promise<string> {
  const uploaded = await uploadMediaAsset({ ownerType: "workspace", ownerId: CURRENT_WORKSPACE_ID, file: makeFile("bytes", "post.jpg", "image/jpeg"), originalFilename: "post.jpg" });
  if (!uploaded.success) throw new Error(`setup failed: ${JSON.stringify(uploaded.error)}`);
  const approved = await setMediaAssetStatus(uploaded.data.id, "approved", "member_1");
  if (!approved.success) throw new Error(`setup failed: ${JSON.stringify(approved.error)}`);
  return uploaded.data.id;
}

async function connectMetaWithSelectedIdentity(scopes: string[] = PUBLISH_SCOPES): Promise<string> {
  const connection = await installProvider({ workspaceId: CURRENT_WORKSPACE_ID, providerId: "meta", installedBy: "member_1" });
  const credential = await issueOAuthCredential({ workspaceId: CURRENT_WORKSPACE_ID, connectionId: connection.id, scopes, createdBy: "member_1", accessToken: "real-meta-access-token" });
  await attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_requested", "member_1");
  await applyConnectionEvent(connection.id, "connect_succeeded", "member_1");
  await setConnectionConfig(connection.id, { meta_page_id: "page_1", meta_page_name: "Amoré Bloom", meta_instagram_account_id: "ig_1", meta_instagram_username: "amorebloom" });
  return connection.id;
}

function stubMetaPublishSuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL) => {
      const path = input.pathname;
      if (path.endsWith("/media")) return new Response(JSON.stringify({ id: "container_123" }), { status: 200 });
      if (path.endsWith("/media_publish")) return new Response(JSON.stringify({ id: "ig_media_1" }), { status: 200 });
      return new Response(JSON.stringify({ permalink: "https://www.instagram.com/p/abc123/" }), { status: 200 });
    }),
  );
}

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  resetSocialPostsStore();
  resetMediaAssetsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("createSocialPostAction", () => {
  it("creates a draft using the workspace's own selected Meta/Instagram identity — never a caller-supplied one", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();

    const result = await createSocialPostAction({ caption: "New arrivals!", assetId });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.target_page_id).toBe("page_1");
    expect(result.data.target_instagram_account_id).toBe("ig_1");
    expect(result.data.status).toBe("draft");
  });

  it("fails when no Meta identity has been selected yet", async () => {
    const assetId = await makeApprovedImageAsset();
    const result = await createSocialPostAction({ caption: "Hi", assetId });
    expect(result.success).toBe(false);
  });

  it("denies a foreign/nonexistent asset id", async () => {
    await connectMetaWithSelectedIdentity();
    const result = await createSocialPostAction({ caption: "Hi", assetId: "asset_does_not_exist" });
    expect(result.success).toBe(false);
  });

  it("denies an unapproved (pending) asset", async () => {
    await connectMetaWithSelectedIdentity();
    const uploaded = await uploadMediaAsset({ ownerType: "workspace", ownerId: CURRENT_WORKSPACE_ID, file: makeFile("bytes", "pending.jpg", "image/jpeg"), originalFilename: "pending.jpg" });
    if (!uploaded.success) throw new Error("setup failed");

    const result = await createSocialPostAction({ caption: "Hi", assetId: uploaded.data.id });
    expect(result.success).toBe(false);
  });

  it("denies a non-JPEG asset", async () => {
    await connectMetaWithSelectedIdentity();
    const uploaded = await uploadMediaAsset({ ownerType: "workspace", ownerId: CURRENT_WORKSPACE_ID, file: makeFile("bytes", "post.png", "image/png"), originalFilename: "post.png" });
    if (!uploaded.success) throw new Error("setup failed");
    await setMediaAssetStatus(uploaded.data.id, "approved", "member_1");

    const result = await createSocialPostAction({ caption: "Hi", assetId: uploaded.data.id });
    expect(result.success).toBe(false);
  });

  it("denies a member without social.create", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await createSocialPostAction({ caption: "Hi", assetId });
    expect(result.success).toBe(false);
  });

  it("staff (social.create but not social.publish) can still create a draft", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(staffSession);
    const result = await createSocialPostAction({ caption: "Hi", assetId });
    expect(result.success).toBe(true);
  });

  it("a cross-workspace asset id is denied even if it happens to exist", async () => {
    await connectMetaWithSelectedIdentity();
    const foreignAssetId = await makeApprovedImageAsset();

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await createSocialPostAction({ caption: "Hi", assetId: foreignAssetId });
    expect(result.success).toBe(false);
  });
});

describe("updateSocialPostDraftAction", () => {
  it("edits a draft's caption/asset", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Original", assetId });
    if (!created.success) throw new Error("setup failed");

    const result = await updateSocialPostDraftAction(created.data.id, { caption: "Edited" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.caption).toBe("Edited");
  });

  it("a cross-workspace caller cannot edit another workspace's draft", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Original", assetId });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await updateSocialPostDraftAction(created.data.id, { caption: "Hijacked" });
    expect(result.success).toBe(false);
  });
});

describe("publishSocialPostNowAction", () => {
  it("publishes successfully end-to-end and persists the real provider identifiers", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Live now!", assetId });
    if (!created.success) throw new Error("setup failed");

    stubMetaPublishSuccess();
    const result = await publishSocialPostNowAction(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("published");
    expect(result.data.provider_container_id).toBe("container_123");
    expect(result.data.provider_post_id).toBe("ig_media_1");
    expect(result.data.provider_permalink).toBe("https://www.instagram.com/p/abc123/");
    expect(result.data.published_at).not.toBeNull();
  });

  it("denies a member without social.publish", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(staffSession);
    const result = await publishSocialPostNowAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("prevents double-publishing from a rapid double click", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    stubMetaPublishSuccess();

    const [first, second] = await Promise.all([publishSocialPostNowAction(created.data.id), publishSocialPostNowAction(created.data.id)]);
    const successes = [first, second].filter((r) => r.success);
    expect(successes).toHaveLength(1);
  });

  it("reports 'reconnect' truthfully (never fabricates readiness) when the connection lacks the publish scope — SOCIAL-02-era connections", async () => {
    await connectMetaWithSelectedIdentity(DISCOVERY_ONLY_SCOPES);
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    const result = await publishSocialPostNowAction(created.data.id);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/reconnect/i);

    const failed = await getSocialPostAction(created.data.id);
    expect(failed.success && failed.data.status).toBe("failed");
  });

  it("marks failed with a sanitized error, never the raw access token, when the Graph API call itself fails", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid parameter", { status: 400 })),
    );
    const result = await publishSocialPostNowAction(created.data.id);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).not.toContain("real-meta-access-token");

    const failed = await getSocialPostAction(created.data.id);
    expect(failed.success && failed.data.status).toBe("failed");
    expect(JSON.stringify(failed)).not.toContain("real-meta-access-token");
  });

  it("SOCIAL-04B — retrying a failed post that already created a container refuses to republish, to avoid a duplicate Instagram publication", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    let containerCalls = 0;
    let publishCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        const path = input.pathname;
        if (path.endsWith("/media")) {
          containerCalls += 1;
          return new Response(JSON.stringify({ id: "container_123" }), { status: 200 });
        }
        if (path.endsWith("/media_publish")) {
          publishCalls += 1;
          return new Response("temporary provider error", { status: 500 });
        }
        return new Response(JSON.stringify({ permalink: null }), { status: 200 });
      }),
    );

    const firstAttempt = await publishSocialPostNowAction(created.data.id);
    expect(firstAttempt.success).toBe(false);
    expect(containerCalls).toBe(1);
    expect(publishCalls).toBe(1);

    // SOCIAL-04A Phase 18's proven gap: the current MetaProvider abstraction
    // has no way to prove whether the first attempt's media_publish call
    // actually reached Meta before the 500 was observed — a second call
    // with the same container id risks a real duplicate Instagram post.
    // The retry must therefore refuse to call either Graph endpoint again.
    const retry = await publishSocialPostNowAction(created.data.id);
    expect(retry.success).toBe(false);
    if (!retry.success) expect(retry.error).toMatch(/manual review/i);
    expect(containerCalls).toBe(1); // never created a second container
    expect(publishCalls).toBe(1); // never attempted media_publish again

    const finalState = await getSocialPostAction(created.data.id);
    expect(finalState.success && finalState.data.status).toBe("failed");
  });

  it("a cross-workspace caller cannot publish another workspace's post", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await publishSocialPostNowAction(created.data.id);
    expect(result.success).toBe(false);
  });
});

describe("listSocialPostsAction / getSocialPostAction", () => {
  it("denies a member without social.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await listSocialPostsAction();
    expect(result.success).toBe(false);
  });

  it("a cross-workspace caller cannot read another workspace's post", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await getSocialPostAction(created.data.id);
    expect(result.success).toBe(false);
  });
});

describe("getSocialPostInsightsAction", () => {
  async function createPublishedPost(scopes: string[] = FULL_SCOPES): Promise<string> {
    await connectMetaWithSelectedIdentity(scopes);
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    stubMetaPublishSuccess();
    const published = await publishSocialPostNowAction(created.data.id);
    if (!published.success) throw new Error(`setup failed to publish: ${published.error}`);
    return created.data.id;
  }

  function stubMetaInsightsSuccess(fields: Array<{ name: string; value: number }>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: fields.map((f) => ({ name: f.name, total_value: { value: f.value } })) }), { status: 200 })),
    );
  }

  it("requires an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as unknown as MemberSessionSnapshot);
    const result = await getSocialPostInsightsAction("nonexistent");
    expect(result.success).toBe(false);
  });

  it("denies a member without social.view", async () => {
    const postId = await createPublishedPost();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(false);
  });

  it("denies an unknown post id", async () => {
    const result = await getSocialPostInsightsAction("nonexistent_post");
    expect(result.success).toBe(false);
  });

  it("a cross-workspace caller cannot read another workspace's post insights", async () => {
    const postId = await createPublishedPost();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(false);
  });

  it("reports a truthful 'not eligible' state for a draft post — never a fabricated metric", async () => {
    await connectMetaWithSelectedIdentity(FULL_SCOPES);
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    const result = await getSocialPostInsightsAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("reports a truthful 'not eligible' state for a failed post (no provider_post_id ever set)", async () => {
    await connectMetaWithSelectedIdentity(FULL_SCOPES);
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid parameter", { status: 400 })),
    );
    const publishAttempt = await publishSocialPostNowAction(created.data.id);
    expect(publishAttempt.success).toBe(false);

    const result = await getSocialPostInsightsAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("fetches real insights for an eligible published post, using the post's own persisted provider_post_id — never a client-supplied one", async () => {
    const postId = await createPublishedPost();
    const fetchMock = vi.fn(async (url: URL) => {
      void url;
      return new Response(JSON.stringify({ data: [{ name: "reach", total_value: { value: 120 } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metrics.reach).toBe(120);

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.pathname).toBe("/v26.0/ig_media_1/insights"); // the real, persisted provider_post_id from stubMetaPublishSuccess() — never the SocialPost's own id
  });

  it("distinguishes a real zero from a metric Meta did not return", async () => {
    const postId = await createPublishedPost();
    stubMetaInsightsSuccess([{ name: "likes", value: 0 }]);

    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metrics.likes).toBe(0);
    expect("reach" in result.data.metrics).toBe(false);
    expect("views" in result.data.metrics).toBe(false);
  });

  it("reports a reconnect-required state (never fabricates readiness) when the connection lacks the analytics scope — SOCIAL-02/03-era connections", async () => {
    const postId = await createPublishedPost(PUBLISH_SCOPES); // publish-only, no instagram_manage_insights
    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Reconnect Meta to enable Instagram analytics.");
  });

  it("reports a reconnect-required state on a Meta auth/token failure", async () => {
    const postId = await createPublishedPost();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 })),
    );
    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Reconnect Meta to enable Instagram analytics.");
  });

  it("reports a distinct, truthful rate-limit state — never a generic error", async () => {
    const postId = await createPublishedPost();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#32) Page request limit reached", type: "OAuthException", code: 32 } }), { status: 400 })),
    );
    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Instagram is rate-limiting requests right now. Try again in a few minutes.");
  });

  it("reports a sanitized error, never the raw access token, on a generic provider failure", async () => {
    const postId = await createPublishedPost();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid parameter", { status: 400 })),
    );
    const result = await getSocialPostInsightsAction(postId);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).not.toContain("real-meta-access-token");
  });

  it("makes exactly one bounded provider request per call — never a bulk/multi-post fetch", async () => {
    const postId = await createPublishedPost();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [{ name: "reach", total_value: { value: 5 } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getSocialPostInsightsAction(postId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

const FUTURE_ISO = "2099-01-01T12:00:00.000Z";

describe("scheduleSocialPostAction", () => {
  it("schedules a draft post with a valid future instant and timezone", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    const result = await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: "America/New_York" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("scheduled");
    expect(result.data.scheduled_at).toBe(FUTURE_ISO);
    expect(result.data.scheduled_timezone).toBe("America/New_York");
  });

  it("rejects a past or invalid scheduled_at", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    const past = await scheduleSocialPostAction(created.data.id, { scheduledAt: "2020-01-01T00:00:00.000Z", scheduledTimezone: null });
    expect(past.success).toBe(false);

    const invalid = await scheduleSocialPostAction(created.data.id, { scheduledAt: "not-a-date", scheduledTimezone: null });
    expect(invalid.success).toBe(false);
  });

  it("rejects an unrecognized timezone identifier", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    const result = await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: "Not/A_Real_Zone" });
    expect(result.success).toBe(false);
  });

  it("SOCIAL-04A Phase 25 — a member with social.create but not social.publish cannot schedule (schedule authorizes an eventual unattended publish, so it requires the stricter permission)", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(staffSession);
    const result = await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });
    expect(result.success).toBe(false);
  });

  it("re-validates the asset is still an approved image at schedule time", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    await setMediaAssetStatus(assetId, "pending", "member_1");

    const result = await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });
    expect(result.success).toBe(false);
  });

  it("never generates or stores a signed asset URL when scheduling", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    const result = await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });
    expect(JSON.stringify(result)).not.toMatch(/signed|token=/i);
  });

  it("a cross-workspace caller cannot schedule another workspace's post", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });
    expect(result.success).toBe(false);
  });
});

describe("rescheduleSocialPostAction / cancelSocialPostScheduleAction", () => {
  it("reschedules a still-scheduled post", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });

    const laterIso = "2099-02-01T12:00:00.000Z";
    const result = await rescheduleSocialPostAction(created.data.id, { scheduledAt: laterIso, scheduledTimezone: "UTC" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scheduled_at).toBe(laterIso);
  });

  it("cannot reschedule once claimed for publishing", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });
    stubMetaPublishSuccess();
    await publishSocialPostNowAction(created.data.id);

    const result = await rescheduleSocialPostAction(created.data.id, { scheduledAt: "2099-02-01T12:00:00.000Z", scheduledTimezone: null });
    expect(result.success).toBe(false);
  });

  it("cancels a schedule back to draft, preserving caption/asset/destination", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Keep this caption.", assetId });
    if (!created.success) throw new Error("setup failed");
    await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });

    const result = await cancelSocialPostScheduleAction(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.caption).toBe("Keep this caption.");
    expect(result.data.asset_id).toBe(assetId);
  });

  it("cannot cancel once the worker has claimed the post", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });
    stubMetaPublishSuccess();
    await publishSocialPostNowAction(created.data.id);

    const result = await cancelSocialPostScheduleAction(created.data.id);
    expect(result.success).toBe(false);
  });
});

describe("SOCIAL-04B — manual Publish Now on a scheduled post", () => {
  it("publishes a scheduled post immediately via the same claim/execution path as a draft", async () => {
    await connectMetaWithSelectedIdentity();
    const assetId = await makeApprovedImageAsset();
    const created = await createSocialPostAction({ caption: "Hi", assetId });
    if (!created.success) throw new Error("setup failed");
    await scheduleSocialPostAction(created.data.id, { scheduledAt: FUTURE_ISO, scheduledTimezone: null });
    stubMetaPublishSuccess();

    const result = await publishSocialPostNowAction(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("published");
  });
});
