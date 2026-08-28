import type { Database } from "@/types/database.types";
import type { MoodValue, WellnessCheckIn, WaterLog } from "@/types/wellness";
import type { WellnessRepository } from "@/lib/data/wellness/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

type CheckInRow = Database["public"]["Tables"]["employee_wellness_checkins"]["Row"];
type WaterLogRow = Database["public"]["Tables"]["employee_water_logs"]["Row"];

function mapCheckInRow(row: CheckInRow): WellnessCheckIn {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    checkin_date: row.checkin_date,
    mood: row.mood as MoodValue,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapWaterLogRow(row: WaterLogRow): WaterLog {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    log_date: row.log_date,
    glasses: row.glasses,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Only ever called with a real `ServerRepositoryContext` in practice — this
 * feature has no Client Component write path (mood/water actions are
 * always invoked through a `"use server"` action), so a missing context
 * is treated as a programming error, not a recoverable state.
 */
function requireContext(context: ServerRepositoryContext | undefined): ServerRepositoryContext {
  if (!context) throw new Error("Wellness data access requires a server-authenticated context.");
  return context;
}

export const supabaseWellnessRepository: WellnessRepository = {
  async getMyCheckIn(date, context) {
    const { supabase, session } = requireContext(context);
    const { data, error } = await supabase
      .from("employee_wellness_checkins")
      .select("*")
      .eq("member_id", session.user.id)
      .eq("checkin_date", date)
      .maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    return data ? mapCheckInRow(data) : null;
  },

  async setMyMood(date, mood, context): Promise<DataResult<WellnessCheckIn>> {
    const { supabase, session } = requireContext(context);
    const { data, error } = await supabase
      .from("employee_wellness_checkins")
      .upsert({ workspace_id: session.workspace.id, member_id: session.user.id, checkin_date: date, mood }, { onConflict: "member_id,checkin_date" })
      .select("*")
      .single();
    if (error) return fail(normalizeSupabaseError(error).message);
    return ok(mapCheckInRow(data));
  },

  async getMyWaterLog(date, context) {
    const { supabase, session } = requireContext(context);
    const { data, error } = await supabase
      .from("employee_water_logs")
      .select("*")
      .eq("member_id", session.user.id)
      .eq("log_date", date)
      .maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    return data ? mapWaterLogRow(data) : null;
  },

  async addMyWaterGlass(date, context): Promise<DataResult<WaterLog>> {
    const { supabase, session } = requireContext(context);
    const { data: existing, error: readError } = await supabase
      .from("employee_water_logs")
      .select("glasses")
      .eq("member_id", session.user.id)
      .eq("log_date", date)
      .maybeSingle();
    if (readError) return fail(normalizeSupabaseError(readError).message);
    const { data, error } = await supabase
      .from("employee_water_logs")
      .upsert({ workspace_id: session.workspace.id, member_id: session.user.id, log_date: date, glasses: (existing?.glasses ?? 0) + 1 }, { onConflict: "member_id,log_date" })
      .select("*")
      .single();
    if (error) return fail(normalizeSupabaseError(error).message);
    return ok(mapWaterLogRow(data));
  },

  async removeMyWaterGlass(date, context): Promise<DataResult<WaterLog>> {
    const { supabase, session } = requireContext(context);
    const { data: existing, error: readError } = await supabase
      .from("employee_water_logs")
      .select("glasses")
      .eq("member_id", session.user.id)
      .eq("log_date", date)
      .maybeSingle();
    if (readError) return fail(normalizeSupabaseError(readError).message);
    if (!existing || existing.glasses === 0) return fail("There are no glasses to remove.");
    const { data, error } = await supabase
      .from("employee_water_logs")
      .update({ glasses: existing.glasses - 1 })
      .eq("member_id", session.user.id)
      .eq("log_date", date)
      .select("*")
      .single();
    if (error) return fail(normalizeSupabaseError(error).message);
    return ok(mapWaterLogRow(data));
  },
};
