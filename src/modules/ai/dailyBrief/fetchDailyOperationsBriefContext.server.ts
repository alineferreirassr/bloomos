import "server-only";
import { getDataMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { fetchEventContextRecord, type EventContextRecord } from "@/modules/ai/fetchEventContext.server";

/** Mock mode has no multi-tenant concept — same "read the flat store" shape `fetchEventContext.server.ts`'s own mock branch uses. */
function listActiveEventIdsMock(): string[] {
  return readEvents()
    .filter((event) => event.status !== "archived")
    .map((event) => event.id);
}

async function listActiveEventIdsSupabase(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("id").neq("status", "archived");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map((row: { id: string }) => row.id);
}

/**
 * Server-only, workspace-wide fetch for the Daily Operations Brief —
 * deliberately reuses `fetchEventContextRecord` per Event rather than
 * writing a second per-Event read path. This is the same N+1-but-accepted
 * shape `OperationalPipelineBoard`'s own loader already uses for the
 * Events list; a batch query is a reasonable future optimization but not
 * a correctness requirement for this architecture-first phase.
 */
export async function fetchDailyOperationsBriefRecords(): Promise<EventContextRecord[]> {
  const ids = getDataMode() !== "supabase" ? listActiveEventIdsMock() : await listActiveEventIdsSupabase();
  const records = await Promise.all(ids.map((id) => fetchEventContextRecord(id)));
  return records.filter((record): record is EventContextRecord => record !== null);
}
