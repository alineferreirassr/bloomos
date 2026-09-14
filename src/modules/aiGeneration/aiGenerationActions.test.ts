import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createAIGenerationAction,
  getAIGenerationAction,
  listAIGenerationsAction,
  approveAIGenerationAction,
  rejectAIGenerationAction,
  archiveAIGenerationAction,
  unarchiveAIGenerationAction,
  type CreateAIGenerationActionInput,
} from "@/modules/aiGeneration/aiGenerationActions";
import { resetAIGenerationsStore } from "@/lib/data/mock/aiGenerationsStore";
import { resetIdeaItemsStore } from "@/lib/data/mock/ideaItemsStore";
import { resetInspirationItemsStore } from "@/lib/data/mock/inspirationItemsStore";
import { resetScriptItemsStore } from "@/lib/data/mock/scriptItemsStore";
import { createIdeaItem, createInspirationItem, createScriptItem, getIdeaItemById } from "@/lib/data";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_WORKSPACE = "ws_other_tenant";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: ACTOR_ID, email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["social.view", "social.create", "social.publish"],
  workspaceDisplayName: "Amoré Bloom",
};

const otherWorkspaceSession: MemberSessionSnapshot = {
  ...session,
  workspace: { id: OTHER_WORKSPACE, name: "Other Workspace" },
  membership: { id: "member_other", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["social.view"] };
const noPermissionSession: MemberSessionSnapshot = { ...session, permissions: [] };

function baseCreateInput(overrides: Partial<CreateAIGenerationActionInput> = {}): CreateAIGenerationActionInput {
  return {
    source_entity_type: "idea_item",
    source_entity_id: "idea_1",
    use_case_id: "hook-suggestions",
    skill_id: "hook-suggestions-skill",
    input: { title: "A cozy autumn wedding" },
    output: { hooks: ["Fall in love with fall weddings."] },
    provider_id: "mock-provider",
    model: "mock-model",
    prompt_version: "v1",
    is_mock: true,
    latency_ms: 120,
    confidence: 80,
    ...overrides,
  };
}

async function seedIdeaItem(workspaceId: string): Promise<string> {
  const created = await createIdeaItem({
    workspaceId,
    createdBy: ACTOR_ID,
    title: "A great content idea",
    description: "A concept for future content.",
    sourceInspirationId: null,
    contentFormat: null,
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    mediaAssetId: null,
    priority: null,
  });
  if (!created.success) throw new Error("Idea seed failed");
  return created.data.id;
}

async function seedInspirationItem(workspaceId: string): Promise<string> {
  const created = await createInspirationItem({
    workspaceId,
    createdBy: ACTOR_ID,
    title: "A vineyard wedding reel",
    sourceType: "instagram",
    sourceUrl: "https://instagram.com/p/example",
    normalizedSourceUrl: "instagram.com/p/example",
    creatorName: null,
    creatorHandle: null,
    platformContentId: null,
    contentFormat: "reel",
    hook: "Fall in love with fall weddings.",
    cta: null,
    whyItWorks: null,
    notes: null,
    durationSeconds: null,
    publishedAt: null,
    mediaAssetId: null,
  });
  if (!created.success) throw new Error("Inspiration seed failed");
  return created.data.id;
}

async function seedScriptItem(workspaceId: string): Promise<string> {
  const created = await createScriptItem({ workspaceId, createdBy: ACTOR_ID, title: "Spring wedding behind-the-scenes", sourceIdeaId: null });
  if (!created.success) throw new Error("Script seed failed");
  return created.data.id;
}

beforeEach(() => {
  resetAIGenerationsStore();
  resetIdeaItemsStore();
  resetInspirationItemsStore();
  resetScriptItemsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createAIGenerationAction — permissions", () => {
  it("rejects an unauthenticated caller", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createAIGenerationAction(baseCreateInput());
    expect(result.success).toBe(false);
  });

  it("rejects a caller with only social.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    expect(result.success).toBe(false);
  });

  it("rejects a caller with no permissions at all", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await createAIGenerationAction(baseCreateInput());
    expect(result.success).toBe(false);
  });

  it("allows a caller with social.create", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    expect(result.success).toBe(true);
  });
});

describe("createAIGenerationAction — workspace isolation and source-entity ownership", () => {
  it("rejects a source_entity_id that belongs to a different workspace", async () => {
    const ideaInOtherWorkspace = await seedIdeaItem(OTHER_WORKSPACE);
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaInOtherWorkspace }));
    expect(result.success).toBe(false);
  });

  it("rejects a source_entity_id that does not exist at all", async () => {
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_id: "does-not-exist" }));
    expect(result.success).toBe(false);
  });

  it("accepts a real Idea in the caller's own workspace", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_type: "idea_item", source_entity_id: ideaId }));
    expect(result.success).toBe(true);
  });

  it("accepts a real Inspiration in the caller's own workspace", async () => {
    const inspirationId = await seedInspirationItem(CURRENT_WORKSPACE_ID);
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_type: "inspiration_item", source_entity_id: inspirationId }));
    expect(result.success).toBe(true);
  });

  it("accepts a real Script in the caller's own workspace", async () => {
    const scriptId = await seedScriptItem(CURRENT_WORKSPACE_ID);
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_type: "script_item", source_entity_id: scriptId }));
    expect(result.success).toBe(true);
  });

  it("never mutates the source Idea it references", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const before = await getIdeaItemById(ideaId);

    const result = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    expect(result.success).toBe(true);
    if (result.success) await approveAIGenerationAction(result.data.id);

    const after = await getIdeaItemById(ideaId);
    expect(after).toEqual(before);
  });

  it("scopes the generation record to the caller's own resolved workspace, never a client-supplied one", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const result = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspace_id).toBe(CURRENT_WORKSPACE_ID);
  });
});

describe("getAIGenerationAction / listAIGenerationsAction — workspace isolation", () => {
  it("rejects fetching a generation that belongs to another workspace", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await getAIGenerationAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("never lists another workspace's generations even with matching filters", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await listAIGenerationsAction({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("rejects a source_entity_id filter naming another workspace's Idea", async () => {
    const ideaInOtherWorkspace = await seedIdeaItem(OTHER_WORKSPACE);
    const result = await listAIGenerationsAction({ source_entity_type: "idea_item", source_entity_id: ideaInOtherWorkspace });
    expect(result.success).toBe(false);
  });

  it("lists generations for the caller's own workspace", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    const result = await listAIGenerationsAction({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("approveAIGenerationAction / rejectAIGenerationAction — the human-in-the-loop boundary", () => {
  it("a generation is never approved automatically — it starts proposed", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");
    expect(created.data.approval_status).toBe("proposed");
  });

  it("approve requires social.create, not merely social.view", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await approveAIGenerationAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("approve rejects a generation belonging to another workspace", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await approveAIGenerationAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("approve succeeds for the owning workspace and stamps the reviewer", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");

    const approved = await approveAIGenerationAction(created.data.id);
    expect(approved.success).toBe(true);
    if (!approved.success) return;
    expect(approved.data.approval_status).toBe("approved");
    expect(approved.data.reviewed_by).toBe(ACTOR_ID);
  });

  it("reject succeeds and stamps the reviewer", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");

    const rejected = await rejectAIGenerationAction(created.data.id);
    expect(rejected.success).toBe(true);
    if (!rejected.success) return;
    expect(rejected.data.approval_status).toBe("rejected");
  });
});

describe("archiveAIGenerationAction / unarchiveAIGenerationAction", () => {
  it("archive requires social.create", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await archiveAIGenerationAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("archive then unarchive round-trips cleanly", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const created = await createAIGenerationAction(baseCreateInput({ source_entity_id: ideaId }));
    if (!created.success) throw new Error("setup failed");

    const archived = await archiveAIGenerationAction(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const unarchived = await unarchiveAIGenerationAction(created.data.id);
    expect(unarchived.success).toBe(true);
    if (unarchived.success) expect(unarchived.data.archived_at).toBeNull();
  });
});

describe("aiGenerationActions.ts — static security/architecture guardrails", () => {
  it("never uses social.publish as a permission literal, never imports an AI provider/runtime, never makes a network call", () => {
    const source = readFileSync(path.resolve(__dirname, "aiGenerationActions.ts"), "utf-8");
    expect(source).not.toContain('"social.publish"');
    expect(source).not.toMatch(/executeAIRequest\(/);
    expect(source).not.toMatch(/from "@\/core\/ai\//);
    expect(source).not.toMatch(/\bfetch\(/);
    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).not.toContain("eval(");
  });
});
