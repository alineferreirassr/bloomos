import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { AppointmentPriority } from "@/types/scheduling";
import type { AllocationCandidate, AllocationStrategy, ResourceBundle, DependencyCheckResult, ResourcePoolSnapshot } from "@/types/allocation";
import type { ExecutionPhase, Milestone, Deliverable, EvidenceRequirement, PlanChecklist, ApprovalRequirement, PlanContextType } from "@/types/operationalPlanning";

/**
 * v2.0 Checkpoint 27.3 — Execution Package Platform. Capability (26.1)
 * determines WHO is eligible. Scheduling (27) determines WHEN work
 * happens. Allocation (27.1) determines WHICH resources should be used.
 * Operational Planning (27.2) determines HOW work should be executed.
 * Execution Package determines EVERYTHING required to perform that work
 * — a single, immutable, frozen bundle Dispatch (a future checkpoint)
 * will consume without recalculating any planning. Every engine here is
 * a pure, deterministic function over already-computed data — no AI, no
 * randomness, no dispatch, no live execution, no GPS, no route
 * optimization, no automated execution.
 *
 * An `ExecutionSnapshot` never re-derives planning data — it's a plain
 * copy of already-real `ExecutionPhase[]`/`Milestone[]`/`Deliverable[]`/
 * `EvidenceRequirement[]`/`PlanChecklist[]`/`ApprovalRequirement[]`
 * (reused directly from `types/operationalPlanning.ts`) and
 * `AllocationCandidate[]`/`ResourceBundle`/`DependencyCheckResult[]`/
 * `ResourcePoolSnapshot` (reused directly from `types/allocation.ts`) —
 * the exact values a real `OperationalPlan`/`Allocation` carried at
 * snapshot time, frozen by value, never a live reference back to either.
 */

// ---- Package lifecycle ----

export const EXECUTION_STATUSES = ["draft", "validated", "approved", "archived"] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/** Reuses `AppointmentPriority`'s exact scale — a package's urgency is the same concept as the appointment/allocation it was built from. */
export type ExecutionPriority = AppointmentPriority;

/** `"operational_plan_derived"` is the common path — a package built from one specific approved `OperationalPlan` + its `Allocation`/`Appointment`. `"system_generated"` is reserved vocabulary for a future automated trigger (e.g. a Workflow/Automation rule); never emitted this checkpoint — disclosed in `docs/package-builder.md`, not silently omitted. */
export const EXECUTION_SOURCES = ["manual", "operational_plan_derived", "system_generated"] as const;
export type ExecutionSource = (typeof EXECUTION_SOURCES)[number];

/** Reuses `PlanContextType` directly — a package's primary context (e.g. an Event) is the same concept as the Operational Plan's own context, copied at build time. */
export type ExecutionContextType = PlanContextType;

/**
 * Everything Step 2's "Build packages from... Customer, Location,
 * Workspace, Priority" names, minus `workspace_id` (already the
 * package's own top-level field — every entity in this codebase carries
 * one, and duplicating it here would be redundant, not a second source
 * of truth).
 */
export interface ExecutionContext {
  context_type: ExecutionContextType;
  context: KnowledgeNodeRef | null;
  /** The real Client this execution is for, when one exists — reused from the source Operational Plan/Allocation Request, never re-resolved independently. */
  customer: KnowledgeNodeRef | null;
  /** Freeform display text, the same deliberately-not-a-real-geocoding-concept precedent `Appointment.location_placeholder`/`AllocationRequest.location_placeholder` established — this checkpoint never estimates travel time or distance from it. */
  location_placeholder: string | null;
  priority: ExecutionPriority;
}

export interface ExecutionMetadata {
  title: string;
  notes: string | null;
  tags: string[];
}

// ---- Execution Instructions (Step 7) ----

export const EXECUTION_INSTRUCTION_SECTIONS = ["preparation", "arrival", "execution", "cleanup", "completion"] as const;
export type ExecutionInstructionSection = (typeof EXECUTION_INSTRUCTION_SECTIONS)[number];

export interface ExecutionInstructionLine {
  section: ExecutionInstructionSection;
  text: string;
}

export interface ExecutionInstructions {
  sections: ExecutionInstructionLine[];
  safety_notes: string[];
  customer_notes: string[];
  equipment_notes: string[];
  vehicle_notes: string[];
  special_instructions: string[];
}

// ---- Package Attachments (Step 8, references only — no uploads) ----

export const EXECUTION_ATTACHMENT_TYPES = ["operational_plan", "checklist_template", "evidence_requirement", "deliverable", "customer_note", "maps_placeholder", "file_placeholder", "document_placeholder", "media_placeholder"] as const;
export type ExecutionAttachmentType = (typeof EXECUTION_ATTACHMENT_TYPES)[number];

export interface ExecutionAttachment {
  id: string;
  type: ExecutionAttachmentType;
  label: string;
  /** The real entity id this attachment references (e.g. an `OperationalPlan.id`, a `ChecklistTemplate.id`) — `null` for the four pure placeholders (`maps_placeholder`/`file_placeholder`/`document_placeholder`/`media_placeholder`), which name a future capability rather than referencing anything real. */
  reference_id: string | null;
  note: string | null;
}

// ---- Execution Snapshot (Steps 1 + 3) — frozen planning data, never live ----

export interface ExecutionSnapshot {
  id: string;
  captured_at: string;
  // Allocation
  allocation_id: string | null;
  allocation_strategy: AllocationStrategy | null;
  allocation_candidates: AllocationCandidate[];
  // Schedule
  appointment_id: string | null;
  scheduled_starts_at: string | null;
  scheduled_ends_at: string | null;
  calendar_id: string | null;
  // Operational Plan
  operational_plan_id: string | null;
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidence_requirements: EvidenceRequirement[];
  checklists: PlanChecklist[];
  approvals: ApprovalRequirement[];
  // Bundles
  bundle_id: string | null;
  bundle_snapshot: ResourceBundle | null;
  // Dependencies
  dependency_checks: DependencyCheckResult[];
  // Worker Candidates + Resource Pool
  resource_pool: ResourcePoolSnapshot | null;
}

// ---- Execution Version (Step 9) — one immutable, append-only entry ----

export interface ExecutionVersion {
  id: string;
  package_id: string;
  workspace_id: string;
  version_number: number;
  snapshot: ExecutionSnapshot;
  instructions: ExecutionInstructions;
  attachments: ExecutionAttachment[];
  /** Step 9's "Version Notes" — freeform, set by whoever created this version. */
  notes: string | null;
  /** Why this version was created (e.g. "Allocation re-proposed after a worker became unavailable") — distinct from `notes`, always set by the caller creating the version. */
  reason: string | null;
  created_by: string;
  created_at: string;
}

// ---- Execution Package (Step 1) — the mutable shell around immutable versions ----

export interface ExecutionPackage {
  id: string;
  workspace_id: string;
  metadata: ExecutionMetadata;
  context: ExecutionContext;
  source: ExecutionSource;
  status: ExecutionStatus;
  /** `null` only before the very first version exists — every real package has at least one version the moment it's created. */
  current_version_id: string | null;
  /** Append-only — a version is never mutated or removed after creation, only ever added. "Version Restore" (Step 9) is a disclosed placeholder: pointing `current_version_id` back at an older entry is meaningful (packages have no mutable draft to restore *into*, unlike a Workflow), so no restore action is wired this checkpoint — see `docs/package-versioning.md`. */
  versions: ExecutionVersion[];
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  archived_at: string | null;
}

// ---- Computed results (never stored) ----

export interface PackageValidationIssue {
  rule: string;
  detail: string;
}

export interface PackageValidationResult {
  valid: boolean;
  errors: PackageValidationIssue[];
  warnings: PackageValidationIssue[];
}

export interface PackageHealthScores {
  planningHealth: number;
  allocationHealth: number;
  operationalHealth: number;
  dependencyHealth: number;
  bundleHealth: number;
  evidenceCoverage: number;
  checklistCoverage: number;
  overallPackageHealth: number;
}

export interface PackageExplanation {
  summary: string;
  whyPassed: string[];
  whyFailed: string[];
  missingResources: string[];
  missingEvidence: string[];
  missingApprovals: string[];
  brokenDependencies: string[];
  missingDeliverables: string[];
  healthCalculations: string[];
}

export const PACKAGE_READINESS_STATES = ["ready", "blocked", "incomplete", "waiting_approval", "waiting_resources", "waiting_schedule", "waiting_dependencies", "waiting_evidence"] as const;
export type PackageReadinessState = (typeof PACKAGE_READINESS_STATES)[number];

export interface PackageReadinessResult {
  state: PackageReadinessState;
  reasons: string[];
}

export interface ExecutionPackageResult {
  package: ExecutionPackage;
  version: ExecutionVersion;
  validation: PackageValidationResult;
  health: PackageHealthScores;
  explanation: PackageExplanation;
  readiness: PackageReadinessResult;
}

export const PACKAGE_RISK_LEVELS = ["low", "medium", "high"] as const;
export type PackageRiskLevel = (typeof PACKAGE_RISK_LEVELS)[number];

export interface ExecutionVersionComparisonResult {
  versionANumber: number;
  versionBNumber: number;
  changes: string[];
  dependencyChanges: string[];
  instructionChanges: string[];
  resourceChanges: string[];
  healthA: PackageHealthScores;
  healthB: PackageHealthScores;
  riskA: PackageRiskLevel;
  riskB: PackageRiskLevel;
}

export const PACKAGE_FINDING_TYPES = ["package_ready", "package_incomplete", "package_invalid", "missing_requirement", "version_drift", "operational_risk", "planning_risk"] as const;
export type PackageFindingType = (typeof PACKAGE_FINDING_TYPES)[number];

export const PACKAGE_FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type PackageFindingSeverity = (typeof PACKAGE_FINDING_SEVERITIES)[number];

export interface PackageFinding {
  id: string;
  type: PackageFindingType;
  severity: PackageFindingSeverity;
  description: string;
  relatedPackageId: string | null;
}
