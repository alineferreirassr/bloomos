import type { AvailabilityWindow, AvailabilityStatus } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 26, Step 4 — Availability Engine's persistence. A
 * worker's availability is a log of windows, not a single overwritten
 * field, so history is never lost — same "append, don't overwrite"
 * discipline `AvailabilityWindow.ends_at: null` already documents.
 */
let windows: AvailabilityWindow[] = [];

export function resetAvailabilityStore(): void {
  windows = [];
}

export interface CreateAvailabilityWindowInput {
  worker_id: string;
  status: AvailabilityStatus;
  starts_at: string;
  ends_at: string | null;
  note: string | null;
  time_zone: string;
}

async function listWindowsForWorker(workerId: string): Promise<AvailabilityWindow[]> {
  return windows.filter((w) => w.worker_id === workerId).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

async function listWindowsForWorkspace(workspaceId: string): Promise<AvailabilityWindow[]> {
  return windows.filter((w) => w.workspace_id === workspaceId);
}

/** Closes any still-open window for this worker (`ends_at: null`) at `starts_at`, then opens the new one — a worker has exactly one open window at a time. */
async function recordAvailabilityWindow(workspaceId: string, input: CreateAvailabilityWindowInput): Promise<DataResult<AvailabilityWindow>> {
  if (input.ends_at !== null && input.ends_at <= input.starts_at) return fail("Please fix the highlighted fields.", { ends_at: "End time must be after the start time." });

  const timestamp = nowIso();
  windows = windows.map((w) => (w.worker_id === input.worker_id && w.ends_at === null ? { ...w, ends_at: input.starts_at } : w));

  const window: AvailabilityWindow = {
    id: generateId("availability_window"),
    worker_id: input.worker_id,
    workspace_id: workspaceId,
    status: input.status,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    note: input.note,
    time_zone: input.time_zone,
    created_at: timestamp,
  };
  windows = [...windows, window];
  return ok(window);
}

async function getCurrentWindow(workerId: string): Promise<AvailabilityWindow | null> {
  const openWindow = windows.find((w) => w.worker_id === workerId && w.ends_at === null);
  if (openWindow) return openWindow;
  const sorted = windows.filter((w) => w.worker_id === workerId).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return sorted[0] ?? null;
}

export interface AvailabilityRepository {
  listWindowsForWorker: typeof listWindowsForWorker;
  listWindowsForWorkspace: typeof listWindowsForWorkspace;
  recordAvailabilityWindow: typeof recordAvailabilityWindow;
  getCurrentWindow: typeof getCurrentWindow;
}

export const mockAvailabilityRepository: AvailabilityRepository = {
  listWindowsForWorker,
  listWindowsForWorkspace,
  recordAvailabilityWindow,
  getCurrentWindow,
};
