import type { WellnessCheckIn, WaterLog } from "@/types/wellness";
import type { WellnessRepository } from "@/lib/data/wellness/repository";
import { ok, fail } from "@/lib/data/result";
import { readCheckIns, readWaterLogs, upsertMockCheckIn, upsertMockWaterLog, resetWellnessMockData } from "@/lib/data/mock/wellnessStore";
import { getCurrentWorkspaceMember } from "@/lib/data";

export { resetWellnessMockData };

/** Mock mode has no real `auth.uid()` — the seeded current member's `user_id` stands in for it, the same precedent `getCurrentWorkspaceMember()` itself establishes everywhere else. */
async function currentMemberUserId(): Promise<string> {
  const member = await getCurrentWorkspaceMember();
  if (!member) throw new Error("No current workspace member in mock mode.");
  return member.user_id;
}

export const mockWellnessRepository: WellnessRepository = {
  async getMyCheckIn(date) {
    const memberId = await currentMemberUserId();
    return readCheckIns().find((c) => c.member_id === memberId && c.checkin_date === date) ?? null;
  },

  async setMyMood(date, mood) {
    const memberId = await currentMemberUserId();
    return ok<WellnessCheckIn>(upsertMockCheckIn(memberId, date, mood));
  },

  async getMyWaterLog(date) {
    const memberId = await currentMemberUserId();
    return readWaterLogs().find((w) => w.member_id === memberId && w.log_date === date) ?? null;
  },

  async addMyWaterGlass(date) {
    const memberId = await currentMemberUserId();
    const current = readWaterLogs().find((w) => w.member_id === memberId && w.log_date === date);
    return ok<WaterLog>(upsertMockWaterLog(memberId, date, (current?.glasses ?? 0) + 1));
  },

  async removeMyWaterGlass(date) {
    const memberId = await currentMemberUserId();
    const current = readWaterLogs().find((w) => w.member_id === memberId && w.log_date === date);
    if (!current || current.glasses === 0) return fail("There are no glasses to remove.");
    return ok<WaterLog>(upsertMockWaterLog(memberId, date, current.glasses - 1));
  },
};
