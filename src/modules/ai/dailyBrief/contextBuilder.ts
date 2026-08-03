import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import { clockNow } from "@/core/time/clock";
import type { EventOperationsBriefContext } from "@/modules/ai/types";
import type { DailyOperationsBriefMaterials } from "@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server";
import type {
  DailyBriefEventSummary,
  DailyOperationsBriefContext,
  DailyBriefLatePayment,
  DailyBriefContractIssue,
  DailyBriefChecklistProgress,
  DailyBriefTeamAssignment,
  DailyBriefHighPriorityClient,
  DailyBriefCalendarSummary,
  DailyBriefActivityEntry,
  DailyBriefDeadline,
  DailyBriefIssueSnapshot,
} from "@/modules/ai/dailyBrief/types";
import type { ChecklistItem } from "@/types/checklistItem";

export const DAILY_OPERATIONS_BRIEF_CONTEXT_VERSION = "daily-operations-brief-context-v2";

const OPEN_CHECKLIST_STATUSES_EXCLUDED = new Set(["completed", "cancelled"]);

function daysUntil(dateIso: string | null, now: Date): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso.length > 10 ? dateIso : `${dateIso}T00:00:00`);
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

function toSummary(context: EventOperationsBriefContext): DailyBriefEventSummary {
  return {
    eventId: context.event.id,
    title: context.event.title,
    eventDate: context.event.eventDate,
    lifecycleStage: context.event.lifecycleStage,
    status: context.event.status,
    healthStatus: context.health.status,
    assignedOwner: context.event.assignedOwner,
    topRisk: context.detectedRisks[0] ?? null,
  };
}

function isOpenChecklistItem(item: ChecklistItem): boolean {
  return !OPEN_CHECKLIST_STATUSES_EXCLUDED.has(item.status);
}

function isOverdueChecklistItem(item: ChecklistItem, now: Date): boolean {
  return isOpenChecklistItem(item) && item.due_date !== null && new Date(item.due_date).getTime() < now.getTime();
}

function buildChecklistProgress(checklist: ChecklistItem[], now: Date): DailyBriefChecklistProgress {
  return {
    totalOpen: checklist.filter(isOpenChecklistItem).length,
    totalOverdue: checklist.filter((item) => isOverdueChecklistItem(item, now)).length,
    totalCompleted: checklist.filter((item) => item.status === "completed").length,
  };
}

function buildTeamAssignments(checklist: ChecklistItem[], now: Date): DailyBriefTeamAssignment[] {
  const byName = new Map<string, { openItemCount: number; overdueItemCount: number }>();
  for (const item of checklist) {
    if (!item.assigned_name || !isOpenChecklistItem(item)) continue;
    const entry = byName.get(item.assigned_name) ?? { openItemCount: 0, overdueItemCount: 0 };
    entry.openItemCount += 1;
    if (isOverdueChecklistItem(item, now)) entry.overdueItemCount += 1;
    byName.set(item.assigned_name, entry);
  }
  return [...byName.entries()]
    .map(([assigneeName, counts]) => ({ assigneeName, ...counts }))
    .sort((a, b) => b.openItemCount - a.openItemCount);
}

function buildUpcomingDeadlines(checklist: ChecklistItem[], materials: DailyOperationsBriefMaterials, now: Date): DailyBriefDeadline[] {
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() + windowMs;

  const checklistDeadlines: DailyBriefDeadline[] = checklist
    .filter((item) => isOpenChecklistItem(item) && item.due_date !== null)
    .filter((item) => new Date(item.due_date as string).getTime() <= cutoff)
    .map((item) => ({ label: item.title, dueDate: item.due_date as string, kind: "checklist" as const, ownerId: item.owner_id }));

  const invoiceDeadlines: DailyBriefDeadline[] = materials.lateInvoices
    .filter((invoice) => invoice.due_date !== null)
    .map((invoice) => ({ label: `Invoice ${invoice.invoice_number}`, dueDate: invoice.due_date as string, kind: "invoice" as const, ownerId: invoice.id }));

  const contractDeadlines: DailyBriefDeadline[] = materials.unsignedContracts
    .filter((contract) => contract.effective_date !== null && new Date(contract.effective_date).getTime() <= cutoff)
    .map((contract) => ({ label: `Contract ${contract.contract_number}`, dueDate: contract.effective_date as string, kind: "contract" as const, ownerId: contract.id }));

  return [...checklistDeadlines, ...invoiceDeadlines, ...contractDeadlines].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Pure and deterministic — the only place `DailyOperationsBriefContext` is
 * assembled. Reuses `buildEventOperationsBriefContext` per Event (Health
 * Score, risk detection) rather than recomputing anything: one operational
 * intelligence layer, not two. `unavailableCategories` passes straight
 * through from the fetch layer so `confidence.ts` can distinguish "this
 * category is genuinely empty" (a real, good data point) from "this
 * category couldn't be read" (a real gap).
 */
export function buildDailyOperationsBriefContext(materials: DailyOperationsBriefMaterials, now: Date = clockNow()): DailyOperationsBriefContext {
  const eventContexts = materials.eventRecords.map((record) =>
    buildEventOperationsBriefContext(record.event, record.client, record.checklist, record.schedule, now),
  );
  const summaries = eventContexts.map(toSummary);
  const allChecklistItems = materials.eventRecords.flatMap((record) => record.checklist);

  const eventsToday = summaries.filter((summary) => daysUntil(summary.eventDate, now) === 0);
  const eventsThisWeek = summaries.filter((summary) => {
    const days = daysUntil(summary.eventDate, now);
    return days !== null && days >= 0 && days <= 7;
  });
  const eventsThisMonth = summaries.filter((summary) => {
    const days = daysUntil(summary.eventDate, now);
    return days !== null && days >= 0 && days <= 31;
  });
  const eventsAtRisk = summaries.filter((summary) => summary.healthStatus !== "ready" || summary.topRisk !== null);

  const latePayments: DailyBriefLatePayment[] = materials.lateInvoices.map((invoice) => ({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientId: invoice.client_id,
    eventId: invoice.event_id,
    balanceMinor: invoice.balance_minor,
    currency: invoice.currency,
    dueDate: invoice.due_date,
    daysOverdue: invoice.due_date ? Math.max(0, -(daysUntil(invoice.due_date, now) ?? 0)) : 0,
  }));

  const unsignedContracts: DailyBriefContractIssue[] = materials.unsignedContracts.map((contract) => {
    const linkedEvent = summaries.find((summary) => summary.eventId === contract.event_id);
    return {
      contractId: contract.id,
      contractNumber: contract.contract_number,
      clientId: contract.client_id,
      eventId: contract.event_id,
      signatureStatus: contract.signature_status,
      eventDate: linkedEvent?.eventDate ?? null,
    };
  });

  const highPriorityClients: DailyBriefHighPriorityClient[] = materials.highPriorityClients.map((client) => ({
    clientId: client.id,
    name: `${client.first_name} ${client.last_name}`.trim(),
  }));

  const calendarSummary: DailyBriefCalendarSummary = {
    eventsToday: eventsToday.length,
    eventsThisWeek: eventsThisWeek.length,
    eventsThisMonth: eventsThisMonth.length,
  };

  const recentActivity: DailyBriefActivityEntry[] = materials.recentActivity
    .slice()
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 20)
    .map((entry) => ({ action: entry.action, ownerType: entry.owner_type, occurredAt: entry.occurred_at }));

  return {
    generatedAt: now.toISOString(),
    eventsToday,
    eventsThisWeek,
    eventsAtRisk,
    latePayments,
    unsignedContracts,
    checklistProgress: buildChecklistProgress(allChecklistItems, now),
    teamAssignments: buildTeamAssignments(allChecklistItems, now),
    unreadNotificationCount: materials.unreadNotificationCount,
    highPriorityClients,
    calendarSummary,
    recentActivity,
    upcomingDeadlines: buildUpcomingDeadlines(allChecklistItems, materials, now),
    unavailableCategories: materials.unavailableCategories,
  };
}

/**
 * Checkpoint 6, Step 7 — the stable, diffable fact set for *this* Daily
 * Brief run, used two ways: `generateDailyOperationsBrief.ts` persists the
 * result as this run's own historical memory (for a *future* run to
 * compare against), and `assembleBrief.ts` calls this same function again
 * on the *current* context to diff against whatever prior snapshot memory
 * supplied. One function, both directions — never two separate
 * implementations of "what counts as an issue" that could drift apart.
 */
export function computeIssueSnapshots(context: DailyOperationsBriefContext): DailyBriefIssueSnapshot[] {
  const riskSnapshots: DailyBriefIssueSnapshot[] = context.eventsAtRisk
    .filter((event) => event.topRisk !== null)
    .map((event) => ({ key: `risk:${event.eventId}:${event.topRisk?.kind}`, label: `${event.title}: ${event.topRisk?.label}` }));

  const latePaymentSnapshots: DailyBriefIssueSnapshot[] = context.latePayments.map((payment) => ({
    key: `late-payment:${payment.invoiceId}`,
    label: `Invoice ${payment.invoiceNumber} overdue by ${payment.daysOverdue} day(s)`,
  }));

  const unsignedContractSnapshots: DailyBriefIssueSnapshot[] = context.unsignedContracts.map((contract) => ({
    key: `unsigned-contract:${contract.contractId}`,
    label: `Contract ${contract.contractNumber} unsigned`,
  }));

  return [...riskSnapshots, ...latePaymentSnapshots, ...unsignedContractSnapshots];
}
