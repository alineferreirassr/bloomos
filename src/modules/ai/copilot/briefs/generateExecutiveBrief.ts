import { getEvents, getInvoices, getLowStockInventoryItems, getDocuments, getLeads, getPayments } from "@/lib/data";
import { getCoreAuditLogService } from "@/core/audit";
import { isInventoryItemLowStock } from "@/modules/inventory/inventoryStats";
import { formatMoney } from "@/lib/money";
import type { BriefLine, ExecutiveBrief } from "@/modules/ai/copilot/briefs/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Checkpoint 20, Step 4 — the Executive Brief. Deliberately deterministic:
 * every sentence is a plain template over data already fetched, never an
 * LLM/Skill call (the spec's own "No LLM required" for this step) — the
 * same "compute the facts in code" principle every Bloom AI Skill already
 * follows for its *structured* sections, applied here to the *entire*
 * output. A plain client-callable function (not a `"use server"` Server
 * Action) for the same reason `getCopilotSuggestions.ts` is — see that
 * file's own doc comment for the full "browser-bound Supabase repository"
 * constraint this sidesteps.
 */
export async function generateExecutiveBrief(workspaceId: string, firstName: string | null): Promise<ExecutiveBrief> {
  const monthStart = startOfMonth().toISOString();
  const dayStart = startOfDay();
  const now = Date.now();

  const [events, invoices, lowStockItems, draftDocuments, leads, paymentsThisMonth, recentActivity] = await Promise.all([
    getEvents({ includeArchived: false }),
    getInvoices({ includeArchived: false }),
    getLowStockInventoryItems(),
    getDocuments({ status: "draft", includeArchived: false, includeDeleted: false }),
    getLeads({ includeArchived: false }),
    getPayments({ status: "succeeded", dateFrom: monthStart }),
    getCoreAuditLogService().getAuditLogForWorkspace(workspaceId),
  ]);

  const revenueMinor = paymentsThisMonth.reduce((sum, payment) => sum + payment.amount_minor, 0);
  const currency = paymentsThisMonth[0]?.currency ?? "USD";

  const upcomingEvents = events.filter((event) => {
    if (!event.event_date) return false;
    const t = new Date(event.event_date).getTime();
    return t >= now && t - now <= ONE_WEEK_MS;
  });

  const eventsToday = events.filter((event) => event.event_date && new Date(event.event_date).getTime() >= dayStart.getTime() && new Date(event.event_date).getTime() < dayStart.getTime() + ONE_DAY_MS);

  const pendingInvoices = invoices.filter((invoice) =>
    ["issued", "sent", "viewed", "partially_paid", "overdue"].includes(invoice.status),
  );
  const pendingBalanceMinor = pendingInvoices.reduce((sum, invoice) => sum + invoice.balance_minor, 0);

  const trulyLowStock = lowStockItems.filter(isInventoryItemLowStock);

  const newLeads = leads.filter((lead) => now - new Date(lead.created_at).getTime() <= ONE_WEEK_MS);

  const activityThisWeek = recentActivity.filter((entry) => now - new Date(entry.occurred_at).getTime() <= ONE_WEEK_MS);

  const lines: BriefLine[] = [
    {
      id: "revenue",
      text:
        revenueMinor > 0
          ? `${formatMoney(revenueMinor, currency)} collected so far this month.`
          : "No payments recorded yet this month.",
      tone: revenueMinor > 0 ? "success" : "info",
    },
    {
      id: "events",
      text:
        upcomingEvents.length > 0
          ? `${upcomingEvents.length} event${upcomingEvents.length === 1 ? "" : "s"} coming up in the next 7 days, ${eventsToday.length} today.`
          : "No events scheduled in the next 7 days.",
      tone: "info",
    },
    {
      id: "payments",
      text:
        pendingInvoices.length > 0
          ? `${pendingInvoices.length} invoice${pendingInvoices.length === 1 ? "" : "s"} still outstanding, totaling ${formatMoney(pendingBalanceMinor, currency)}.`
          : "Every invoice is fully paid — nothing outstanding.",
      tone: pendingInvoices.length > 0 ? "warning" : "success",
    },
    {
      id: "inventory",
      text:
        trulyLowStock.length > 0
          ? `${trulyLowStock.length} inventory item${trulyLowStock.length === 1 ? "" : "s"} at or below its reorder level.`
          : "Inventory levels look healthy — nothing below its reorder level.",
      tone: trulyLowStock.length > 0 ? "warning" : "success",
    },
    {
      id: "documents",
      text:
        draftDocuments.length > 0
          ? `${draftDocuments.length} document${draftDocuments.length === 1 ? "" : "s"} still in draft, waiting to be finalized.`
          : "No documents waiting in draft.",
      tone: "info",
    },
    {
      id: "leads",
      text:
        newLeads.length > 0
          ? `${newLeads.length} new lead${newLeads.length === 1 ? "" : "s"} came in this week.`
          : "No new leads this week.",
      tone: newLeads.length > 0 ? "success" : "info",
    },
    {
      id: "team-activity",
      text: `${activityThisWeek.length} recorded action${activityThisWeek.length === 1 ? "" : "s"} across the Workspace this week.`,
      tone: "info",
    },
  ];

  const recommendations: string[] = [];
  if (pendingInvoices.filter((invoice) => invoice.status === "overdue").length > 0) {
    recommendations.push("Follow up on overdue invoices before they age further.");
  }
  if (trulyLowStock.length > 0) {
    recommendations.push("Restock low-inventory items ahead of upcoming events.");
  }
  if (newLeads.length > 0) {
    recommendations.push("Reach out to this week's new leads while interest is fresh.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Nothing urgent — a good day to plan ahead.");
  }

  const greeting = firstName ? `Good morning, ${firstName}.` : "Good morning.";
  const summary = `Here's where things stand across Amoré Bloom today.`;

  return { greeting, summary, lines, recommendations, generatedAt: new Date().toISOString() };
}
