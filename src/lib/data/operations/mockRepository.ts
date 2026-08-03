import type { LiveEventLogEntry, LiveEventLogEntryInput } from "@/types/liveEventLogEntry";
import type { LiveEventLogRepository } from "@/lib/data/operations/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let entries: LiveEventLogEntry[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetLiveEventLogStore(): void {
  entries = [];
}

async function logEntry(workspaceId: string, input: LiveEventLogEntryInput): Promise<DataResult<LiveEventLogEntry>> {
  await delay(150);
  const loggedByName = input.logged_by_name.trim();
  if (loggedByName.length === 0) {
    return fail("Please fix the highlighted fields.", { logged_by_name: "Logged-by name is required" });
  }

  const now = nowIso();
  const entry: LiveEventLogEntry = {
    id: generateId("live_log"),
    workspace_id: workspaceId,
    event_id: input.event_id,
    kind: input.kind,
    note: input.note,
    logged_by_name: loggedByName,
    occurred_at: now,
    created_at: now,
  };
  entries = [...entries, entry];
  return ok(entry);
}

async function getLogByEventId(eventId: string): Promise<LiveEventLogEntry[]> {
  await delay(150);
  // Newest first. `occurred_at` alone can tie within the same millisecond
  // (e.g. in tests, where `delay()` is a no-op) — reversing insertion order
  // first, then doing a stable sort on occurred_at, makes a later log entry
  // win any tie rather than leaving the result order ambiguous.
  return [...entries]
    .filter((entry) => entry.event_id === eventId)
    .reverse()
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

export const mockLiveEventLogRepository: LiveEventLogRepository = {
  logEntry,
  getLogByEventId,
};
