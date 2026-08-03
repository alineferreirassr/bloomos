import type { LiveEventLogEntry, LiveEventLogEntryInput } from "@/types/liveEventLogEntry";
import type { DataResult } from "@/lib/data/result";

/**
 * OperationsStore (v2 Checkpoint 21, Step 17) — persistence for Live Event
 * Mode's own log entries (Check In/Out, Report Issue, Request Help, and a
 * generic operational note). Mock-only this phase, same "architecture ahead
 * of a Supabase migration" precedent as `core/ai/memory`'s own Knowledge
 * Store before it had a real table.
 */
export interface LiveEventLogRepository {
  logEntry(workspaceId: string, input: LiveEventLogEntryInput): Promise<DataResult<LiveEventLogEntry>>;
  getLogByEventId(eventId: string): Promise<LiveEventLogEntry[]>;
}
