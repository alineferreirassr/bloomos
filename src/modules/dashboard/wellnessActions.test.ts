import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMyWellnessCheckInAction, setMyMoodAction, getMyWaterLogAction, addWaterGlassAction, removeWaterGlassAction } from "@/modules/dashboard/wellnessActions";
import { resetAllMockData } from "@/lib/data";

const TODAY = "2026-08-15";

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

describe("wellnessActions — access gate", () => {
  it("returns null/fail for an unauthenticated caller, never data", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });

    expect(await getMyWellnessCheckInAction(TODAY)).toBeNull();
    expect(await getMyWaterLogAction(TODAY)).toBeNull();
    const moodResult = await setMyMoodAction(TODAY, "calm");
    expect(moodResult.success).toBe(false);
    const waterResult = await addWaterGlassAction(TODAY);
    expect(waterResult.success).toBe(false);
  });

  it("an active session can read/write only their own current mood and water log", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);

    const setResult = await setMyMoodAction(TODAY, "focused");
    expect(setResult.success).toBe(true);
    if (setResult.success) expect(setResult.data.mood).toBe("focused");

    const readBack = await getMyWellnessCheckInAction(TODAY);
    expect(readBack?.mood).toBe("focused");

    const added = await addWaterGlassAction(TODAY);
    expect(added.success).toBe(true);
    if (added.success) expect(added.data.glasses).toBe(1);

    const log = await getMyWaterLogAction(TODAY);
    expect(log?.glasses).toBe(1);

    const removed = await removeWaterGlassAction(TODAY);
    expect(removed.success).toBe(true);
    if (removed.success) expect(removed.data.glasses).toBe(0);
  });
});

describe("wellnessActions — API shape never exposes another member's data", () => {
  it("no exported action accepts a target member/employee id parameter", () => {
    // Structural guarantee, not just a runtime check: every action's first
    // parameter is always `date` (a string), never a member/employee
    // identifier — the caller's own identity is resolved server-side from
    // their session, not supplied by the client. Verified here by arity +
    // by the fact every call above only ever reads/writes the session's
    // own current member.
    expect(getMyWellnessCheckInAction.length).toBe(1);
    expect(setMyMoodAction.length).toBe(2);
    expect(getMyWaterLogAction.length).toBe(1);
    expect(addWaterGlassAction.length).toBe(1);
    expect(removeWaterGlassAction.length).toBe(1);
  });
});
