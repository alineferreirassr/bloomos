import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 27.3 — Execution Package Timeline Engine. Pure mapping
 * from a package lifecycle transition to the Timeline event it produces
 * — mirrors `operationalTimelineEngine.ts`'s shape exactly.
 * `executionPackageActions.ts` calls these only on a real transition,
 * never on every read/re-evaluation, same "avoid Timeline noise"
 * discipline every prior checkpoint's Timeline integration follows.
 */
export interface ExecutionPackageTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function packageCreatedEvent(title: string): ExecutionPackageTimelineEvent {
  return { type: "package_created", description: `Execution package "${title}" created.` };
}

export function packageUpdatedEvent(title: string): ExecutionPackageTimelineEvent {
  return { type: "package_updated", description: `Execution package "${title}" updated.` };
}

export function packageValidatedEvent(title: string, valid: boolean): ExecutionPackageTimelineEvent {
  return { type: "package_validated", description: `Execution package "${title}" validated — ${valid ? "no blocking issues" : "blocking issues found"}.` };
}

export function packageApprovedEvent(title: string): ExecutionPackageTimelineEvent {
  return { type: "package_approved", description: `Execution package "${title}" approved.` };
}

export function packageArchivedEvent(title: string): ExecutionPackageTimelineEvent {
  return { type: "package_archived", description: `Execution package "${title}" archived.` };
}

export function snapshotCreatedEvent(title: string): ExecutionPackageTimelineEvent {
  return { type: "snapshot_created", description: `A new snapshot was captured for execution package "${title}".` };
}

export function versionCreatedEvent(title: string, versionNumber: number): ExecutionPackageTimelineEvent {
  return { type: "version_created", description: `Version ${versionNumber} created for execution package "${title}".` };
}
