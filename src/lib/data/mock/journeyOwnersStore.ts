import type { JourneyOwnerRecord, JourneyOwnerRole, JourneySubjectType } from "@/types/clientJourney";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 32 — Journey ownership assignments. Which team member
 * holds each of the 6 named roles for a given client/lead is not
 * derivable from any existing module, so it is the second genuinely
 * persisted entity this checkpoint introduces. At most one active
 * assignment exists per (subject, role) — assigning a new member to a
 * role replaces the previous one rather than appending a duplicate.
 */
let assignments: JourneyOwnerRecord[] = [];

export function resetJourneyOwnersStore(): void {
  assignments = [];
}

async function listOwnersFor(workspaceId: string, subjectType: JourneySubjectType, subjectId: string): Promise<JourneyOwnerRecord[]> {
  return assignments.filter((a) => a.workspaceId === workspaceId && a.subjectType === subjectType && a.subjectId === subjectId);
}

async function assignOwner(
  workspaceId: string,
  subjectType: JourneySubjectType,
  subjectId: string,
  role: JourneyOwnerRole,
  memberId: string,
  assignedByMemberId: string | null,
): Promise<DataResult<JourneyOwnerRecord>> {
  if (!memberId) return fail("A team member must be selected to assign this role.");
  const timestamp = nowIso();
  const existing = assignments.find((a) => a.workspaceId === workspaceId && a.subjectType === subjectType && a.subjectId === subjectId && a.role === role);
  const record: JourneyOwnerRecord = {
    id: existing?.id ?? generateId("journey_owner"),
    workspaceId,
    subjectType,
    subjectId,
    role,
    memberId,
    assignedAt: timestamp,
    assignedByMemberId,
  };
  assignments = existing ? assignments.map((a) => (a.id === existing.id ? record : a)) : [...assignments, record];
  return ok(record);
}

async function unassignOwner(workspaceId: string, subjectType: JourneySubjectType, subjectId: string, role: JourneyOwnerRole): Promise<DataResult<null>> {
  assignments = assignments.filter((a) => !(a.workspaceId === workspaceId && a.subjectType === subjectType && a.subjectId === subjectId && a.role === role));
  return ok(null);
}

export interface JourneyOwnersRepository {
  listOwnersFor: typeof listOwnersFor;
  assignOwner: typeof assignOwner;
  unassignOwner: typeof unassignOwner;
}

export const mockJourneyOwnersRepository: JourneyOwnersRepository = {
  listOwnersFor,
  assignOwner,
  unassignOwner,
};
