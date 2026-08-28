export const MOOD_VALUES = ["great", "good", "calm", "happy", "focused", "tired", "low_energy", "stressed", "overwhelmed", "prefer_not_to_say"] as const;
export type MoodValue = (typeof MOOD_VALUES)[number];

export const MOOD_LABELS: Record<MoodValue, string> = {
  great: "Great",
  good: "Good",
  calm: "Calm",
  happy: "Happy",
  focused: "Focused",
  tired: "Tired",
  low_energy: "Low energy",
  stressed: "Stressed",
  overwhelmed: "Overwhelmed",
  prefer_not_to_say: "Prefer not to say",
};

/**
 * One row per employee per day. Private to the authoring employee only —
 * `member_id` is always the caller's own `auth.uid()`, enforced by
 * `employee_wellness_checkins`'s RLS policy (no Founder/Admin exception).
 * Never surfaced to any Founder/Admin-facing view, dashboard, or report.
 */
export interface WellnessCheckIn {
  id: string;
  workspace_id: string;
  member_id: string;
  checkin_date: string;
  mood: MoodValue;
  created_at: string;
  updated_at: string;
}

export const DAILY_WATER_GOAL_GLASSES = 8;

/** One row per employee per day. Same strict self-only privacy as `WellnessCheckIn` — see `employee_water_logs`'s RLS policy. */
export interface WaterLog {
  id: string;
  workspace_id: string;
  member_id: string;
  log_date: string;
  glasses: number;
  created_at: string;
  updated_at: string;
}
