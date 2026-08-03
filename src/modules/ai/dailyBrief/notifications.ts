import type { Notification } from "@/core/notifications/types";
import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";
import { generateId, nowIso } from "@/lib/data/utils";
import { clockNow } from "@/core/time/clock";

const IMMINENT_CONTRACT_WINDOW_DAYS = 7;

function daysUntil(dateIso: string, now: Date): number {
  const target = new Date(dateIso.length > 10 ? dateIso : `${dateIso}T00:00:00`);
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * Builds — never persists, never sends — `Notification`-shaped objects for
 * the Daily Brief's own critical findings: a high-severity Event risk, any
 * late payment, or an unsigned Contract for an Event happening within the
 * next week. "Prepare, don't send" (per the spec) is enforced structurally
 * here, not by convention: this function never imports
 * `getCoreNotificationsService`/`createInAppNotification` (the one
 * function that actually persists a real, member-visible notification) or
 * any `NotificationProvider` (the one interface that actually dispatches
 * email/SMS/push) — there is no code path from this function to either.
 * The caller (`generateDailyOperationsBrief.ts`) only ever hands these
 * objects to the UI to render as a highlighted "Critical Findings" section.
 */
export function prepareCriticalFindings(context: DailyOperationsBriefContext, workspaceId: string, recipientMemberId: string, now: Date = clockNow()): Notification[] {
  const findings: Notification[] = [];

  function push(title: string, body: string, relatedOwnerType: Notification["related_owner_type"], relatedOwnerId: string | null) {
    findings.push({
      id: generateId("daily-brief-finding"),
      workspace_id: workspaceId,
      recipient_member_id: recipientMemberId,
      recipient_client_account_id: null,
      channel: "in_app",
      title,
      body,
      read_at: null,
      created_at: nowIso(),
      related_owner_type: relatedOwnerType,
      related_owner_id: relatedOwnerId,
      kind: null,
      priority: "normal",
      pinned_at: null,
      archived_at: null,
    });
  }

  for (const event of context.eventsAtRisk) {
    if (event.topRisk?.severity === "high") {
      push(`High risk: ${event.title}`, event.topRisk.evidence, "event", event.eventId);
    }
  }

  for (const payment of context.latePayments) {
    push(`Late payment: Invoice ${payment.invoiceNumber}`, `${payment.daysOverdue} day(s) overdue.`, "invoice", payment.invoiceId);
  }

  for (const contract of context.unsignedContracts) {
    if (contract.eventDate && daysUntil(contract.eventDate, now) <= IMMINENT_CONTRACT_WINDOW_DAYS) {
      push(`Unsigned contract: ${contract.contractNumber}`, "Linked Event is coming up soon and this Contract is still unsigned.", "contract", contract.contractId);
    }
  }

  return findings;
}
