import type { KnowledgeNodeRef, KnowledgeNodeType } from "@/types/knowledgeGraph";
import type { AvailabilityStatus, EmploymentType, ExperienceLevel } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26.1 — Workforce Capability & Eligibility Platform.
 * Determines which workers are genuinely qualified and operationally
 * ready to perform a specific work requirement. Deliberately NOT
 * scheduling, dispatch, or route optimization — see `docs/workforce-capabilities.md`
 * for the full "why" behind every decision below. No randomness, no AI:
 * every result here is a disclosed, deterministic function over
 * already-computed Checkpoint 26 data (Workers, Teams, Availability,
 * Assignments, Equipment, Vehicles, Location).
 */

export const CAPABILITY_CONTEXT_TYPES = ["event", "client", "project_placeholder", "assignment", "asset", "equipment", "vehicle", "vendor", "team", "workspace", "custom"] as const;
export type CapabilityContextType = (typeof CAPABILITY_CONTEXT_TYPES)[number];

/**
 * `project_placeholder`, `assignment`, and `custom` have no real
 * `KnowledgeNodeType` in this codebase — same "don't fabricate a node
 * type" discipline `types/objectives.ts`'s `OBJECTIVE_SCOPES_WITH_NO_NODE`
 * and `types/workforce.ts`'s `ASSIGNABLE_TYPE_TO_NODE_TYPE` gap already
 * established. `Assignment` (the row, not the concept) has no dedicated
 * Knowledge Graph node either — it's an edge-producing record, not a node
 * itself. Requirements with these three context types always have
 * `context: null` and are identified purely by their own `id`/`title`.
 */
export const CAPABILITY_CONTEXTS_WITH_NO_NODE: readonly CapabilityContextType[] = ["project_placeholder", "assignment", "custom"];

export const CAPABILITY_CONTEXT_TYPE_TO_NODE_TYPE: Partial<Record<CapabilityContextType, KnowledgeNodeType>> = {
  event: "event",
  client: "client",
  asset: "media_asset",
  equipment: "equipment",
  vehicle: "vehicle",
  vendor: "vendor",
  team: "team",
  workspace: "workspace",
};

export const CUSTOM_RULE_FIELDS = ["worker_role", "employment_type", "team_id", "experience_level", "worker_status"] as const;
export type CustomRuleField = (typeof CUSTOM_RULE_FIELDS)[number];

export const CUSTOM_RULE_OPERATORS = ["equals", "not_equals", "in", "not_in"] as const;
export type CustomRuleOperator = (typeof CUSTOM_RULE_OPERATORS)[number];

/**
 * A small, closed, declarative rule DSL — never arbitrary code. Every
 * `CapabilityCustomRule` is evaluated by comparing one named `Worker`
 * field against a literal value; there is no `eval`, no expression
 * parser, and no way to reference anything outside this fixed field
 * list. This is what "Custom Deterministic Rules" honestly means here.
 */
export interface CapabilityCustomRule {
  id: string;
  field: CustomRuleField;
  operator: CustomRuleOperator;
  value: string | string[];
  description: string;
}

export interface CapabilityLocationRequirement {
  latitude: number;
  longitude: number;
  label: string | null;
}

/**
 * The full requirement model. Every list field defaults to `[]` (no
 * constraint), every scalar to `null` (no constraint) — a brand-new
 * requirement with every optional field empty matches every active
 * worker, which is the correct, honest default rather than an implicit
 * "matches nobody."
 */
export interface CapabilityRequirement {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  context_type: CapabilityContextType;
  /** `null` exactly for `CAPABILITY_CONTEXTS_WITH_NO_NODE` context types. */
  context: KnowledgeNodeRef | null;

  required_skills: string[];
  preferred_skills: string[];
  required_certifications: string[];
  preferred_certifications: string[];
  required_languages: string[];
  preferred_languages: string[];
  minimum_experience_level: ExperienceLevel | null;

  required_equipment_types: string[];
  preferred_equipment_types: string[];
  required_vehicle_types: string[];
  preferred_vehicle_types: string[];

  required_availability_statuses: AvailabilityStatus[];
  required_employment_types: EmploymentType[];
  required_team_id: string | null;
  /** Soft counterpart to `required_team_id` — Step 5 names "Preferred Team" as its own preference; Step 1's field list only named the hard `required_team_id`, so this is a small, disclosed additive field rather than overloading the hard one. */
  preferred_team_id: string | null;
  /** Soft counterpart to `minimum_experience_level` — same "Step 5 names it, Step 1 didn't" gap as `preferred_team_id`. */
  preferred_experience_level: ExperienceLevel | null;
  excluded_worker_ids: string[];
  excluded_team_ids: string[];

  required_time_zone: string | null;
  maximum_distance_km: number | null;
  location_requirement: CapabilityLocationRequirement | null;

  /** How many distinct eligible-or-conditionally-eligible workers this requirement needs — feeds `CapabilityScoreEngine`'s capacity score and `CapabilityCoverageEngine`'s uncovered-requirement detection. `null` means "at least one," the same default every other unset constraint uses. */
  capacity_requirement: number | null;
  /** Freeform descriptive strings (e.g. "must be able to lift 50lbs") — this checkpoint has no verification mechanism for these, so they are surfaced for human review only and never gate eligibility. Disclosed in `docs/capability-requirements.md`, never silently enforced as if they were checked. */
  physical_requirements: string[];
  custom_rules: CapabilityCustomRule[];

  /** Set only when a hard skill/certification requirement must remain satisfied through a specific future date (Step 12's "must remain valid through a future work date") — `null` means the ordinary "valid as of the evaluation moment" rule applies. */
  required_valid_through_date: string | null;

  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export const ELIGIBILITY_STATES = ["eligible", "ineligible", "conditionally_eligible", "unknown"] as const;
export type EligibilityState = (typeof ELIGIBILITY_STATES)[number];

export interface CapabilityBlockingReason {
  /** Names the exact rule that blocked eligibility, e.g. `"required_skill:Rigging"`, `"certification_expired:OSHA 30"`, `"worker_status:on_leave"` — every blocking reason is traceable to one real check, never a bare message (spec Step 4). */
  rule: string;
  detail: string;
}

export interface CapabilityPreferenceMatch {
  rule: string;
  detail: string;
  matched: boolean;
}

/**
 * The full "why" behind one worker's evaluation against one requirement
 * (Step 7). Every field here answers one of the spec's own named
 * explanation questions — this is deliberately never collapsed into a
 * bare score.
 */
export interface CapabilityEligibility {
  requirementId: string;
  workerId: string;
  state: EligibilityState;
  blockingReasons: CapabilityBlockingReason[];
  satisfiedHardRequirements: string[];
  unsatisfiedHardRequirements: string[];
  matchedPreferences: CapabilityPreferenceMatch[];
  unmatchedPreferences: CapabilityPreferenceMatch[];
  expiringSoonCertifications: string[];
  unavailableResources: string[];
  /** Which fallback values were used (e.g. `"distance:unknown"` when the worker has no location snapshot) — never a silently-invented number. */
  fallbacksUsed: string[];
  evaluatedAt: string;
}

/**
 * Every score is 0-100. Direction is always "higher is better." A score
 * of 0 for a sub-dimension the requirement doesn't actually constrain
 * (e.g. `locationScore` when the requirement has no `location_requirement`)
 * would misrepresent "not applicable" as "worst possible" — those cases
 * resolve to 100 (fully satisfied, vacuously) instead, documented per
 * field in `docs/capability-scoring.md`.
 */
export interface CapabilityScores {
  requirementId: string;
  workerId: string;
  eligibilityScore: number;
  skillsMatchScore: number;
  certificationScore: number;
  experienceScore: number;
  languageScore: number;
  availabilityScore: number;
  equipmentScore: number;
  vehicleScore: number;
  locationScore: number;
  teamFitScore: number;
  capacityScore: number;
  preferenceScore: number;
  overallCapabilityScore: number;
}

/** Straight-line (haversine) distance only — no routing, no travel time. `kind: "unknown"` is the documented result when either party lacks a real coordinate; it is never silently treated as `0` (zero distance would read as "co-located," the opposite of unknown). */
export interface DistanceResult {
  kind: "known" | "unknown";
  distanceKm: number | null;
  reason: string | null;
}

export interface WorkerRankingEntry {
  workerId: string;
  eligibility: CapabilityEligibility;
  scores: CapabilityScores;
  /** 1-based; only assigned within the eligible + conditionally-eligible group. Ineligible workers keep `rank: null`. */
  rank: number | null;
}

export interface RequirementEvaluationResult {
  requirement: CapabilityRequirement;
  ranking: WorkerRankingEntry[];
  eligibleCount: number;
  conditionallyEligibleCount: number;
  ineligibleCount: number;
  evaluatedAt: string;
}

export interface CapabilityCoverageReport {
  workspace_id: string;
  skillsCoverage: Record<string, number>;
  certificationCoverage: Record<string, number>;
  languageCoverage: Record<string, number>;
  equipmentCoverage: Record<string, number>;
  vehicleCoverage: Record<string, number>;
  availableWorkersCount: number;
  activeTeamsCount: number;
  requirementCoverage: RequirementCoverageEntry[];
  uncoveredRequirementIds: string[];
  singleWorkerDependencies: SingleWorkerDependency[];
  singleEquipmentDependencies: string[];
  singleVehicleDependencies: string[];
  highRiskGapsCount: number;
  evaluatedAt: string;
}

export interface RequirementCoverageEntry {
  requirementId: string;
  eligibleCount: number;
  conditionallyEligibleCount: number;
  capacityRequirement: number | null;
  /** `eligibleCount + conditionallyEligibleCount < capacityRequirement` (or `< 1` when unset) — the same "uncovered" definition `CapabilityCoverageReport.uncoveredRequirementIds` uses. */
  meetsCapacity: boolean;
}

export interface SingleWorkerDependency {
  requirementId: string;
  workerId: string;
}

export const WORKFORCE_RISK_TYPES = [
  "no_eligible_worker",
  "single_eligible_worker",
  "all_eligible_unavailable",
  "expired_certification",
  "certification_expiring_soon",
  "missing_equipment_coverage",
  "missing_vehicle_coverage",
  "team_overreliance",
  "worker_overreliance",
  "worker_critical_capability_overload",
  "equipment_single_point_of_failure",
  "vehicle_single_point_of_failure",
] as const;
export type WorkforceRiskType = (typeof WORKFORCE_RISK_TYPES)[number];

export const WORKFORCE_RISK_SEVERITIES = ["low", "medium", "high"] as const;
export type WorkforceRiskSeverity = (typeof WORKFORCE_RISK_SEVERITIES)[number];

export interface WorkforceRisk {
  id: string;
  type: WorkforceRiskType;
  severity: WorkforceRiskSeverity;
  description: string;
  relatedRequirementId: string | null;
  relatedWorkerId: string | null;
  relatedEquipmentId: string | null;
  relatedVehicleId: string | null;
}
