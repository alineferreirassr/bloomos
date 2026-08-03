import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  listWorkspaceRelationshipsAction,
  getNodeRelationshipsAction,
  createRelationshipAction,
  removeRelationshipAction,
  setRelationshipSemanticsAction,
  getGraphStatsAction,
  getKnowledgeHealthAction,
  findShortestPathAction,
  getBloomAiKnowledgeContextAction,
} from "@/modules/knowledgeGraph/knowledgeGraphActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetMediaAssetsStore, writeMediaAssets } from "@/lib/data/mock/mediaAssetsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import type { MediaAsset } from "@/types/mediaAsset";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["assets.view", "assets.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

beforeEach(() => {
  resetKnowledgeGraphStore();
  resetMediaAssetsStore();
  resetTimelineStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetKnowledgeGraphStore();
  resetMediaAssetsStore();
  resetTimelineStore();
});

describe("createRelationshipAction / listWorkspaceRelationshipsAction", () => {
  it("creates a relationship scoped to the caller's workspace", async () => {
    const result = await createRelationshipAction(
      { nodeType: "media_asset", nodeId: "asset_1" },
      { nodeType: "event", nodeId: "event_1" },
      "belongs_to",
    );
    expect(result.success).toBe(true);

    const list = await listWorkspaceRelationshipsAction();
    expect(list.success && list.data).toHaveLength(1);
  });

  it("blocks a self-relationship before it reaches the store", async () => {
    const node = { nodeType: "media_asset" as const, nodeId: "asset_1" };
    const result = await createRelationshipAction(node, node, "related_to");
    expect(result.success).toBe(false);
  });

  it("hard-blocks a constraint violation (a second Proposal on an Invoice)", async () => {
    await createRelationshipAction({ nodeType: "invoice", nodeId: "invoice_1" }, { nodeType: "proposal", nodeId: "proposal_1" }, "belongs_to");
    const second = await createRelationshipAction({ nodeType: "invoice", nodeId: "invoice_1" }, { nodeType: "proposal", nodeId: "proposal_2" }, "belongs_to");
    expect(second.success).toBe(false);
  });
});

describe("getNodeRelationshipsAction", () => {
  it("returns hops, counts, constraint violations, and impact for a node", async () => {
    await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "belongs_to");
    const result = await getNodeRelationshipsAction({ nodeType: "media_asset", nodeId: "asset_1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.counts.outbound).toBe(1);
    expect(result.data.oneHop).toHaveLength(1);
    expect(result.data.impact.base.isSafeToDelete).toBe(true);
  });
});

describe("removeRelationshipAction / setRelationshipSemanticsAction", () => {
  it("removes and then re-lists without the relationship", async () => {
    const created = await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "belongs_to");
    if (!created.success) throw new Error("setup failed");
    const relId = (created.data as { id: string }).id;

    await removeRelationshipAction(relId);
    const list = await listWorkspaceRelationshipsAction();
    expect(list.success && list.data).toHaveLength(0);
  });

  it("assigns semantics to an existing relationship", async () => {
    const created = await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "used_by");
    if (!created.success) throw new Error("setup failed");
    const relId = (created.data as { id: string }).id;

    const updated = await setRelationshipSemanticsAction(relId, {
      role: "hero_image",
      businessMeaning: null,
      category: "marketing",
      importance: "high",
      priority: "normal",
      lifecycle: "active",
      visibility: "client",
      ownerMemberId: null,
      businessContext: null,
    });
    expect(updated.success).toBe(true);
    if (updated.success) expect((updated.data as { semantics: { role: string } }).semantics.role).toBe("hero_image");
  });
});

describe("getGraphStatsAction", () => {
  it("counts active relationships by type and node type", async () => {
    await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "belongs_to");
    const stats = await getGraphStatsAction();
    expect(stats.success).toBe(true);
    if (!stats.success) return;
    expect(stats.data.totalActive).toBe(1);
    expect(stats.data.byRelationshipType.belongs_to).toBe(1);
    expect(stats.data.byNodeType.media_asset).toBe(1);
    expect(stats.data.byNodeType.event).toBe(1);
  });
});

describe("getKnowledgeHealthAction", () => {
  function makeAsset(overrides: Partial<MediaAsset> & Pick<MediaAsset, "id">): MediaAsset {
    return {
      workspace_id: "ws_1",
      owner_type: "event",
      owner_id: "event_1",
      original_filename: `${overrides.id}.jpg`,
      stored_filename: `${overrides.id}.jpg`,
      storage_bucket: "media-assets",
      storage_path: `ws_1/event/event_1/${overrides.id}/1/${overrides.id}.jpg`,
      mime_type: "image/jpeg",
      extension: "jpg",
      file_size: 100,
      checksum: "abc",
      width: null,
      height: null,
      duration: null,
      version: 1,
      uploaded_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      archived_at: null,
      folder_id: null,
      tags: [],
      color_label: null,
      priority: null,
      ai_ready: false,
      status: "pending",
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      version_notes: null,
      metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
      ...overrides,
    };
  }

  it("flags an asset with no relationships", async () => {
    writeMediaAssets([makeAsset({ id: "asset_1" })]);
    const result = await getKnowledgeHealthAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.orphanedAssets.some((f) => f.reason === "no_relationships")).toBe(true);
  });
});

describe("findShortestPathAction", () => {
  it("finds a path across two hops", async () => {
    await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "belongs_to");
    await createRelationshipAction({ nodeType: "event", nodeId: "event_1" }, { nodeType: "client", nodeId: "client_1" }, "associated_with_client");

    const result = await findShortestPathAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "client", nodeId: "client_1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.nodes.map((n) => n.nodeId)).toEqual(["asset_1", "event_1", "client_1"]);
  });
});

describe("Step 13 — Timeline Integration", () => {
  it("records a knowledge_relationship_created activity against the Timeline-capable endpoint", async () => {
    await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "belongs_to");
    const activities = readActivities().filter((a) => a.type === "knowledge_relationship_created");
    expect(activities).toHaveLength(1);
    expect(activities[0].owner_type).toBe("media_asset");
    expect(activities[0].owner_id).toBe("asset_1");
  });

  it("records a knowledge_relationship_removed activity", async () => {
    const created = await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "belongs_to");
    if (!created.success) throw new Error("setup failed");
    await removeRelationshipAction((created.data as { id: string }).id);
    expect(readActivities().filter((a) => a.type === "knowledge_relationship_removed")).toHaveLength(1);
  });

  it("records a knowledge_relationship_semantics_updated activity", async () => {
    const created = await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "used_by");
    if (!created.success) throw new Error("setup failed");
    await setRelationshipSemanticsAction((created.data as { id: string }).id, {
      role: "hero_image",
      businessMeaning: null,
      category: "marketing",
      importance: "high",
      priority: "normal",
      lifecycle: "active",
      visibility: "client",
      ownerMemberId: null,
      businessContext: null,
    });
    expect(readActivities().filter((a) => a.type === "knowledge_relationship_semantics_updated")).toHaveLength(1);
  });

  it("records a knowledge_relationship_constraint_violated activity when a mutation is blocked", async () => {
    await createRelationshipAction({ nodeType: "invoice", nodeId: "invoice_1" }, { nodeType: "proposal", nodeId: "proposal_1" }, "belongs_to");
    await createRelationshipAction({ nodeType: "invoice", nodeId: "invoice_1" }, { nodeType: "proposal", nodeId: "proposal_2" }, "belongs_to");
    expect(readActivities().filter((a) => a.type === "knowledge_relationship_constraint_violated")).toHaveLength(1);
  });

  it("skips Timeline recording when neither endpoint is a Timeline-capable EntityType", async () => {
    await createRelationshipAction({ nodeType: "comment", nodeId: "comment_1" }, { nodeType: "workflow", nodeId: "workflow_1" }, "commented_on");
    expect(readActivities().filter((a) => a.type === "knowledge_relationship_created")).toHaveLength(0);
  });
});

describe("Step 14 — getBloomAiKnowledgeContextAction", () => {
  it("returns all seven deterministic context fields", async () => {
    await createRelationshipAction({ nodeType: "media_asset", nodeId: "asset_1" }, { nodeType: "event", nodeId: "event_1" }, "belongs_to");
    const result = await getBloomAiKnowledgeContextAction({ nodeType: "media_asset", nodeId: "asset_1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.entityContext).toContain("Belongs To");
    expect(result.data.relationshipContext).toContain("1 relationship");
    expect(result.data.semanticContext).toContain("No business meaning");
    expect(result.data.timelineContext).toContain("Recent activity");
  });
});
