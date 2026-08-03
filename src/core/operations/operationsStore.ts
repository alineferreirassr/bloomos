import type { LiveEventLogEntry, LiveEventLogKind } from "@/types/liveEventLogEntry";
import type { DataResult } from "@/lib/data/result";
import { mockLiveEventLogRepository } from "@/lib/data/operations/mockRepository";

/**
 * OperationsStore (v2 Checkpoint 21, Step 17) — the one seam Live Event Mode
 * (and the Operations Timeline engine) use to read/write event-day log
 * entries. A plain client-callable wrapper, not a "use server" action —
 * same reasoning as every Bloom AI Copilot data function from Checkpoint 20:
 * this workspace's `@/lib/data` facade resolves to the browser-bound
 * Supabase client in `"supabase"` data mode, so calling it from inside a
 * real Server Action would throw. Mock-only this phase (no Supabase table
 * exists yet for `live_event_log_entries`).
 */
export async function logLiveEventEntry(
  workspaceId: string,
  eventId: string,
  kind: LiveEventLogKind,
  note: string | null,
  loggedByName: string,
): Promise<DataResult<LiveEventLogEntry>> {
  return mockLiveEventLogRepository.logEntry(workspaceId, { event_id: eventId, kind, note, logged_by_name: loggedByName });
}

export async function getLiveEventLog(eventId: string): Promise<LiveEventLogEntry[]> {
  return mockLiveEventLogRepository.getLogByEventId(eventId);
}
