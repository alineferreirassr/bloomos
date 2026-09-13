import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createScriptItemAction,
  updateScriptItemAction,
  getScriptItemAction,
  listScriptItemsAction,
  archiveScriptItemAction,
  unarchiveScriptItemAction,
  createScriptVersionAction,
  getScriptVersionAction,
  listScriptVersionsAction,
  createScriptBlockAction,
  listScriptBlocksAction,
  updateScriptBlockAction,
  type ScriptItemActionInput,
} from "@/modules/script/scriptActions";
import { resetScriptItemsStore } from "@/lib/data/mock/scriptItemsStore";
import { resetScriptVersionsStore } from "@/lib/data/mock/scriptVersionsStore";
import { resetScriptBlocksStore } from "@/lib/data/mock/scriptBlocksStore";
import { resetIdeaItemsStore } from "@/lib/data/mock/ideaItemsStore";
import { createIdeaItem } from "@/lib/data";
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

function baseInput(overrides: Partial<ScriptItemActionInput> = {}): ScriptItemActionInput {
  return {
    title: "Spring wedding behind-the-scenes",
    source_idea_id: null,
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

beforeEach(() => {
  resetScriptItemsStore();
  resetScriptVersionsStore();
  resetScriptBlocksStore();
  resetIdeaItemsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Script actions — access control", () => {
  it("createScriptItemAction requires social.create", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await createScriptItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("createScriptItemAction denies a member with no permissions at all", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await createScriptItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("listScriptItemsAction requires social.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await listScriptItemsAction();
    expect(result.success).toBe(false);
  });

  it("listScriptItemsAction succeeds for a view-only member (read, not write)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await listScriptItemsAction();
    expect(result.success).toBe(true);
  });

  it("denies an unauthenticated/inactive session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as never);
    const result = await createScriptItemAction(baseInput());
    expect(result.success).toBe(false);
  });

  it("archiveScriptItemAction and unarchiveScriptItemAction require social.create", async () => {
    const created = await createScriptItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const archived = await archiveScriptItemAction(created.data.id);
    expect(archived.success).toBe(false);
    const unarchived = await unarchiveScriptItemAction(created.data.id);
    expect(unarchived.success).toBe(false);
  });

  it("never uses social.publish for any Script action", async () => {
    const publishOnlySession: MemberSessionSnapshot = { ...session, permissions: ["social.publish"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(publishOnlySession);
    const createResult = await createScriptItemAction(baseInput());
    expect(createResult.success).toBe(false);
    const listResult = await listScriptItemsAction();
    expect(listResult.success).toBe(false);
  });
});

describe("Script actions — workspace and actor derivation", () => {
  it("derives workspace_id from the session, never from caller input", async () => {
    const result = await createScriptItemAction({ ...baseInput(), workspace_id: "attacker_workspace" } as never);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspace_id).toBe(CURRENT_WORKSPACE_ID);
  });

  it("stores created_by as the session's own auth user UUID", async () => {
    const result = await createScriptItemAction(baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe(ACTOR_ID);
  });
});

describe("Script actions — create validation", () => {
  it("rejects an empty/blank title", async () => {
    const result = await createScriptItemAction(baseInput({ title: "   " }));
    expect(result.success).toBe(false);
  });

  it("does not impose any title uniqueness — two Scripts may share a title", async () => {
    const first = await createScriptItemAction(baseInput({ title: "Same title" }));
    const second = await createScriptItemAction(baseInput({ title: "Same title" }));
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });

  it("stores plain text verbatim — no HTML execution, no dangerouslySetInnerHTML assumptions", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    const result = await createScriptItemAction(baseInput({ title: payload }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe(payload);
  });
});

describe("Script actions — Idea reference validation", () => {
  it("accepts a source_idea_id belonging to the caller's own workspace", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const result = await createScriptItemAction(baseInput({ source_idea_id: ideaId }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_idea_id).toBe(ideaId);
  });

  it("rejects a source_idea_id belonging to a different workspace", async () => {
    const ideaId = await seedIdeaItem(OTHER_WORKSPACE);
    const result = await createScriptItemAction(baseInput({ source_idea_id: ideaId }));
    expect(result.success).toBe(false);
  });

  it("rejects a source_idea_id that does not exist at all", async () => {
    const result = await createScriptItemAction(baseInput({ source_idea_id: "does_not_exist" }));
    expect(result.success).toBe(false);
  });

  it("never copies the referenced Idea's own content onto the Script", async () => {
    const ideaId = await seedIdeaItem(CURRENT_WORKSPACE_ID);
    const result = await createScriptItemAction(baseInput({ source_idea_id: ideaId, title: "My own original title" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("My own original title");
  });

  it("revalidates ownership when source_idea_id changes on update", async () => {
    const created = await createScriptItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");
    const otherIdeaId = await seedIdeaItem(OTHER_WORKSPACE);

    const updated = await updateScriptItemAction(created.data.id, { source_idea_id: otherIdeaId });
    expect(updated.success).toBe(false);
  });

  it("normalizes an empty-string source_idea_id to null rather than persisting an unvalidated non-null reference", async () => {
    const result = await createScriptItemAction(baseInput({ source_idea_id: "" as never }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_idea_id).toBeNull();
  });
});

describe("Script actions — cross-workspace isolation", () => {
  it("updateScriptItemAction rejects an item owned by a different workspace", async () => {
    const created = await createScriptItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await updateScriptItemAction(created.data.id, { title: "Hijacked" });
    expect(result.success).toBe(false);
  });

  it("archiveScriptItemAction rejects an item owned by a different workspace", async () => {
    const created = await createScriptItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await archiveScriptItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("unarchiveScriptItemAction rejects an item owned by a different workspace", async () => {
    const created = await createScriptItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await unarchiveScriptItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("getScriptItemAction never leaks a different workspace's item", async () => {
    const created = await createScriptItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await getScriptItemAction(created.data.id);
    expect(result.success).toBe(false);
  });

  it("listScriptItemsAction never returns another workspace's items", async () => {
    await createScriptItemAction(baseInput({ title: "Mine" }));

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await listScriptItemsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });
});

describe("Script actions — update / archive / unarchive lifecycle", () => {
  it("updates only the provided fields", async () => {
    const created = await createScriptItemAction(baseInput({ title: "Original" }));
    if (!created.success) throw new Error("setup failed");

    const updated = await updateScriptItemAction(created.data.id, { title: "Updated" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Updated");
  });

  it("returns not-found when updating an id that does not exist", async () => {
    const result = await updateScriptItemAction("nope", { title: "X" });
    expect(result.success).toBe(false);
  });

  it("archives then unarchives an item — never deletes it, reversible", async () => {
    const created = await createScriptItemAction(baseInput());
    if (!created.success) throw new Error("setup failed");

    const archived = await archiveScriptItemAction(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.status).toBe("archived");
      expect(archived.data.archived_at).not.toBeNull();
    }

    const unarchived = await unarchiveScriptItemAction(created.data.id);
    expect(unarchived.success).toBe(true);
    if (unarchived.success) {
      expect(unarchived.data.status).toBe("active");
      expect(unarchived.data.archived_at).toBeNull();
    }
  });

  it("listScriptItemsAction excludes archived items by default", async () => {
    const created = await createScriptItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveScriptItemAction(created.data.id);

    const result = await listScriptItemsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(0);
  });

  it("rejects an update against an archived item — restore it first", async () => {
    const created = await createScriptItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveScriptItemAction(created.data.id);

    const result = await updateScriptItemAction(created.data.id, { title: "Should not apply" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/restore it first/i);
  });

  it("allows a normal edit again once the item is restored", async () => {
    const created = await createScriptItemAction(baseInput({ title: "Will archive" }));
    if (!created.success) throw new Error("setup failed");
    await archiveScriptItemAction(created.data.id);
    await unarchiveScriptItemAction(created.data.id);

    const result = await updateScriptItemAction(created.data.id, { title: "Updated after restore" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Updated after restore");
  });
});

describe("Script actions — version lifecycle", () => {
  it("createScriptVersionAction creates the one draft for a Script", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");

    const version = await createScriptVersionAction(script.data.id);
    expect(version.success).toBe(true);
    if (!version.success) return;
    expect(version.data.status).toBe("draft");
    expect(version.data.script_id).toBe(script.data.id);
  });

  it("rejects a second draft for the same Script with a controlled error", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");
    await createScriptVersionAction(script.data.id);

    const second = await createScriptVersionAction(script.data.id);
    expect(second.success).toBe(false);
  });

  it("createScriptVersionAction requires social.create", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await createScriptVersionAction(script.data.id);
    expect(result.success).toBe(false);
  });

  it("rejects creating a version for a Script owned by a different workspace", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await createScriptVersionAction(script.data.id);
    expect(result.success).toBe(false);
  });

  it("rejects creating a version for an archived Script — matches the 'restore it first' precedent", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");
    await archiveScriptItemAction(script.data.id);

    const result = await createScriptVersionAction(script.data.id);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/restore it first/i);
  });

  it("getScriptVersionAction never leaks a version owned by a different workspace", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");
    const version = await createScriptVersionAction(script.data.id);
    if (!version.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await getScriptVersionAction(version.data.id);
    expect(result.success).toBe(false);
  });

  it("listScriptVersionsAction lists only this Script's own versions", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");
    const version = await createScriptVersionAction(script.data.id);
    if (!version.success) throw new Error("setup failed");

    const result = await listScriptVersionsAction(script.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((v) => v.id)).toEqual([version.data.id]);
  });

  it("listScriptVersionsAction rejects a scriptId owned by a different workspace, never leaking its versions", async () => {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");
    await createScriptVersionAction(script.data.id);

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await listScriptVersionsAction(script.data.id);
    expect(result.success).toBe(false);
  });
});

describe("Script actions — block lifecycle", () => {
  async function setupVersion(): Promise<string> {
    const script = await createScriptItemAction(baseInput());
    if (!script.success) throw new Error("setup failed");
    const version = await createScriptVersionAction(script.data.id);
    if (!version.success) throw new Error("setup failed");
    return version.data.id;
  }

  it("createScriptBlockAction creates a block with the provided content and sort_order", async () => {
    const versionId = await setupVersion();
    const result = await createScriptBlockAction(versionId, { content: "Open on a wide shot.", sort_order: 0 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe("Open on a wide shot.");
    expect(result.data.sort_order).toBe(0);
  });

  it("createScriptBlockAction requires social.create", async () => {
    const versionId = await setupVersion();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await createScriptBlockAction(versionId, { content: "X", sort_order: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects creating a block for a scriptVersionId owned by a different workspace", async () => {
    const versionId = await setupVersion();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await createScriptBlockAction(versionId, { content: "X", sort_order: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects creating a block for a scriptVersionId that does not exist", async () => {
    const result = await createScriptBlockAction("does_not_exist", { content: "X", sort_order: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts an empty-string content block — a valid in-progress state", async () => {
    const versionId = await setupVersion();
    const result = await createScriptBlockAction(versionId, { content: "", sort_order: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative sort_order", async () => {
    const versionId = await setupVersion();
    const result = await createScriptBlockAction(versionId, { content: "X", sort_order: -1 });
    expect(result.success).toBe(false);
  });

  it("listScriptBlocksAction lists blocks ordered by sort_order ascending", async () => {
    const versionId = await setupVersion();
    await createScriptBlockAction(versionId, { content: "Second", sort_order: 1 });
    await createScriptBlockAction(versionId, { content: "First", sort_order: 0 });

    const result = await listScriptBlocksAction(versionId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((b) => b.content)).toEqual(["First", "Second"]);
  });

  it("listScriptBlocksAction rejects a scriptVersionId owned by a different workspace, never leaking its blocks", async () => {
    const versionId = await setupVersion();
    await createScriptBlockAction(versionId, { content: "Mine", sort_order: 0 });

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await listScriptBlocksAction(versionId);
    expect(result.success).toBe(false);
  });

  it("updateScriptBlockAction updates content and sort_order", async () => {
    const versionId = await setupVersion();
    const created = await createScriptBlockAction(versionId, { content: "Original", sort_order: 0 });
    if (!created.success) throw new Error("setup failed");

    const updated = await updateScriptBlockAction(versionId, created.data.id, { content: "Revised" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.content).toBe("Revised");
  });

  it("updateScriptBlockAction requires social.create", async () => {
    const versionId = await setupVersion();
    const created = await createScriptBlockAction(versionId, { content: "Original", sort_order: 0 });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);
    const result = await updateScriptBlockAction(versionId, created.data.id, { content: "Revised" });
    expect(result.success).toBe(false);
  });

  it("updateScriptBlockAction rejects a scriptVersionId owned by a different workspace, even with a valid block id", async () => {
    const versionId = await setupVersion();
    const created = await createScriptBlockAction(versionId, { content: "Original", sort_order: 0 });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceSession);
    const result = await updateScriptBlockAction(versionId, created.data.id, { content: "Hijacked" });
    expect(result.success).toBe(false);
  });

  it("updateScriptBlockAction returns not-found for a block id that does not belong to the given version", async () => {
    const versionId = await setupVersion();
    const result = await updateScriptBlockAction(versionId, "does_not_exist", { content: "X" });
    expect(result.success).toBe(false);
  });

  it("stores plain text verbatim — no HTML execution", async () => {
    const versionId = await setupVersion();
    const payload = "<img src=x onerror=alert(1)>";
    const result = await createScriptBlockAction(versionId, { content: payload, sort_order: 0 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe(payload);
  });
});
