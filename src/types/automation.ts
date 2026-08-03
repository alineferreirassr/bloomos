import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { EntityType } from "@/core/enums/entityType";

/**
 * Checkpoint 9 — the Automation Engine's own closed set of trigger types.
 * Deliberately closed (unlike Actions, see `AutomationActionDefinition`'s
 * own doc comment) — these are system-defined operational events, not
 * something a third party registers at runtime; new trigger types are rare
 * enough, and important enough to name explicitly, that a curated list
 * (the same "small closed set" bias `AICapability`/`AI_CONTEXT_SECTION_KEYS`
 * already use) beats an open string a typo could silently miss.
 *
 * Nothing in this checkpoint wires an external webhook to any of these —
 * every trigger fires from BloomOS's own code, explicitly, per the
 * checkpoint's own "do not execute automatically from external webhooks"
 * instruction.
 *
 * Checkpoint 14 (Client Portal, Step 10) adds `checklist_item.completed`,
 * `document.downloaded`, and `proposal.viewed` — the Portal only ever
 * dispatches these through this same closed channel (identical to
 * `proposal.accepted`/`proposal.rejected`), so it can never trigger
 * anything beyond what a staff member has already published as a real
 * Automation. The Portal itself never executes a Workflow directly.
 *
 * v2 Checkpoint 23 (Stripe Payments Platform, Step 15) is the first
 * checkpoint to intentionally dispatch a trigger from a real external
 * webhook — `payment.received`, `payment.failed`, `deposit.paid`,
 * `balance.paid`, `refund.issued` all fire from the Stripe inbound
 * webhook handler (`modules/integrations/stripe/webhookProcessing.ts`),
 * never directly from the raw Stripe payload. The handler verifies the
 * webhook's real signature first, updates BloomOS's own `Payment`/
 * `Invoice` records through the existing Finance repository functions,
 * and only then dispatches — the same "internal state changes first,
 * trigger fires from BloomOS's own resulting state" discipline every
 * other trigger in this list already follows; nothing here lets an
 * unverified external payload drive a Workflow directly.
 */
export const AUTOMATION_TRIGGER_TYPES = [
  "proposal.accepted",
  "proposal.rejected",
  "invoice.overdue",
  "invoice.paid",
  "contract.signed",
  "event.created",
  "event.updated",
  "event.completed",
  "daily_brief.generated",
  "crm_recommendation.accepted",
  "finance_recommendation.accepted",
  "memory.created",
  "client.created",
  "checklist_item.completed",
  "document.downloaded",
  "proposal.viewed",
  "payment.received",
  "payment.failed",
  "deposit.paid",
  "balance.paid",
  "refund.issued",
  /**
   * v2.0 Checkpoint 39 — Workflow & Automation Platform. The generic
   * bridge into the real Timeline: rather than adding a bespoke closed-enum
   * value for every one of the ~15 newer platforms (Dispatch, Operational
   * Planning, Execution Packages, Digital Assets, Vendors, Workforce,
   * Scheduling…), a single `"timeline_event"` trigger fires whenever any of
   * those platforms records a real Timeline activity, with `facts.activityType`
   * carrying which one (see `AUTOMATION_CONDITION_FIELDS`'s new `activityType`
   * field) — a Condition node narrows it to one specific activity type per
   * Automation. This is additive: every one of the 20 values above keeps
   * dispatching exactly as before; this is the one new, general-purpose
   * value. See `docs/workflow-platform.md`'s "Timeline Event trigger" section.
   */
  "timeline_event",
  // v2.0 Checkpoint 43 — External Integrations Platform. Real provider-
  // delivery moments, dispatched from `modules/integrations/
  // webhookEventProcessing.ts` once an inbound webhook's signature has
  // verified and been mapped by the provider's own `WebhookProvider.
  // mapInboundEvent()`. Discrete values (not folded into `timeline_event`)
  // because the checkpoint's own spec names each as a selectable Workflow
  // trigger in its own right, mirroring the `payment.*` precedent above.
  "calendar.event_changed",
  "email.delivered",
  "email.bounced",
  "sms.delivered",
  "sms.failed",
  "signature.completed",
  "signature.declined",
  "storage.file_synced",
  "connection.failed",
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number];

/**
 * The one payload shape every trigger carries — `facts` is a deterministic,
 * structured bag (an amount, a count, an id, a status), the same "never a
 * raw prompt, never a raw provider response" discipline
 * `core/ai/memory`'s own `AIMemoryEntry` already established for a
 * different reason. Never put a Note's freeform `content`, a Client's
 * sensitive fields, or any payment credential in here — `facts` is
 * persisted as part of a pending approval's own execution record (see
 * `AutomationExecution.triggerFacts`), so anything placed here is
 * effectively at-rest, structured data, not a transient argument.
 */
export interface AutomationTriggerEvent {
  type: AutomationTriggerType;
  workspaceId: string;
  occurredAt: string;
  /** The member whose action produced this trigger, or `null` for a system-originated one (e.g. an overdue-invoice sweep). */
  actorMemberId: string | null;
  facts: Record<string, string | number | boolean | null>;
}

export const AUTOMATION_CONDITION_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "notIn"] as const;
export type AutomationConditionOperator = (typeof AUTOMATION_CONDITION_OPERATORS)[number];

/**
 * Step 3's own examples, closed the same way trigger types are — every
 * field the Condition Engine knows how to read, either from the trigger's
 * own `facts` (`eventType`/`invoiceAmountMinor`/`daysOverdue`/
 * `proposalValueMinor`/`contractStatus`) or from the acting member's own
 * session (`role`/`workspaceId`), or from a live Feature Flag lookup
 * (`featureFlag`, the one field requiring an async check — see
 * `conditions.ts`). Never an AI prompt, never a model's own output —
 * "Conditions must remain deterministic" is enforced by construction: there
 * is no condition field through which a condition could even reference a
 * model's output.
 */
export const AUTOMATION_CONDITION_FIELDS = [
  "role",
  "workspaceId",
  "eventType",
  "invoiceAmountMinor",
  "daysOverdue",
  "proposalValueMinor",
  "contractStatus",
  "featureFlag",
  // v2.0 Checkpoint 39 — matches `facts.activityType` on a `"timeline_event"`
  // trigger against a real Timeline activity type (e.g. `"dispatch_created"`,
  // `"media_asset_approved"`) — the field that turns the one generic
  // Timeline Event trigger into an effectively unlimited set of specific
  // triggers, without a matching unlimited set of enum values.
  "activityType",
  // Step 6/7 — health/readiness scores already computed by real platform
  // engines (Business Health, Proposal/Contract/Invoice Readiness, etc.),
  // passed through a trigger's own `facts` by whichever module dispatches
  // it (e.g. a `"timeline_event"` for `proposal_health_recomputed` might
  // carry `facts.healthScore`). Never computed here — the Condition Engine
  // only ever compares a number a real engine already produced.
  "healthScore",
  "readinessScore",
  // Step 7 — approval/payment state, read from `facts.approvalState`/
  // `facts.paymentState` the same way `contractStatus` already reads
  // `facts.contractStatus` — never a new state machine.
  "approvalState",
  "paymentState",
] as const;
export type AutomationConditionField = (typeof AUTOMATION_CONDITION_FIELDS)[number];

export interface AutomationCondition {
  field: AutomationConditionField;
  operator: AutomationConditionOperator;
  value: string | number | boolean | (string | number)[];
}

/**
 * Four policies (Step 4): `"always_required"`/`"never_required"` are
 * self-explanatory; `"workspace_configurable"` defers to a per-Workspace,
 * per-Automation override (`AutomationApprovalOverridesRepository`),
 * defaulting to **required** when unset — the safer default, matching
 * `PRODUCT_PRINCIPLES.md` #4; `"role_restricted"` means approval is always
 * required, AND only a member whose role meets `minimumApproverRole` may
 * actually grant it — a distinct dimension (who may approve) from the
 * other three (whether approval is needed at all).
 */
export const APPROVAL_POLICY_KINDS = ["always_required", "never_required", "workspace_configurable", "role_restricted"] as const;
export type ApprovalPolicyKind = (typeof APPROVAL_POLICY_KINDS)[number];

export interface AutomationApprovalPolicy {
  kind: ApprovalPolicyKind;
  /** Only meaningful for `"role_restricted"`. */
  minimumApproverRole?: WorkspaceMemberRole | null;
}

export const AUTOMATION_CATEGORIES = ["operations", "finance", "crm", "proposal", "notifications", "memory", "general"] as const;
export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[number];

export const AUTOMATION_STATUSES = ["active", "disabled"] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

/**
 * Step 15 — Workflow Preparation. Reserved, never populated or read by
 * anything this checkpoint builds; exists only so a future Workflow
 * Builder can extend `AutomationDefinition` without a breaking change to
 * every existing registration. Each field names exactly one of the six
 * extension points the checkpoint's own spec calls out (multi-step
 * workflows, branching, parallel actions, timers, scheduled execution,
 * retry policies) — `retryPolicy` here is deliberately distinct from
 * `AutomationDefinition.maxRetries` (Step 7's own, already-implemented,
 * single-action retry count): this field is reserved for a *workflow-level*
 * policy (e.g. "retry the whole chain from step 3"), a strictly bigger
 * concept Step 7 never asked for.
 */
/**
 * v2.0 Checkpoint 39 — a real, validated shape for "Scheduled Workflows,"
 * defined here (not in `types/workflow.ts`) so the existing, established
 * import direction (`workflow.ts` → `automation.ts`, never the reverse)
 * stays intact. A genuine upgrade from "reserved, unknown": what's still a
 * real, disclosed gap is that nothing in BloomOS polls this field yet —
 * there is no background scheduler/cron process anywhere in this codebase
 * (confirmed by audit before this checkpoint), and standing one up is out
 * of scope here, the same way external integrations are out of scope. A
 * Scheduled Workflow records exactly when it *should* run; making it
 * actually run on a timer is future infrastructure work, not a data-model
 * gap. See "Known Limitations" in `docs/v2-checkpoint-39.md`.
 */
export const WORKFLOW_SCHEDULE_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type WorkflowScheduleFrequency = (typeof WORKFLOW_SCHEDULE_FREQUENCIES)[number];

export interface WorkflowScheduledExecution {
  frequency: WorkflowScheduleFrequency;
  /** 24-hour "HH:MM", workspace-local — same string format `event.start_time` already uses. */
  time: string;
  /** Only meaningful for `frequency: "weekly"` — 0 (Sunday) through 6 (Saturday). */
  dayOfWeek: number | null;
  /** Only meaningful for `frequency: "monthly"` — 1 through 28 (never 29-31, so every month can honor it). */
  dayOfMonth: number | null;
}

export interface AutomationWorkflowExtension {
  branches?: unknown;
  parallelActionGroups?: unknown;
  timers?: unknown;
  scheduledExecution?: WorkflowScheduledExecution | null;
  retryPolicy?: unknown;
}

/**
 * The Step 1 "Automation Definition" — a developer-registered, code-owned
 * declaration (`registerAutomation()`, mirroring `registerSkill()`), never
 * something a business user authors through a UI this checkpoint (that's
 * the future Workflow Builder's own job, explicitly out of scope). Actions
 * run in a fixed, linear sequence (`actionIds`) — Step 15's own "multi-step
 * workflows/branching/parallel actions" are reserved, not implemented.
 */
export interface AutomationDefinition {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  version: string;
  status: AutomationStatus;
  trigger: AutomationTriggerType;
  conditions: AutomationCondition[];
  /** Ids into the Action Registry, executed in sequence. */
  actionIds: string[];
  approvalPolicy: AutomationApprovalPolicy;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  /** Step 7's own "retry strategy" — how many additional attempts a failing action gets, synchronously, no backoff. `0` = no retry. */
  maxRetries: number;
  metadata?: Record<string, unknown>;
  /** Step 15 — reserved, always `null`/`undefined` this checkpoint. */
  workflow?: AutomationWorkflowExtension | null;
}

/**
 * The Step 5/6 Action contract — deliberately the open, registry-based
 * counterpart to Triggers' closed enum (see `AUTOMATION_TRIGGER_TYPES`'s
 * own doc comment for why the split): "Future actions should register
 * automatically" and "No hardcoded actions" only ever describe Actions,
 * never Triggers. Mirrors `SkillDefinition`'s own shape closely on purpose
 * — same registry pattern, same permission/role/feature-flag gating.
 */
/**
 * Mirrors `SkillExecuteParams` closely, deliberately — an Action calling
 * into the Skills Layer (`executeSkill()`) is a first-class, expected
 * pattern (Step 10's own architecture: Automations may execute Skills,
 * Skills may never execute Automations), so an Action needs the same
 * identity/permission facts a Skill's own `execute` already receives.
 */
export interface AutomationActionParams {
  workspaceId: string;
  workspaceName: string | null;
  /** The acting member, or `null` for a system-originated trigger. */
  userId: string | null;
  userName: string | null;
  role: WorkspaceMemberRole | null;
  permissions: Permission[];
  facts: Record<string, string | number | boolean | null>;
  automationId: string;
}

export interface AutomationActionResultDetail {
  success: boolean;
  /** A short, safe, human-readable summary — never sensitive content, never a raw record dump. */
  message: string;
  resultRef?: { type: EntityType; id: string } | null;
}

export interface AutomationActionDefinition {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  version: string;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  execute: (params: AutomationActionParams) => Promise<AutomationActionResultDetail>;
}

export const AUTOMATION_ACTION_EXECUTION_STATUSES = ["success", "failure"] as const;
export type AutomationActionExecutionStatus = (typeof AUTOMATION_ACTION_EXECUTION_STATUSES)[number];

export interface AutomationActionExecutionResult {
  actionId: string;
  status: AutomationActionExecutionStatus;
  message: string;
  /** How many attempts this action took (1 = succeeded/failed on the first try, no retry needed). */
  attempts: number;
  resultRef?: { type: EntityType; id: string } | null;
}

export const AUTOMATION_EXECUTION_STATUSES = [
  "success",
  "failure",
  "partial_failure",
  "pending_approval",
  "skipped_conditions_not_met",
  "rejected",
] as const;
export type AutomationExecutionStatus = (typeof AUTOMATION_EXECUTION_STATUSES)[number];

export type AutomationApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

/**
 * The Step 8 "Automation History" record — persisted for every execution
 * attempt, regardless of outcome (including a skipped-by-condition or
 * still-pending-approval one), matching the Audit Log's own append-only,
 * no-update/no-delete precedent. `triggerFacts` is a copy of the
 * originating `AutomationTriggerEvent.facts` — safe by the same contract
 * that field itself already carries (see `AutomationTriggerEvent`'s own
 * doc comment); never a raw prompt, never sensitive content. Persisting it
 * here (not just referencing it) is what lets a `"pending_approval"`
 * execution be resumed later without the original caller needing to still
 * be in scope.
 */
export interface AutomationExecution {
  id: string;
  workspaceId: string;
  automationId: string;
  automationName: string;
  automationVersion: string;
  trigger: AutomationTriggerType;
  triggerFacts: Record<string, string | number | boolean | null>;
  conditionsPassed: boolean;
  approvalStatus: AutomationApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  actionResults: AutomationActionExecutionResult[];
  status: AutomationExecutionStatus;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
  /**
   * v2.0 Checkpoint 39 (Workflow Monitoring Center) — the member (or
   * `"system"` for a Stripe-webhook-style unattended trigger) whose
   * `ExecuteAutomationContext.userId` reached the engine for this
   * execution. Optional, and `undefined` on every execution recorded
   * before this field existed — never backfilled, never fabricated.
   */
  startedBy?: string | null;
}

export interface RecordAutomationExecutionInput {
  automationId: string;
  automationName: string;
  automationVersion: string;
  trigger: AutomationTriggerType;
  triggerFacts: Record<string, string | number | boolean | null>;
  conditionsPassed: boolean;
  approvalStatus: AutomationApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  actionResults: AutomationActionExecutionResult[];
  status: AutomationExecutionStatus;
  durationMs: number;
  startedAt: string;
  completedAt: string | null;
  startedBy?: string | null;
}
