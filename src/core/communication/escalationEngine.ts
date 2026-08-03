import type { EscalationCandidate } from "@/types/communication";

/**
 * v2.0 Checkpoint 24, Step 10 — Escalation Engine. Same shape as
 * `core/operations/riskEngine.ts`'s own `RISK_DETECTORS` — an array of
 * pure `(input) => EscalationCandidate[]` detectors, each independent and
 * appendable without touching the others, rather than one large
 * hand-rolled `if` chain. Every detector takes already-aggregated facts
 * (ages, counts) computed by the module layer; nothing here fetches data
 * or decides *what to do* about an escalation (that's
 * `modules/communication/escalation/getEscalationsData.ts`, which turns a
 * detected candidate into a real, higher-priority Notification via
 * `notificationEngine.buildNotificationInput`).
 */

export interface UnreadCriticalNotificationInput {
  id: string;
  recipientMemberId: string;
  ageHours: number;
}

export interface OverdueReminderInput {
  id: string;
  assignedToMemberId: string;
  overdueHours: number;
}

export interface LateApprovalInput {
  executionId: string;
  automationName: string;
  ageHours: number;
}

export interface MissedDeadlineInput {
  ownerType: "event" | "checklist_item";
  ownerId: string;
  label: string;
  overdueHours: number;
}

export interface PendingResponseInput {
  threadId: string;
  memberId: string;
  ageHours: number;
}

export interface HighRiskEventInput {
  eventId: string;
  eventName: string;
  healthScore: number;
}

export interface EscalationDetectionInput {
  unreadCriticalNotifications: UnreadCriticalNotificationInput[];
  overdueReminders: OverdueReminderInput[];
  lateApprovals: LateApprovalInput[];
  missedDeadlines: MissedDeadlineInput[];
  pendingResponses: PendingResponseInput[];
  highRiskEvents: HighRiskEventInput[];
}

/** Escalate an unread critical notification once it's sat unread for more than 4 hours — a critical notification is, by definition, urgent; silence past that window is itself the problem. */
const UNREAD_CRITICAL_THRESHOLD_HOURS = 4;
/** A pending approval older than 24 hours is "late" — mirrors the Automation Engine's own Pending Approvals list, just adds an age gate. */
const LATE_APPROVAL_THRESHOLD_HOURS = 24;
/** A thread with no reply in 48 hours is a "pending response" worth surfacing — long enough that a same-day reply never counts as ignored. */
const PENDING_RESPONSE_THRESHOLD_HOURS = 48;

type EscalationDetector = (input: EscalationDetectionInput) => EscalationCandidate[];

const detectUnreadCriticalNotifications: EscalationDetector = (input) =>
  input.unreadCriticalNotifications
    .filter((n) => n.ageHours >= UNREAD_CRITICAL_THRESHOLD_HOURS)
    .map((n) => ({
      kind: "unread_critical_notification",
      severity: "critical",
      message: `A critical notification has been unread for ${Math.round(n.ageHours)}h.`,
      recommendation: "Open the Notification Center and address it, or reassign it.",
      ownerType: null,
      ownerId: null,
      relatedMemberId: n.recipientMemberId,
    }));

const detectOverdueReminders: EscalationDetector = (input) =>
  input.overdueReminders.map((r) => ({
    kind: "overdue_reminder",
    severity: r.overdueHours >= 24 ? "critical" : "warning",
    message: `A reminder is ${Math.round(r.overdueHours)}h overdue.`,
    recommendation: "Complete, snooze, or reassign the reminder.",
    ownerType: null,
    ownerId: null,
    relatedMemberId: r.assignedToMemberId,
  }));

const detectLateApprovals: EscalationDetector = (input) =>
  input.lateApprovals
    .filter((a) => a.ageHours >= LATE_APPROVAL_THRESHOLD_HOURS)
    .map((a) => ({
      kind: "late_approval",
      severity: "critical",
      message: `"${a.automationName}" has been awaiting approval for ${Math.round(a.ageHours)}h.`,
      recommendation: "Approve or reject the pending Automation execution.",
      ownerType: "automation" as const,
      ownerId: a.executionId,
      relatedMemberId: null,
    }));

const detectMissedDeadlines: EscalationDetector = (input) =>
  input.missedDeadlines.map((d) => ({
    kind: "missed_deadline",
    severity: d.overdueHours >= 24 ? "critical" : "warning",
    message: `"${d.label}" is ${Math.round(d.overdueHours)}h past its deadline.`,
    recommendation: "Update the due date, complete it, or reassign it.",
    ownerType: d.ownerType,
    ownerId: d.ownerId,
    relatedMemberId: null,
  }));

const detectPendingResponses: EscalationDetector = (input) =>
  input.pendingResponses
    .filter((p) => p.ageHours >= PENDING_RESPONSE_THRESHOLD_HOURS)
    .map((p) => ({
      kind: "pending_response",
      severity: "warning",
      message: `A conversation has waited ${Math.round(p.ageHours)}h for a reply.`,
      recommendation: "Reply in the Unified Inbox, or reassign the conversation.",
      ownerType: null,
      ownerId: null,
      relatedMemberId: p.memberId,
    }));

const detectHighRiskEvents: EscalationDetector = (input) =>
  input.highRiskEvents
    .filter((e) => e.healthScore < 45)
    .map((e) => ({
      kind: "high_risk_event",
      severity: "critical",
      message: `"${e.eventName}" health score has dropped to ${e.healthScore}.`,
      recommendation: "Open the Event Command Center and review its Risk Center.",
      ownerType: "event" as const,
      ownerId: e.eventId,
      relatedMemberId: null,
    }));

export const ESCALATION_DETECTORS: EscalationDetector[] = [
  detectUnreadCriticalNotifications,
  detectOverdueReminders,
  detectLateApprovals,
  detectMissedDeadlines,
  detectPendingResponses,
  detectHighRiskEvents,
];

export function detectEscalations(input: EscalationDetectionInput): EscalationCandidate[] {
  return ESCALATION_DETECTORS.flatMap((detector) => detector(input));
}
