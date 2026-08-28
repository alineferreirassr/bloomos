import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMyFounderNotesAction, createFounderNoteAction } from "@/modules/dashboard/founderNoteActions";
import { resetAllMockData } from "@/lib/data";

const activeSession = {
  kind: "active" as const,
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Aline Ferreira", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner" as const, status: "active" as const, created_at: "2026-01-01T00:00:00Z" },
  permissions: [],
  workspaceDisplayName: "Amoré Bloom",
};

beforeEach(() => {
  resetAllMockData();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("founderNoteActions", () => {
  it("AUTHOR can create and read back their own note", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);

    const created = await createFounderNoteAction("Could use an extra hand at Saturday's setup.");
    expect(created.success).toBe(true);

    const mine = await getMyFounderNotesAction();
    expect(mine).toHaveLength(1);
    expect(mine[0].body).toBe("Could use an extra hand at Saturday's setup.");
  });

  it("rejects an empty note", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createFounderNoteAction("   ");
    expect(result.success).toBe(false);
  });

  it("blocks an unauthenticated caller", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    expect(await getMyFounderNotesAction()).toEqual([]);
    const result = await createFounderNoteAction("Hello Aline");
    expect(result.success).toBe(false);
  });

  it("createFounderNoteAction's only input is free text — no mood/water parameter exists to attach", () => {
    expect(createFounderNoteAction.length).toBe(1);
  });
});
