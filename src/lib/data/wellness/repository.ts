import type { MoodValue, WellnessCheckIn, WaterLog } from "@/types/wellness";
import type { DataResult } from "@/lib/data/result";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

/**
 * The private employee wellness persistence contract — mood check-ins and
 * water tracker entries. Every method is implicitly scoped to "the calling
 * employee's own row" (their own `auth.uid()` in Supabase mode, their own
 * mock member identity in mock mode) — there is no method here, and there
 * must never be one added, that reads or lists another member's data. The
 * privacy guarantee lives primarily in Supabase RLS (see the
 * `employee_wellness_checkins`/`employee_water_logs` migration), but this
 * repository's own shape reinforces it: nothing here accepts a `memberId`
 * parameter to read someone else's entry.
 */
export interface WellnessRepository {
  getMyCheckIn(date: string, context?: ServerRepositoryContext): Promise<WellnessCheckIn | null>;
  setMyMood(date: string, mood: MoodValue, context?: ServerRepositoryContext): Promise<DataResult<WellnessCheckIn>>;
  getMyWaterLog(date: string, context?: ServerRepositoryContext): Promise<WaterLog | null>;
  addMyWaterGlass(date: string, context?: ServerRepositoryContext): Promise<DataResult<WaterLog>>;
  removeMyWaterGlass(date: string, context?: ServerRepositoryContext): Promise<DataResult<WaterLog>>;
}
