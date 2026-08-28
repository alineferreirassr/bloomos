"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getMyWellnessCheckIn, setMyMood as setMyMoodRepo, getMyWaterLog, addMyWaterGlass, removeMyWaterGlass } from "@/lib/data";
import type { MoodValue, WellnessCheckIn, WaterLog } from "@/types/wellness";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "This isn't available right now.";

/**
 * Every function here is scoped to the caller's own data only — there is
 * no `memberId` parameter anywhere, on purpose. `date` is always supplied
 * by the caller (the browser's own local calendar date), never derived
 * from the server's clock — the same mistake that produced the Dashboard
 * greeting's timezone bug is exactly what this avoids for "today's"
 * check-in/water log.
 */
async function requireActiveMemberId(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { ok: false, error: GENERIC_ACCESS_ERROR };
  return { ok: true };
}

async function serverContextIfSupabase() {
  return getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;
}

export async function getMyWellnessCheckInAction(date: string): Promise<WellnessCheckIn | null> {
  const gate = await requireActiveMemberId();
  if (!gate.ok) return null;
  return getMyWellnessCheckIn(date, await serverContextIfSupabase());
}

export async function setMyMoodAction(date: string, mood: MoodValue): Promise<DataResult<WellnessCheckIn>> {
  const gate = await requireActiveMemberId();
  if (!gate.ok) return fail(gate.error);
  return setMyMoodRepo(date, mood, await serverContextIfSupabase());
}

export async function getMyWaterLogAction(date: string): Promise<WaterLog | null> {
  const gate = await requireActiveMemberId();
  if (!gate.ok) return null;
  return getMyWaterLog(date, await serverContextIfSupabase());
}

export async function addWaterGlassAction(date: string): Promise<DataResult<WaterLog>> {
  const gate = await requireActiveMemberId();
  if (!gate.ok) return fail(gate.error);
  return addMyWaterGlass(date, await serverContextIfSupabase());
}

export async function removeWaterGlassAction(date: string): Promise<DataResult<WaterLog>> {
  const gate = await requireActiveMemberId();
  if (!gate.ok) return fail(gate.error);
  return removeMyWaterGlass(date, await serverContextIfSupabase());
}
