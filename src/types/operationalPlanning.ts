import type { KnowledgeNodeRef, KnowledgeNodeType } from "@/types/knowledgeGraph";
import type { AppointmentPriority } from "@/types/scheduling";
import type { ResourceType } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.2 — Operational Planning Platform. Capability
 * determines WHO is capable (26.1). Scheduling determines WHEN work can
 * happen (27). Resource Allocation determines WHICH resources should be
 * used (27.1). Operational Planning determines HOW the operation should
 * be executed — reusable execution plans only. Dispatch (a future
 * checkpoint) will later execute an approved plan; every engine here is a
 * pure, deterministic function — no AI, no randomness, no worker
 * dispatch, no live execution, no evidence capture.
 *
 * A plan is read and written as one aggregate document — phases carry
 * their own steps inline, and milestones/deliverables/evidence
 * requirements/checklists/approvals live as top-level arrays on the plan
 * — the same "whole graph as one document" precedent the Workflow Builder
 * (Checkpoint 12/13) established, chosen because a Plan Detail page reads
 * the entire tree at once and nothing here is ever queried step-by-step
 * independently of its plan.
 *
 * `ResourceType` (from `types/allocation.ts`) and `AppointmentPriority`
 * (from `types/scheduling.ts`) are reused directly rather than
 * re-declared — an `ExecutionStep`'s "Assigned Resource Type"/priority
 * mean the exact same thing here as they do in those checkpoints.
 */

// ---- Plan / Template lifecycle ----

export const PLAN_STATUSES = ["draft", "active", "approved", "completed", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const TEMPLATE_STATUSES = ["active", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

/** The spec's own named examples — `"custom"` covers everything else. Purely a categorization label; no template behavior branches on it. */
export const TEMPLATE_CATEGORIES = ["wedding_proposal", "luxury_picnic", "hotel_decoration", "photoshoot", "drone_inspection", "cleaning_service", "furniture_assembly", "maintenance_visit", "custom"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const PLAN_CONTEXT_TYPES = ["event", "client", "project_placeholder", "custom"] as const;
export type PlanContextType = (typeof PLAN_CONTEXT_TYPES)[number];
/** Same disclosed-gap discipline `ALLOCATION_REQUEST_CONTEXTS_WITH_NO_NODE`/`CALENDAR_CONTEXTS_WITH_NO_NODE` established — a placeholder/custom context has no real `KnowledgeNodeType` to point at. */
export const PLAN_CONTEXTS_WITH_NO_NODE: readonly PlanContextType[] = ["project_placeholder", "custom"];
export const PLAN_CONTEXT_TYPE_TO_NODE_TYPE: Partial<Record<PlanContextType, KnowledgeNodeType>> = { event: "event", client: "client" };

// ---- Execution Phases ----

export const EXECUTION_PHASE_KINDS = ["preparation", "travel", "arrival", "setup", "execution", "quality_review", "cleanup", "completion", "custom"] as const;
export type ExecutionPhaseKind = (typeof EXECUTION_PHASE_KINDS)[number];

// ---- Step dependencies ----

export const DEPENDENCY_TYPES = ["finish_to_start", "start_to_start", "finish_to_finish"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** Independent of `DependencyType` — a dependency's *kind* (when it applies) is orthogonal to its *class* (how strictly it must hold). */
export const DEPENDENCY_CLASSES = ["optional", "blocking", "critical"] as const;
export type DependencyClass = (typeof DEPENDENCY_CLASSES)[number];

export interface StepDependency {
  /** The step this dependency points at — may be a step in an earlier phase; never itself (see `PhaseEngine`'s cycle check). */
  step_id: string;
  type: DependencyType;
  dependency_class: DependencyClass;
}

// ---- Execution Steps ----

export const EXECUTION_STEP_STATUSES = ["pending", "in_progress", "completed", "skipped", "blocked"] as const;
export type ExecutionStepStatus = (typeof EXECUTION_STEP_STATUSES)[number];

export interface ExecutionStep {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  estimated_duration_minutes: number;
  dependencies: StepDependency[];
  /** A category, not a resolved candidate — this checkpoint never binds an actual Worker/Equipment id; that's Dispatch's job. */
  assigned_resource_type: ResourceType | null;
  /** References a real, already-built Checkpoint 26.1 `CapabilityRequirement` — never a re-declared skill/certification list. */
  required_capability_requirement_id: string | null;
  priority: AppointmentPriority;
  status: ExecutionStepStatus;
  notes: string | null;
}

export interface ExecutionPhase {
  id: string;
  kind: ExecutionPhaseKind;
  name: string;
  /** Resolved order within the plan — lower runs first. */
  order: number;
  steps: ExecutionStep[];
}

// ---- Milestones ----

export const MILESTONE_STATUSES = ["not_started", "in_progress", "completed", "blocked"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface Milestone {
  id: string;
  title: string;
  /** `null` = not tied to one specific phase (a whole-plan milestone). */
  target_phase_id: string | null;
  completion_criteria: string;
  evidence_requirement_ids: string[];
  approval_required: boolean;
  status: MilestoneStatus;
}

// ---- Deliverables ----

export const DELIVERABLE_TYPES = ["physical", "digital", "service", "report", "document", "media", "custom"] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

export const DELIVERABLE_STATUSES = ["pending", "ready", "delivered", "rejected"] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export interface Deliverable {
  id: string;
  title: string;
  type: DeliverableType;
  description: string | null;
  produced_by_step_id: string | null;
  status: DeliverableStatus;
  /** Set only when this deliverable maps to a real, already-created artifact (a Document or MediaAsset) — the one honest hook for a live `produces_deliverable` Knowledge Graph edge. `null` for every deliverable that's still just a plan-time placeholder. */
  linked_node: KnowledgeNodeRef | null;
}

// ---- Evidence (declarative only — no capture implementation) ----

export const EVIDENCE_TYPES = ["photo", "video", "document", "measurement", "qr_scan", "barcode_scan", "gps_confirmation", "digital_signature", "custom"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface EvidenceRequirement {
  id: string;
  type: EvidenceType;
  description: string;
  step_id: string | null;
  milestone_id: string | null;
}

// ---- Checklists ----

export const CHECKLIST_KINDS = ["task", "safety", "quality", "customer", "vehicle", "equipment", "custom"] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

export interface ChecklistItemDefinition {
  id: string;
  label: string;
  completed: boolean;
}

/** A reusable checklist template — structural only, no per-instance completion state. */
export interface ChecklistTemplate {
  id: string;
  workspace_id: string;
  name: string;
  kind: ChecklistKind;
  items: Array<{ id: string; label: string }>;
  status: TemplateStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** A checklist attached to a plan — a frozen snapshot of a `ChecklistTemplate` at attach time (`template_id !== null`), or an ad-hoc one (`template_id === null`). Same "snapshot, not a live reference" discipline `ChecklistItem.template_snapshot` established for Events. */
export interface PlanChecklist {
  id: string;
  template_id: string | null;
  name: string;
  kind: ChecklistKind;
  items: ChecklistItemDefinition[];
}

// ---- Approvals (requirements only — no workflow automation) ----

export const APPROVAL_TYPES = ["manager", "client", "quality", "supervisor", "automatic_rule_placeholder"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalRequirement {
  id: string;
  type: ApprovalType;
  description: string;
  phase_id: string | null;
  step_id: string | null;
  /** `null` on every field above + this one = a whole-plan approval. */
  milestone_id: string | null;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
}

// ---- Plan Template & Operational Plan (the two persisted aggregates) ----

export interface PlanTemplate {
  id: string;
  workspace_id: string;
  name: string;
  category: TemplateCategory;
  description: string | null;
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidence_requirements: EvidenceRequirement[];
  checklists: PlanChecklist[];
  approvals: ApprovalRequirement[];
  /** Incremented on every structural update — see Step 21's "Version Templates." No snapshot history is kept; disclosed scope decision in `docs/plan-templates.md`. */
  version: number;
  status: TemplateStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface OperationalPlan {
  id: string;
  workspace_id: string;
  name: string;
  /** Set when this plan was instantiated from a `PlanTemplate` — the template's structure was deep-copied with fresh ids at creation time, never a live reference. */
  template_id: string | null;
  context_type: PlanContextType;
  context: KnowledgeNodeRef | null;
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidence_requirements: EvidenceRequirement[];
  checklists: PlanChecklist[];
  approvals: ApprovalRequirement[];
  status: PlanStatus;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  archived_at: string | null;
}

// ---- Computed results (never stored) ----

export interface DependencyCycleResult {
  hasCycle: boolean;
  /** The step ids forming the cycle, in cycle order — empty when `hasCycle` is `false`. */
  cycleStepIds: string[];
}

export interface CriticalPathResult {
  criticalStepIds: string[];
  blockingStepIds: string[];
  parallelStepIds: string[];
  optionalStepIds: string[];
  estimatedCompletionMinutes: number;
}

export interface OperationalValidationIssue {
  rule: string;
  detail: string;
}

export interface OperationalValidationResult {
  valid: boolean;
  errors: OperationalValidationIssue[];
  warnings: OperationalValidationIssue[];
}

export interface OperationalHealthScores {
  planCompletenessScore: number;
  dependencyHealthScore: number;
  evidenceCoverageScore: number;
  checklistCoverageScore: number;
  approvalCoverageScore: number;
  deliverableCoverageScore: number;
  milestoneCoverageScore: number;
  overallOperationalHealth: number;
}

export interface OperationalExplanation {
  summary: string;
  missingRequirements: string[];
  dependencyFailures: string[];
  approvalBlockers: string[];
  evidenceGaps: string[];
  incompleteMilestones: string[];
  incompleteDeliverables: string[];
  criticalPathSummary: string;
}

export interface OperationalPlanResult {
  plan: OperationalPlan;
  validation: OperationalValidationResult;
  health: OperationalHealthScores;
  explanation: OperationalExplanation;
  criticalPath: CriticalPathResult;
}

export const OPERATIONAL_RISK_LEVELS = ["low", "medium", "high"] as const;
export type OperationalRiskLevel = (typeof OPERATIONAL_RISK_LEVELS)[number];

export interface OperationalPlanComparisonEntry {
  planId: string;
  planName: string;
  executionComplexity: number;
  deliverableCount: number;
  evidenceCount: number;
  milestoneCount: number;
  health: OperationalHealthScores;
  criticalPath: CriticalPathResult;
  riskLevel: OperationalRiskLevel;
}

export interface OperationalPlanComparisonResult {
  entries: OperationalPlanComparisonEntry[];
  differences: string[];
}

export const OPERATIONAL_FINDING_TYPES = ["missing_operational_plan", "missing_evidence", "missing_deliverables", "approval_bottleneck", "critical_dependency", "incomplete_plan", "high_operational_complexity", "missing_checklist"] as const;
export type OperationalFindingType = (typeof OPERATIONAL_FINDING_TYPES)[number];

export const OPERATIONAL_FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type OperationalFindingSeverity = (typeof OPERATIONAL_FINDING_SEVERITIES)[number];

export interface OperationalFinding {
  id: string;
  type: OperationalFindingType;
  severity: OperationalFindingSeverity;
  description: string;
  relatedPlanId: string | null;
  relatedStepId: string | null;
}
