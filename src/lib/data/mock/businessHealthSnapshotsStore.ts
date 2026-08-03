import type { KnowledgeNodeType } from "@/types/knowledgeGraph";
import type { ConstraintViolation } from "@/types/relationshipConstraints";
import type { BusinessRuleViolation } from "@/types/businessHealth";

/**
 * v2.0 Checkpoint 25, Step 15.5 — the "prior-evaluation storage" the
 * Operational Timeline Integration needs to tell "improved" from
 * "declined" and "increased" from "decreased." Same convention as every
 * other mock store in this codebase: module-scoped `let` array,
 * immutable reassignment, `resetXStore()` for tests only. Mock-only —
 * there is no Supabase table for this yet, same precedent as
 * `core/comments`/`core/tags`.
 */

export interface BusinessHealthSnapshot {
  workspaceId: string;
  overallScore: number;
  evaluatedAt: string;
}

export interface ReadinessSnapshotRecord {
  workspaceId: string;
  nodeType: KnowledgeNodeType;
  nodeId: string;
  overallScore: number;
  evaluatedAt: string;
}

let businessHealthSnapshots: BusinessHealthSnapshot[] = [];
let readinessSnapshots: ReadinessSnapshotRecord[] = [];
/** Keyed by workspace — the full violation list from the last evaluation, so `operationalTimelineEngine.ts` can diff "which violations are new" / "which got fixed" instead of only comparing a single score. */
let lastConstraintViolationsByWorkspace = new Map<string, ConstraintViolation[]>();
let lastBusinessRuleViolationsByWorkspace = new Map<string, BusinessRuleViolation[]>();

export function getBusinessHealthSnapshot(workspaceId: string): BusinessHealthSnapshot | null {
  return businessHealthSnapshots.find((s) => s.workspaceId === workspaceId) ?? null;
}

export function setBusinessHealthSnapshot(snapshot: BusinessHealthSnapshot): void {
  businessHealthSnapshots = [...businessHealthSnapshots.filter((s) => s.workspaceId !== snapshot.workspaceId), snapshot];
}

export function getReadinessSnapshot(workspaceId: string, nodeType: KnowledgeNodeType, nodeId: string): ReadinessSnapshotRecord | null {
  return readinessSnapshots.find((s) => s.workspaceId === workspaceId && s.nodeType === nodeType && s.nodeId === nodeId) ?? null;
}

export function setReadinessSnapshot(snapshot: ReadinessSnapshotRecord): void {
  readinessSnapshots = [
    ...readinessSnapshots.filter((s) => !(s.workspaceId === snapshot.workspaceId && s.nodeType === snapshot.nodeType && s.nodeId === snapshot.nodeId)),
    snapshot,
  ];
}

export function getLastConstraintViolations(workspaceId: string): ConstraintViolation[] {
  return lastConstraintViolationsByWorkspace.get(workspaceId) ?? [];
}

export function setLastConstraintViolations(workspaceId: string, violations: ConstraintViolation[]): void {
  lastConstraintViolationsByWorkspace = new Map(lastConstraintViolationsByWorkspace).set(workspaceId, violations);
}

export function getLastBusinessRuleViolations(workspaceId: string): BusinessRuleViolation[] {
  return lastBusinessRuleViolationsByWorkspace.get(workspaceId) ?? [];
}

export function setLastBusinessRuleViolations(workspaceId: string, violations: BusinessRuleViolation[]): void {
  lastBusinessRuleViolationsByWorkspace = new Map(lastBusinessRuleViolationsByWorkspace).set(workspaceId, violations);
}

export function resetBusinessHealthSnapshotsStore(): void {
  businessHealthSnapshots = [];
  readinessSnapshots = [];
  lastConstraintViolationsByWorkspace = new Map();
  lastBusinessRuleViolationsByWorkspace = new Map();
}
