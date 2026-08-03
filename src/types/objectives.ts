import type { KnowledgeNodeRef, KnowledgeNodeType, RelationshipRole, RelationshipType } from "@/types/knowledgeGraph";
import type { OperationalRecommendation } from "@/types/businessHealth";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 25, Step 15.6 — Operational Objectives Layer. Objectives
 * are goals scoped to an entity ("this Event must be ready", "this
 * Collection must be complete"), evaluated continuously against already-
 * computed operational state — never a task list, never a workflow. See
 * `docs/operational-objectives.md` for the full "why" behind every
 * decision below.
 */

export const OBJECTIVE_SCOPES = ["workspace", "department", "client", "event", "project", "collection", "asset", "custom"] as const;
export type ObjectiveScope = (typeof OBJECTIVE_SCOPES)[number];

/**
 * `department` and `project` are named scopes in the spec but have no
 * corresponding `KnowledgeNodeType` anywhere in this codebase — BloomOS
 * has no Department or Project entity. Rather than inventing one (which
 * the Knowledge Graph's own "don't fabricate node types" discipline
 * forbids), objectives with these two scopes always have `node: null` and
 * are identified purely by their own `id` + `label`. Their requirements
 * still evaluate normally — a requirement's own `counterpartNodeType`
 * targets a real node regardless of what the parent objective is anchored to.
 */
export const OBJECTIVE_SCOPES_WITH_NO_NODE: readonly ObjectiveScope[] = ["department", "project", "custom"];

export const OBJECTIVE_STATUSES = ["not_started", "in_progress", "completed", "blocked", "archived"] as const;
/** Deliberately 5, not the spec's 6 — "Overdue" is never stored. It's a time-dependent overlay derived fresh from `dueDate` by `objectiveEngine.deriveEffectiveStatus`, exactly like `RelationshipStatus` (stored) vs. Step 15.5's `notApplicableReason` (computed) are kept separate elsewhere in this checkpoint. Storing "overdue" as a persisted value would let it go stale the moment the clock ticks past `dueDate` without a write. */
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const OBJECTIVE_EFFECTIVE_STATUSES = [...OBJECTIVE_STATUSES, "overdue"] as const;
export type ObjectiveEffectiveStatus = (typeof OBJECTIVE_EFFECTIVE_STATUSES)[number];

export const OBJECTIVE_REQUIREMENT_TYPES = [
  "required_assets",
  "required_documents",
  "required_approvals",
  "required_relationships",
  "required_metadata",
  "required_tags",
  "required_timeline_activity",
  "required_communication",
  "required_deliverables",
  "required_business_rules",
] as const;
export type ObjectiveRequirementType = (typeof OBJECTIVE_REQUIREMENT_TYPES)[number];

interface ObjectiveRequirementBase {
  id: string;
  description: string;
}

/**
 * `required_assets`/`required_documents`/`required_deliverables` all
 * count matching Knowledge Graph relationships the exact same way
 * `relationshipConstraintsEngine.edgeCountsForRule` already does (Step
 * 10.7) — this is the same shape as `RelationshipConstraintRule` on
 * purpose, so `progressEngine.ts` can call that exported helper directly
 * instead of re-deriving a second counting mechanism. "Deliverable" has no
 * dedicated flag anywhere in the data model; it's the same graph-edge
 * count as an Asset/Document requirement, just labeled for what the
 * objective author means by it — not a fabricated new concept.
 */
interface GraphCountRequirement extends ObjectiveRequirementBase {
  type: "required_assets" | "required_documents" | "required_deliverables" | "required_relationships";
  relationshipType: RelationshipType;
  direction: "outbound" | "inbound";
  counterpartNodeType: KnowledgeNodeType;
  requiredRole: RelationshipRole | null;
  minCount: number;
}

/** Resolved by the caller into a named boolean flag (`objectivesActions.ts` reads `ProposalDraft.reviewed_at`/`Contract.signature_status`/`MediaAsset.status`) — `progressEngine.ts` never imports Proposal/Contract/MediaAsset types itself, staying a pure function over an already-resolved flag bag, same discipline as `readinessEngine.ts` taking a pre-computed `CompletenessResult` instead of raw entities. */
interface ApprovalRequirement extends ObjectiveRequirementBase {
  type: "required_approvals";
  approvalKey: string;
}

/** Checks `MediaAsset.metadata[metadataField]` is set — reuses Step 4's Metadata Engine fields, never a new metadata concept. */
interface MetadataRequirement extends ObjectiveRequirementBase {
  type: "required_metadata";
  metadataField: string;
}

/** Checks `MediaAsset.tags` (Step 5's Tagging System) contains every listed tag. */
interface TagsRequirement extends ObjectiveRequirementBase {
  type: "required_tags";
  requiredTags: string[];
}

/** Counts `TimelineActivity` rows already recorded for the objective's node — the audit trail this checkpoint has used everywhere else, never a new activity log. */
interface TimelineActivityRequirement extends ObjectiveRequirementBase {
  type: "required_timeline_activity";
  timelineActivityType: TimelineActivityType;
  minCount: number;
}

/** Counts real `Comment` rows for the objective's node via Checkpoint 24's Comments System (`core/comments`), never a new communication concept. */
interface CommunicationRequirement extends ObjectiveRequirementBase {
  type: "required_communication";
  minCommentCount: number;
}

/** `businessRuleId: null` means "zero `BusinessRuleViolation`s of any kind for this node"; a specific id means "this particular rule must not be violated." Reuses `businessRuleEngine.ts` (Step 15.5) — never a second validation engine. */
interface BusinessRuleRequirement extends ObjectiveRequirementBase {
  type: "required_business_rules";
  businessRuleId: string | null;
}

export type ObjectiveRequirement =
  | GraphCountRequirement
  | ApprovalRequirement
  | MetadataRequirement
  | TagsRequirement
  | TimelineActivityRequirement
  | CommunicationRequirement
  | BusinessRuleRequirement;

export const OBJECTIVE_DEPENDENCY_KINDS = ["objective", "business_rule", "knowledge_relationship", "approval", "asset", "collection", "client", "event"] as const;
export type ObjectiveDependencyKind = (typeof OBJECTIVE_DEPENDENCY_KINDS)[number];

/**
 * A dependency gates whether an objective can reach `completed` — it never
 * re-declares how the dependency itself is satisfied. `objective` reuses
 * the dependency target's own computed status; `business_rule` reuses
 * `businessRuleEngine.ts`; `knowledge_relationship`/`asset`/`collection`/
 * `client`/`event` reuse the exact "is this node in the caller's
 * `existingNodeKeys` set" check `knowledgeHealthEngine`/
 * `orphanDetectionEngine` already established; `approval` reuses the same
 * `approvalKey` flag bag `ApprovalRequirement` uses.
 */
export interface ObjectiveDependency {
  id: string;
  kind: ObjectiveDependencyKind;
  description: string;
  targetObjectiveId: string | null;
  targetNode: KnowledgeNodeRef | null;
  businessRuleId: string | null;
  approvalKey: string | null;
}

export interface Objective {
  id: string;
  workspace_id: string;
  scope: ObjectiveScope;
  /** `null` exactly for `department`/`project`/`custom` scopes — see `OBJECTIVE_SCOPES_WITH_NO_NODE`. */
  node: KnowledgeNodeRef | null;
  title: string;
  description: string | null;
  status: ObjectiveStatus;
  requirements: ObjectiveRequirement[];
  dependencies: ObjectiveDependency[];
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ObjectiveProgress {
  objectiveId: string;
  completionPercent: number;
  missingRequirements: string[];
  blockingIssues: string[];
  remainingTasks: string[];
  /** A rounded restatement of `completionPercent` for display — kept as its own field because the spec names it as a distinct concept ("Estimated Progress") even though this checkpoint has no separate estimation model (no AI, no predictions, per this step's own stop condition). */
  estimatedProgress: number;
}

export const OBJECTIVE_HEALTH_STATES = ["on_track", "at_risk", "off_track", "blocked"] as const;
export type ObjectiveHealthState = (typeof OBJECTIVE_HEALTH_STATES)[number];

export interface ObjectiveHealth {
  objectiveId: string;
  state: ObjectiveHealthState;
  effectiveStatus: ObjectiveEffectiveStatus;
  reasons: string[];
  recommendations: OperationalRecommendation[];
}

export interface WorkspaceScorecard {
  objectivesCompleted: number;
  objectivesBlocked: number;
  objectivesOverdue: number;
  averageCompletion: number;
  operationalProgress: number;
  /** Direct reuse of `BusinessHealthReport.overallScore` (Step 15.5) — never recomputed here. */
  businessReadiness: number;
  overallOperationalScore: number;
  evaluatedAt: string;
}
