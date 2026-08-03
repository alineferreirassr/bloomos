import type { DecisionPriority } from "./executiveDecisions";

/**
 * v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform.
 *
 * The Client Journey layer coordinates and explains state that already
 * lives in Leads/Clients/Proposals/Contracts/Invoices/Events/Documents/
 * Client Portal/Communication/Timeline — it is never a second source of
 * truth for any of them. Almost every type below describes a *computed*
 * read model (recomputed on every evaluation, never persisted); only
 * `JourneyTransitionRecord`, `JourneyOwnerAssignment`, and
 * `ClientInformationRequest` are genuinely new, persisted entities —
 * the same "persist only what cannot be re-derived" discipline
 * `OperationalAlert`/`OperationalIncident` established in Checkpoint 31.
 */

// ---------------------------------------------------------------------------
// Journey Stage (Step 2) — 29 default stages, fixed literal union for the
// transition/requirement/blocker logic. Workspace-specific *display labels*
// and *optional custom stages* are supported additively (see
// `JourneyStageLabelOverride`/`OPTIONAL_JOURNEY_STAGES`) without touching
// this core union, so the deterministic transition model never has to
// branch on workspace configuration.
// ---------------------------------------------------------------------------

export const JOURNEY_STAGES = [
  "new_lead",
  "contacted",
  "qualified",
  "discovery",
  "proposal_preparation",
  "proposal_sent",
  "negotiation",
  "proposal_accepted",
  "contract_preparation",
  "contract_sent",
  "contract_signed",
  "invoice_preparation",
  "invoice_sent",
  "deposit_pending",
  "deposit_paid",
  "welcome",
  "portal_activated",
  "planning",
  "ready_for_service",
  "service_in_progress",
  "service_completed",
  "final_balance_pending",
  "closed",
  "follow_up",
  "review_requested",
  "review_received",
  "rebooking_opportunity",
  "lost",
  "cancelled",
] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/** Optional stages that a journey may pass through but that are never required for progress-completion purposes. */
export const OPTIONAL_JOURNEY_STAGES: readonly JourneyStage[] = ["discovery", "negotiation", "review_requested", "review_received", "rebooking_opportunity"];

/** Terminal stages — a journey in one of these never has a "next" stage computed for it. */
export const TERMINAL_JOURNEY_STAGES: readonly JourneyStage[] = ["closed", "lost", "cancelled"];

export const JOURNEY_STAGE_DEFAULT_LABELS: Record<JourneyStage, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  qualified: "Qualified",
  discovery: "Discovery",
  proposal_preparation: "Proposal Preparation",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  proposal_accepted: "Proposal Accepted",
  contract_preparation: "Contract Preparation",
  contract_sent: "Contract Sent",
  contract_signed: "Contract Signed",
  invoice_preparation: "Invoice Preparation",
  invoice_sent: "Invoice Sent",
  deposit_pending: "Deposit Pending",
  deposit_paid: "Deposit Paid",
  welcome: "Welcome",
  portal_activated: "Portal Activated",
  planning: "Planning",
  ready_for_service: "Ready for Service",
  service_in_progress: "Service in Progress",
  service_completed: "Service Completed",
  final_balance_pending: "Final Balance Pending",
  closed: "Closed",
  follow_up: "Follow-Up",
  review_requested: "Review Requested",
  review_received: "Review Received",
  rebooking_opportunity: "Rebooking Opportunity",
  lost: "Lost",
  cancelled: "Cancelled",
};

/** A workspace's own display label for a stage — never changes the stage id itself or its position in the transition model. */
export interface JourneyStageLabelOverride {
  stage: JourneyStage;
  label: string;
}

// ---------------------------------------------------------------------------
// Journey Step — the 14 coarse groupings named in the spec's own Objective
// section (First Contact ... Rebooking). Every JourneyStage maps to exactly
// one JourneyStep; JourneyStep exists purely for grouped display, never for
// its own transition logic.
// ---------------------------------------------------------------------------

export const JOURNEY_STEPS = [
  "first_contact",
  "qualification",
  "discovery",
  "proposal",
  "contract",
  "invoice",
  "welcome",
  "client_portal_access",
  "planning",
  "service_delivery",
  "completion",
  "follow_up",
  "review",
  "rebooking",
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export const JOURNEY_STAGE_TO_STEP: Record<JourneyStage, JourneyStep> = {
  new_lead: "first_contact",
  contacted: "first_contact",
  qualified: "qualification",
  discovery: "discovery",
  proposal_preparation: "proposal",
  proposal_sent: "proposal",
  negotiation: "proposal",
  proposal_accepted: "proposal",
  contract_preparation: "contract",
  contract_sent: "contract",
  contract_signed: "contract",
  invoice_preparation: "invoice",
  invoice_sent: "invoice",
  deposit_pending: "invoice",
  deposit_paid: "invoice",
  welcome: "welcome",
  portal_activated: "client_portal_access",
  planning: "planning",
  ready_for_service: "planning",
  service_in_progress: "service_delivery",
  service_completed: "completion",
  final_balance_pending: "completion",
  closed: "completion",
  follow_up: "follow_up",
  review_requested: "review",
  review_received: "review",
  rebooking_opportunity: "rebooking",
  lost: "first_contact",
  cancelled: "first_contact",
};

// ---------------------------------------------------------------------------
// Journey Status — the top-level state of the whole journey, distinct from
// which stage it is currently in.
// ---------------------------------------------------------------------------

export const JOURNEY_STATUSES = ["active", "at_risk", "blocked", "completed", "lost", "cancelled"] as const;
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];

/** Reused, not reinvented — Journey blockers/risks sit at the same executive altitude as Executive Decisions and Operations Center alerts. */
export type JourneySeverity = DecisionPriority;

export type JourneySubjectType = "lead" | "client";

// ---------------------------------------------------------------------------
// Journey Requirements (Step 5)
// ---------------------------------------------------------------------------

export interface JourneyRequirementResult {
  key: string;
  label: string;
  stage: JourneyStage;
  met: boolean;
  sourceModule: string;
  sourceRecordId: string | null;
  detail: string;
}

// ---------------------------------------------------------------------------
// Journey Blockers (Step 6)
// ---------------------------------------------------------------------------

export const JOURNEY_BLOCKER_TYPES = [
  "missing_contact_information",
  "lead_not_qualified",
  "proposal_incomplete",
  "proposal_not_accepted",
  "contract_missing",
  "contract_unsigned",
  "invoice_missing",
  "deposit_unpaid",
  "final_balance_unpaid",
  "missing_portal_access",
  "missing_client_documents",
  "missing_approval",
  "missing_event_information",
  "missing_operational_plan",
  "missing_execution_package",
  "client_response_pending",
  "internal_follow_up_overdue",
] as const;
export type JourneyBlockerType = (typeof JOURNEY_BLOCKER_TYPES)[number];

export interface JourneyBlocker {
  id: string;
  type: JourneyBlockerType;
  stage: JourneyStage;
  severity: JourneySeverity;
  sourceModule: string;
  sourceRecordId: string | null;
  description: string;
  suggestedNextAction: string;
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Journey Milestones & Progress (Step 7)
// ---------------------------------------------------------------------------

export interface JourneyMilestone {
  stage: JourneyStage;
  label: string;
  weight: number;
  completed: boolean;
  completedAt: string | null;
}

export interface JourneyProgress {
  overallPercentage: number;
  currentStageProgress: number;
  completedStages: JourneyStage[];
  remainingRequiredStages: JourneyStage[];
  optionalStages: JourneyStage[];
  blockedStages: JourneyStage[];
  skippedStages: JourneyStage[];
  weightingMethod: string;
}

// ---------------------------------------------------------------------------
// Journey Health (Step 8)
// ---------------------------------------------------------------------------

export interface JourneyHealth {
  leadHealth: number;
  proposalHealth: number;
  contractHealth: number;
  invoiceHealth: number;
  paymentHealth: number;
  communicationHealth: number;
  portalHealth: number;
  planningHealth: number;
  operationalReadiness: number;
  clientResponseHealth: number;
  overallJourneyHealth: number;
}

// ---------------------------------------------------------------------------
// Journey Transitions (Step 4) — persisted append-only log.
// ---------------------------------------------------------------------------

export const JOURNEY_TRANSITION_TYPES = ["allowed", "blocked", "skipped_optional", "reopened", "cancelled", "lost", "restored"] as const;
export type JourneyTransitionType = (typeof JOURNEY_TRANSITION_TYPES)[number];

export interface JourneyTransitionRecord {
  id: string;
  workspaceId: string;
  subjectType: JourneySubjectType;
  subjectId: string;
  type: JourneyTransitionType;
  previousStage: JourneyStage | null;
  newStage: JourneyStage;
  trigger: string;
  sourceRecordId: string | null;
  actingMemberId: string | null;
  blockingRules: string[];
  createdAt: string;
}

export interface RecordJourneyTransitionInput {
  workspaceId: string;
  subjectType: JourneySubjectType;
  subjectId: string;
  type: JourneyTransitionType;
  previousStage: JourneyStage | null;
  newStage: JourneyStage;
  trigger: string;
  sourceRecordId?: string | null;
  actingMemberId?: string | null;
  blockingRules?: string[];
}

// ---------------------------------------------------------------------------
// Journey Ownership (Step 13) — persisted role assignments.
// ---------------------------------------------------------------------------

export const JOURNEY_OWNER_ROLES = ["primary", "sales", "client_care", "operations", "finance", "document"] as const;
export type JourneyOwnerRole = (typeof JOURNEY_OWNER_ROLES)[number];

export interface JourneyOwnerAssignment {
  role: JourneyOwnerRole;
  memberId: string | null;
  assignedAt: string | null;
  assignedByMemberId: string | null;
}

export interface JourneyOwnerRecord {
  id: string;
  workspaceId: string;
  subjectType: JourneySubjectType;
  subjectId: string;
  role: JourneyOwnerRole;
  memberId: string;
  assignedAt: string;
  assignedByMemberId: string | null;
}

// ---------------------------------------------------------------------------
// Next Best Action (Step 9)
// ---------------------------------------------------------------------------

export const NEXT_BEST_ACTION_TYPES = [
  "send_first_contact_message",
  "complete_qualification",
  "schedule_discovery_placeholder",
  "finish_proposal",
  "send_proposal",
  "follow_up_on_proposal",
  "create_contract",
  "send_contract",
  "request_signature",
  "create_invoice",
  "send_invoice",
  "follow_up_on_deposit",
  "activate_client_portal",
  "send_welcome_message",
  "request_missing_information",
  "prepare_service_instructions",
  "request_final_payment",
  "send_completion_message",
  "request_review",
  "create_rebooking_opportunity",
] as const;
export type NextBestActionType = (typeof NEXT_BEST_ACTION_TYPES)[number];

export interface NextBestAction {
  id: string;
  type: NextBestActionType;
  label: string;
  reason: string;
  priority: JourneySeverity;
  sourceStage: JourneyStage;
  requiredPermission: string;
  deepLink: string | null;
  relatedSubjectType: JourneySubjectType;
  relatedSubjectId: string;
  relatedSourceRecordId: string | null;
}

// ---------------------------------------------------------------------------
// Journey Risk (Step 21)
// ---------------------------------------------------------------------------

export const JOURNEY_RISK_TYPES = [
  "lead_going_cold",
  "proposal_stalled",
  "contract_stalled",
  "invoice_overdue",
  "deposit_delayed",
  "client_unresponsive",
  "planning_delayed",
  "portal_not_activated",
  "missing_documents",
  "final_balance_risk",
  "review_opportunity_missed",
  "rebooking_opportunity_missed",
] as const;
export type JourneyRiskType = (typeof JOURNEY_RISK_TYPES)[number];

export interface JourneyRisk {
  id: string;
  type: JourneyRiskType;
  severity: JourneySeverity;
  stage: JourneyStage;
  description: string;
  sourceRecordId: string | null;
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Journey Analytics (Step 20)
// ---------------------------------------------------------------------------

export interface JourneyAnalyticsSnapshot {
  leadToClientConversionRate: number;
  proposalAcceptanceRate: number;
  contractSignatureRate: number;
  depositCompletionRate: number;
  averageTimePerStageDays: Partial<Record<JourneyStage, number>>;
  dropOffPoints: { stage: JourneyStage; count: number }[];
  blockedJourneyCount: number;
  averageJourneyDurationDays: number;
  followUpCompletionRate: number;
  reviewCompletionRate: number;
  rebookingOpportunityRate: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Client Information Requests (Step 15) — persisted.
// ---------------------------------------------------------------------------

export const INFORMATION_REQUEST_STATUSES = ["pending", "fulfilled", "overdue", "cancelled"] as const;
export type InformationRequestStatus = (typeof INFORMATION_REQUEST_STATUSES)[number];

export interface ClientInformationRequest {
  id: string;
  workspaceId: string;
  clientId: string;
  title: string;
  description: string;
  requiredFields: string[];
  requiredDocuments: string[];
  dueDate: string | null;
  status: InformationRequestStatus;
  clientResponse: string | null;
  internalNotes: string | null;
  relatedJourneyStage: JourneyStage | null;
  relatedEventId: string | null;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
}

export interface CreateInformationRequestInput {
  workspaceId: string;
  clientId: string;
  title: string;
  description: string;
  requiredFields?: string[];
  requiredDocuments?: string[];
  dueDate?: string | null;
  relatedJourneyStage?: JourneyStage | null;
  relatedEventId?: string | null;
}

// ---------------------------------------------------------------------------
// Journey Context (Step 22) — deterministic Bloom AI context bundle.
// ---------------------------------------------------------------------------

export interface JourneyContext {
  journeySummary: string;
  currentStage: JourneyStage;
  progressPercentage: number;
  blockers: string[];
  nextActions: string[];
  recentActivity: string[];
  communicationSummary: string;
  relatedCommercialRecords: { type: string; id: string }[];
  relatedOperationalRecords: { type: string; id: string }[];
}

// ---------------------------------------------------------------------------
// The composed, computed-fresh read model.
// ---------------------------------------------------------------------------

export interface ClientJourney {
  subjectType: JourneySubjectType;
  subjectId: string;
  workspaceId: string;
  displayName: string;
  currentStage: JourneyStage;
  status: JourneyStatus;
  progress: JourneyProgress;
  health: JourneyHealth;
  milestones: JourneyMilestone[];
  requirements: JourneyRequirementResult[];
  blockers: JourneyBlocker[];
  risks: JourneyRisk[];
  nextBestActions: NextBestAction[];
  owners: JourneyOwnerAssignment[];
  context: JourneyContext;
  evaluatedAt: string;
}
