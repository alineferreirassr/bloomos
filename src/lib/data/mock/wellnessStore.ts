import type { MoodValue, WellnessCheckIn, WaterLog } from "@/types/wellness";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/** In-memory only, keyed by `memberId:date` — mirrors every other mock store's read/write/reset convention (e.g. `notesStore.ts`). No seed data: an employee's wellness history starts empty, exactly like it would on a real, brand-new account. */
let checkIns: WellnessCheckIn[] = [];
let waterLogs: WaterLog[] = [];
let nextCheckInSeq = 1;
let nextWaterLogSeq = 1;

export function readCheckIns(): WellnessCheckIn[] {
  return checkIns;
}

export function writeCheckIns(next: WellnessCheckIn[]): void {
  checkIns = next;
}

export function readWaterLogs(): WaterLog[] {
  return waterLogs;
}

export function writeWaterLogs(next: WaterLog[]): void {
  waterLogs = next;
}

export function upsertMockCheckIn(memberId: string, date: string, mood: MoodValue): WellnessCheckIn {
  const now = new Date().toISOString();
  const existing = checkIns.find((c) => c.member_id === memberId && c.checkin_date === date);
  if (existing) {
    const updated: WellnessCheckIn = { ...existing, mood, updated_at: now };
    checkIns = checkIns.map((c) => (c.id === updated.id ? updated : c));
    return updated;
  }
  const created: WellnessCheckIn = {
    id: `wellness_${nextCheckInSeq++}`,
    workspace_id: CURRENT_WORKSPACE_ID,
    member_id: memberId,
    checkin_date: date,
    mood,
    created_at: now,
    updated_at: now,
  };
  checkIns = [...checkIns, created];
  return created;
}

export function upsertMockWaterLog(memberId: string, date: string, glasses: number): WaterLog {
  const now = new Date().toISOString();
  const clamped = Math.max(0, glasses);
  const existing = waterLogs.find((w) => w.member_id === memberId && w.log_date === date);
  if (existing) {
    const updated: WaterLog = { ...existing, glasses: clamped, updated_at: now };
    waterLogs = waterLogs.map((w) => (w.id === updated.id ? updated : w));
    return updated;
  }
  const created: WaterLog = {
    id: `water_${nextWaterLogSeq++}`,
    workspace_id: CURRENT_WORKSPACE_ID,
    member_id: memberId,
    log_date: date,
    glasses: clamped,
    created_at: now,
    updated_at: now,
  };
  waterLogs = [...waterLogs, created];
  return created;
}

export function resetWellnessMockData(): void {
  checkIns = [];
  waterLogs = [];
  nextCheckInSeq = 1;
  nextWaterLogSeq = 1;
}
