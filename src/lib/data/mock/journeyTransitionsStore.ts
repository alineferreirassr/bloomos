import type { JourneyTransitionRecord, RecordJourneyTransitionInput, JourneySubjectType } from "@/types/clientJourney";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 32 — Client Journey transition history. The current
 * stage itself is always resolved fresh from source-module facts
 * (`ClientJourneyStateResolver`) and never stored here; this log exists
 * only for the manual/explainable events the resolver cannot re-derive on
 * its own — a validated transition, a block, a skip, a cancel/lose/restore,
 * or a reopen — each carrying its own trigger/source record/acting member,
 * the same "persist only what cannot be re-derived" discipline
 * `OperationalAlert` established in Checkpoint 31.
 */
let transitions: JourneyTransitionRecord[] = [];

export function resetJourneyTransitionsStore(): void {
  transitions = [];
}

async function recordTransition(input: RecordJourneyTransitionInput): Promise<JourneyTransitionRecord> {
  const record: JourneyTransitionRecord = {
    id: generateId("journey_transition"),
    workspaceId: input.workspaceId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    type: input.type,
    previousStage: input.previousStage,
    newStage: input.newStage,
    trigger: input.trigger,
    sourceRecordId: input.sourceRecordId ?? null,
    actingMemberId: input.actingMemberId ?? null,
    blockingRules: input.blockingRules ?? [],
    createdAt: nowIso(),
  };
  transitions = [...transitions, record];
  return record;
}

async function listTransitionsFor(workspaceId: string, subjectType: JourneySubjectType, subjectId: string): Promise<JourneyTransitionRecord[]> {
  return transitions
    .filter((t) => t.workspaceId === workspaceId && t.subjectType === subjectType && t.subjectId === subjectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function getLatestTransition(workspaceId: string, subjectType: JourneySubjectType, subjectId: string): Promise<JourneyTransitionRecord | null> {
  const all = await listTransitionsFor(workspaceId, subjectType, subjectId);
  return all.length === 0 ? null : all[all.length - 1];
}

export interface JourneyTransitionsRepository {
  recordTransition: typeof recordTransition;
  listTransitionsFor: typeof listTransitionsFor;
  getLatestTransition: typeof getLatestTransition;
}

export const mockJourneyTransitionsRepository: JourneyTransitionsRepository = {
  recordTransition,
  listTransitionsFor,
  getLatestTransition,
};
