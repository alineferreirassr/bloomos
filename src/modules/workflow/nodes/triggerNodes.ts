import type { WorkflowNodeDefinition } from "@/types/workflow";

/**
 * The Step 9 built-in Trigger nodes — each `compileTarget` names one of
 * `AUTOMATION_TRIGGER_TYPES` (`types/automation.ts`) exactly, since that's
 * the closed set the Compiler validates against.
 *
 * Checkpoint 13 adds four more: Event Created (`event.created` already
 * existed as an `AutomationTriggerType` value since Checkpoint 9 — nothing
 * had ever registered a Workflow node for it until now), Client Created (a
 * new `AutomationTriggerType` value, added for the "New Client" built-in
 * Template), and Manual Trigger + Timer, both registered with
 * `compileTarget: null`. A `null`-compileTarget Trigger compiles to zero
 * real `AutomationDefinition`s (`compiler.ts`'s own `enumeratePaths` already
 * skips a trigger with no `compileTarget` — see `conditionFromNode`'s
 * sibling check) — by design, not a bug: this checkpoint's own stop
 * condition is "do not build the execution engine," so a Workflow whose
 * only Trigger is Manual or Timer can be designed, validated, and run
 * through the Execution Simulator (Step 6), but never dispatched for real
 * until a future checkpoint adds on-demand/scheduled execution.
 */
function makeTriggerNode(overrides: Pick<WorkflowNodeDefinition, "id" | "name" | "description" | "icon" | "compileTarget">): WorkflowNodeDefinition {
  return {
    kind: "trigger",
    category: "trigger",
    color: "accent",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    ...overrides,
  };
}

export const proposalAcceptedTrigger = makeTriggerNode({
  id: "trigger.proposal-accepted",
  name: "Proposal Accepted",
  description: "Fires when a Proposal draft is explicitly accepted.",
  icon: "FileCheck",
  compileTarget: "proposal.accepted",
});

export const proposalRejectedTrigger = makeTriggerNode({
  id: "trigger.proposal-rejected",
  name: "Proposal Rejected",
  description: "Fires when a Proposal draft is explicitly rejected.",
  icon: "FileX",
  compileTarget: "proposal.rejected",
});

export const invoicePaidTrigger = makeTriggerNode({
  id: "trigger.invoice-paid",
  name: "Invoice Paid",
  description: "Fires when an Invoice is recorded as paid in full.",
  icon: "CircleDollarSign",
  compileTarget: "invoice.paid",
});

export const invoiceOverdueTrigger = makeTriggerNode({
  id: "trigger.invoice-overdue",
  name: "Invoice Overdue",
  description: "Fires when an Invoice's own overdue state is recorded.",
  icon: "AlertTriangle",
  compileTarget: "invoice.overdue",
});

export const contractSignedTrigger = makeTriggerNode({
  id: "trigger.contract-signed",
  name: "Contract Signed",
  description: "Fires when a Contract is signed.",
  icon: "FileSignature",
  compileTarget: "contract.signed",
});

export const dailyBriefGeneratedTrigger = makeTriggerNode({
  id: "trigger.daily-brief-generated",
  name: "Daily Brief Generated",
  description: "Fires after a Daily Operations Brief is generated.",
  icon: "Newspaper",
  compileTarget: "daily_brief.generated",
});

export const crmRecommendationAcceptedTrigger = makeTriggerNode({
  id: "trigger.crm-recommendation-accepted",
  name: "CRM Recommendation Accepted",
  description: "Fires when a CRM Assistant recommendation is accepted.",
  icon: "UserCheck",
  compileTarget: "crm_recommendation.accepted",
});

export const financeRecommendationAcceptedTrigger = makeTriggerNode({
  id: "trigger.finance-recommendation-accepted",
  name: "Finance Recommendation Accepted",
  description: "Fires when a Finance Assistant recommendation is accepted.",
  icon: "TrendingUp",
  compileTarget: "finance_recommendation.accepted",
});

export const memoryCreatedTrigger = makeTriggerNode({
  id: "trigger.memory-created",
  name: "Memory Created",
  description: "Fires when a new AI Memory entry is recorded.",
  icon: "BrainCircuit",
  compileTarget: "memory.created",
});

export const eventCreatedTrigger = makeTriggerNode({
  id: "trigger.event-created",
  name: "Event Created",
  description: "Fires when a new Event is recorded for the Workspace.",
  icon: "CalendarClock",
  compileTarget: "event.created",
});

export const clientCreatedTrigger = makeTriggerNode({
  id: "trigger.client-created",
  name: "New Client",
  description: "Fires when a new Client is recorded for the Workspace.",
  icon: "UserCheck",
  compileTarget: "client.created",
});

/**
 * Checkpoint 14 (Client Portal, Step 10) — three Portal-originated
 * triggers. Each fires through the exact same `dispatchAutomationTrigger`
 * channel as every other trigger in this file (see
 * `src/modules/ai/proposal/acceptProposalDraft.ts` for the precedent this
 * mirrors), so a Workflow built from one of these nodes only ever runs
 * once a staff member has designed and *published* it — the Portal itself
 * never executes anything directly, it only reports that the event
 * happened.
 */
export const checklistItemCompletedTrigger = makeTriggerNode({
  id: "trigger.checklist-item-completed",
  name: "Client Completed Checklist Item",
  description: "Fires when a client marks a client-visible checklist item complete in the Client Portal.",
  icon: "ListChecks",
  compileTarget: "checklist_item.completed",
});

export const documentDownloadedTrigger = makeTriggerNode({
  id: "trigger.document-downloaded",
  name: "Client Downloaded Document",
  description: "Fires when a client downloads a document from the Client Portal.",
  icon: "FileStack",
  compileTarget: "document.downloaded",
});

export const proposalViewedTrigger = makeTriggerNode({
  id: "trigger.proposal-viewed",
  name: "Client Viewed Proposal",
  description: "Fires when a client views their accepted Proposal's summary in the Client Portal.",
  icon: "Eye",
  compileTarget: "proposal.viewed",
});

/**
 * v2.0 Checkpoint 39 — Workflow & Automation Platform.
 *
 * `eventCompletedTrigger` fills the one remaining gap in Checkpoint 9's own
 * `event.*` enum values that never got a Workflow node (`event.created` and
 * `event.updated` already did — `event.updated` still has none, since no
 * checkpoint has needed it as a Template ingredient yet).
 *
 * `timelineEventTrigger` is the one new, generic node: rather than adding a
 * bespoke node (and a bespoke `AutomationTriggerType` enum value) for every
 * one of the ~15 newer platforms named in this checkpoint's own spec
 * (Dispatch, Operational Planning, Execution Packages, Digital Assets,
 * Vendors, Workforce, Scheduling…), this one node fires on `"timeline_event"`
 * and narrows itself to one specific real Timeline activity type via its own
 * `data.activityType` — validated below, edited in the Properties Panel's
 * own new `TimelineEventTriggerFields`. See `core/workflow/compiler.ts`'s
 * own doc comment on `activityTypeCondition` for how this compiles.
 */
export const eventCompletedTrigger = makeTriggerNode({
  id: "trigger.event-completed",
  name: "Event Completed",
  description: "Fires when an Event is marked completed.",
  icon: "CalendarCheck",
  compileTarget: "event.completed",
});

export const timelineEventTrigger: WorkflowNodeDefinition = {
  ...makeTriggerNode({
    id: "trigger.timeline-event",
    name: "Timeline Event",
    description: "Fires when any real BloomOS module records a specific Timeline activity type — covers every platform's own events, not just the ones with a dedicated Trigger node.",
    icon: "History",
    compileTarget: "timeline_event",
  }),
  validate: ({ node }) => (typeof node.data.activityType === "string" && node.data.activityType.trim().length > 0 ? null : "Choose which Timeline activity type this Trigger should fire on."),
};

/**
 * Manual and Timer both register with `compileTarget: null` — see this
 * file's own header comment for why that's a deliberate design, not a gap.
 */
export const manualTrigger = makeTriggerNode({
  id: "trigger.manual",
  name: "Manual Trigger",
  description: "Runs only when a member explicitly starts this Workflow — design and simulate now, real on-demand dispatch is a future checkpoint.",
  icon: "Play",
  compileTarget: null,
});

export const timerTrigger = makeTriggerNode({
  id: "trigger.timer",
  name: "Timer (placeholder)",
  description: "Reserved for a future scheduled Trigger — design and simulate now, no real schedule runs yet.",
  icon: "CalendarClock",
  compileTarget: null,
});

/**
 * v2 Checkpoint 43 — External Integrations Platform. `payment.received`
 * (dispatched, but "unnamed" — kept off the Workflow Builder canvas since
 * it fires for every payment type; `deposit.paid`/`balance.paid` are the
 * user-facing, more specific choices) plus `payment.failed`/
 * `refund.issued` (both dispatched by `webhookProcessing.ts` since
 * Checkpoint 23 but never had a Workflow node until now), and the 5 new
 * provider-delivery triggers this checkpoint's own webhook processing
 * dispatches (`webhookEventProcessing.ts`).
 */
export const depositPaidTrigger = makeTriggerNode({ id: "trigger.deposit-paid", name: "Deposit Paid", description: "Fires when a client's deposit payment is recorded, via Stripe or manually.", icon: "PiggyBank", compileTarget: "deposit.paid" });
export const balancePaidTrigger = makeTriggerNode({ id: "trigger.balance-paid", name: "Balance Paid", description: "Fires when an Invoice's remaining balance is paid in full.", icon: "Wallet", compileTarget: "balance.paid" });
export const paymentFailedTrigger = makeTriggerNode({ id: "trigger.payment-failed", name: "Payment Failed", description: "Fires when a Stripe payment attempt fails.", icon: "CircleX", compileTarget: "payment.failed" });
export const refundIssuedTrigger = makeTriggerNode({ id: "trigger.refund-issued", name: "Refund Issued", description: "Fires when a payment is refunded, in full or in part.", icon: "Undo2", compileTarget: "refund.issued" });
export const calendarEventChangedTrigger = makeTriggerNode({ id: "trigger.calendar-event-changed", name: "Calendar Event Changed", description: "Fires when a connected external calendar reports a change to a synced event.", icon: "CalendarClock", compileTarget: "calendar.event_changed" });
export const emailDeliveredTrigger = makeTriggerNode({ id: "trigger.email-delivered", name: "Email Delivered", description: "Fires when a sent email is confirmed delivered by the connected email provider.", icon: "MailCheck", compileTarget: "email.delivered" });
export const emailBouncedTrigger = makeTriggerNode({ id: "trigger.email-bounced", name: "Email Bounced", description: "Fires when a sent email bounces.", icon: "MailWarning", compileTarget: "email.bounced" });
export const smsDeliveredTrigger = makeTriggerNode({ id: "trigger.sms-delivered", name: "SMS Delivered", description: "Fires when a sent SMS is confirmed delivered by the connected messaging provider.", icon: "MessageSquareCheck", compileTarget: "sms.delivered" });
export const smsFailedTrigger = makeTriggerNode({ id: "trigger.sms-failed", name: "SMS Failed", description: "Fires when a sent SMS fails to deliver.", icon: "MessageSquareX", compileTarget: "sms.failed" });
export const signatureCompletedTrigger = makeTriggerNode({ id: "trigger.signature-completed", name: "Signature Completed", description: "Fires when a connected e-signature provider reports a signature request fully signed.", icon: "FileCheck2", compileTarget: "signature.completed" });
export const signatureDeclinedTrigger = makeTriggerNode({ id: "trigger.signature-declined", name: "Signature Declined", description: "Fires when a signer declines a signature request.", icon: "FileX2", compileTarget: "signature.declined" });
export const externalFileSyncedTrigger = makeTriggerNode({ id: "trigger.external-file-synced", name: "External File Synced", description: "Fires when a file finishes syncing to or from a connected storage provider.", icon: "FolderSync", compileTarget: "storage.file_synced" });
export const integrationConnectionFailedTrigger = makeTriggerNode({ id: "trigger.integration-connection-failed", name: "Integration Connection Failed", description: "Fires when a connected provider's connection health check fails.", icon: "PlugZap", compileTarget: "connection.failed" });

export const triggerNodes: WorkflowNodeDefinition[] = [
  proposalAcceptedTrigger,
  proposalRejectedTrigger,
  invoicePaidTrigger,
  invoiceOverdueTrigger,
  contractSignedTrigger,
  dailyBriefGeneratedTrigger,
  crmRecommendationAcceptedTrigger,
  financeRecommendationAcceptedTrigger,
  memoryCreatedTrigger,
  eventCreatedTrigger,
  clientCreatedTrigger,
  checklistItemCompletedTrigger,
  documentDownloadedTrigger,
  proposalViewedTrigger,
  eventCompletedTrigger,
  timelineEventTrigger,
  depositPaidTrigger,
  balancePaidTrigger,
  paymentFailedTrigger,
  refundIssuedTrigger,
  calendarEventChangedTrigger,
  emailDeliveredTrigger,
  emailBouncedTrigger,
  smsDeliveredTrigger,
  smsFailedTrigger,
  signatureCompletedTrigger,
  signatureDeclinedTrigger,
  externalFileSyncedTrigger,
  integrationConnectionFailedTrigger,
  manualTrigger,
  timerTrigger,
];
