import { formatMoney, majorToMinor, sumMinor, subtractMinor } from "@/lib/money";
import { computeWorkspaceFinancialSummary, computeAllTimeFinancialTotals } from "@/modules/finance/financialSummary";
import { clockNow } from "@/core/time/clock";
import type { FinanceAssistantMaterials } from "@/modules/ai/financeAssistant/fetchFinanceAssistantContext.server";
import type {
  FinanceAssistantContext,
  FinanceAssistantInvoiceSummary,
  FinanceAssistantPaymentSummary,
  FinanceAssistantContractSummary,
  FinanceAssistantProposalSummary,
  FinanceAssistantEventSummary,
  FinanceAssistantDailyBriefSummary,
  FinanceAssistantActivityEntry,
  FinanceAssistantRiskSummary,
} from "@/modules/ai/financeAssistant/types";

export const FINANCE_ASSISTANT_CONTEXT_VERSION = "finance-assistant-context-v1";

const UPCOMING_REVENUE_WINDOW_DAYS = 30;
const UPCOMING_EVENTS_LIMIT = 20;
const REFUNDS_LIMIT = 10;
const PROPOSAL_VALUES_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT = 20;
const SEVERE_OVERDUE_THRESHOLD_DAYS = 14;
const CONTRACT_RISK_WINDOW_DAYS = 14;

/** Contracts that no longer represent real, currently-owed commercial value — mirrors `financialSummary.ts`'s own `INACTIVE_CONTRACT_STATUSES` exactly, so Contract Value here never disagrees with the Dashboard's own figure. */
const INACTIVE_CONTRACT_STATUSES = new Set(["cancelled", "declined", "expired", "archived"]);

function daysUntil(dateIso: string | null, now: Date): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso.length > 10 ? dateIso : `${dateIso}T00:00:00`);
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

function toInvoiceSummary(invoice: FinanceAssistantMaterials["invoices"][number]): FinanceAssistantInvoiceSummary {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientId: invoice.client_id,
    eventId: invoice.event_id,
    status: invoice.status,
    balanceMinor: invoice.balance_minor,
    totalMinor: invoice.total_minor,
    currency: invoice.currency,
    dueDate: invoice.due_date,
  };
}

function toPaymentSummary(payment: FinanceAssistantMaterials["payments"][number]): FinanceAssistantPaymentSummary {
  return {
    paymentId: payment.id,
    clientId: payment.client_id,
    invoiceId: payment.invoice_id,
    eventId: payment.event_id,
    paymentType: payment.payment_type,
    status: payment.status,
    amountMinor: payment.amount_minor,
    currency: payment.currency,
    transactionDate: payment.transaction_date,
  };
}

function toContractSummary(contract: FinanceAssistantMaterials["contracts"][number]): FinanceAssistantContractSummary {
  return {
    contractId: contract.id,
    contractNumber: contract.contract_number,
    clientId: contract.client_id,
    eventId: contract.event_id,
    status: contract.status,
    signatureStatus: contract.signature_status,
    totalValueMinor: majorToMinor(contract.total_value ?? 0),
    currency: contract.currency,
    effectiveDate: contract.effective_date,
  };
}

function toProposalSummary(proposal: FinanceAssistantMaterials["proposals"][number]): FinanceAssistantProposalSummary {
  return {
    proposalId: proposal.id,
    eventId: proposal.event_id,
    clientId: proposal.client_id,
    status: proposal.status,
    subtotalMinor: proposal.pricing_summary.subtotal_minor,
    currency: proposal.pricing_summary.currency,
    generatedAt: proposal.generated_at,
  };
}

function toEventSummary(event: FinanceAssistantMaterials["events"][number]): FinanceAssistantEventSummary {
  return { eventId: event.id, title: event.title, eventDate: event.event_date, clientId: event.client_id };
}

function toDailyBriefSummary(execution: FinanceAssistantMaterials["dailyBriefExecutions"][number]): FinanceAssistantDailyBriefSummary {
  return { executionId: execution.id, status: execution.status, generatedAt: execution.generated_at };
}

/**
 * Payment Delays (Checkpoint 8, Step 4) — every overdue Invoice, mirrors
 * Daily Brief's own `latePayments`. Financial Risks (a separate, narrower
 * section) escalates from this same set: an Invoice overdue beyond
 * `SEVERE_OVERDUE_THRESHOLD_DAYS`, or an unsigned Contract whose Event is
 * imminent or already past. `reasons` are computed facts (a real invoice
 * number, a real formatted amount, a real day count), never a model's own
 * claim — the model may only add a short *explanation* for an
 * already-identified risk, never decide who's at risk.
 */
function computeFinancialRisks(
  paymentDelays: FinanceAssistantInvoiceSummary[],
  unsignedContracts: FinanceAssistantContractSummary[],
  now: Date,
): FinanceAssistantRiskSummary[] {
  const risks: FinanceAssistantRiskSummary[] = [];

  for (const invoice of paymentDelays) {
    const days = invoice.dueDate ? -(daysUntil(invoice.dueDate, now) ?? 0) : null;
    if (days !== null && days >= SEVERE_OVERDUE_THRESHOLD_DAYS) {
      risks.push({
        riskId: `invoice:${invoice.invoiceId}`,
        targetType: "invoice",
        targetId: invoice.invoiceId,
        label: `Invoice ${invoice.invoiceNumber} severely overdue`,
        reasons: [`${days} day(s) overdue, ${formatMoney(invoice.balanceMinor, invoice.currency)} outstanding`],
      });
    }
  }

  for (const contract of unsignedContracts) {
    const days = daysUntil(contract.effectiveDate, now);
    if (days !== null && days <= CONTRACT_RISK_WINDOW_DAYS) {
      risks.push({
        riskId: `contract:${contract.contractId}`,
        targetType: "contract",
        targetId: contract.contractId,
        label: `Contract ${contract.contractNumber} unsigned before its Event`,
        reasons: [days < 0 ? `Event date has already passed, contract still unsigned` : `Event is ${days} day(s) away, contract still unsigned`],
      });
    }
  }

  return risks;
}

/**
 * Pure and deterministic — the only place `FinanceAssistantContext` is
 * assembled (Checkpoint 8, Step 2). Revenue/Cash Flow figures reuse
 * `computeWorkspaceFinancialSummary`/`computeAllTimeFinancialTotals`
 * (`modules/finance/financialSummary.ts`) rather than reimplementing the
 * math — the same formulas the Dashboard's own Finance metrics already
 * use. `recentMemories`/`crmRecommendations` are left empty here; populated
 * by the Skill's own `composeContext`, the same separation of concerns
 * `dailyBriefContext`/`previousSnapshot` and `crmAssistantContext`/
 * `recentMemories` already established.
 */
export function buildFinanceAssistantContext(materials: FinanceAssistantMaterials, now: Date = clockNow()): FinanceAssistantContext {
  const workspaceSummary = computeWorkspaceFinancialSummary(materials.contracts, materials.invoices, materials.payments, materials.expenses, now);
  const allTimeTotals = computeAllTimeFinancialTotals(materials.invoices, materials.payments);

  const activeInvoices = materials.invoices.filter((invoice) => invoice.status !== "voided" && invoice.status !== "archived");
  const outstandingInvoices = activeInvoices.filter((invoice) => invoice.balance_minor > 0).map(toInvoiceSummary);
  const paymentDelays = activeInvoices.filter((invoice) => invoice.status === "overdue").map(toInvoiceSummary);
  const upcomingRevenue = activeInvoices
    .filter((invoice) => {
      if (invoice.balance_minor <= 0 || invoice.status === "overdue") return false;
      const days = daysUntil(invoice.due_date, now);
      return days !== null && days >= 0 && days <= UPCOMING_REVENUE_WINDOW_DAYS;
    })
    .map(toInvoiceSummary);

  const refunds = materials.payments
    .filter((payment) => payment.payment_type === "refund")
    .slice()
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    .slice(0, REFUNDS_LIMIT)
    .map(toPaymentSummary);

  const activeContracts = materials.contracts.filter((contract) => !INACTIVE_CONTRACT_STATUSES.has(contract.status));
  const activeContractSummaries = activeContracts.map(toContractSummary);
  const contractValueTotalMinor = sumMinor(activeContractSummaries.map((c) => c.totalValueMinor));
  const contractValueSignedMinor = sumMinor(activeContractSummaries.filter((c) => c.signatureStatus === "signed").map((c) => c.totalValueMinor));
  const contractValueUnsignedMinor = Math.max(0, subtractMinor(contractValueTotalMinor, contractValueSignedMinor));
  const unsignedContracts = activeContractSummaries.filter((c) => c.signatureStatus === "unsigned");

  const proposalValues = materials.proposals
    .slice()
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
    .slice(0, PROPOSAL_VALUES_LIMIT)
    .map(toProposalSummary);

  const upcomingEvents = materials.events
    .filter((event) => {
      const days = daysUntil(event.event_date, now);
      return days !== null && days >= 0;
    })
    .map(toEventSummary)
    .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""))
    .slice(0, UPCOMING_EVENTS_LIMIT);

  const financialRisks = computeFinancialRisks(paymentDelays, unsignedContracts, now);

  const recentDailyBriefs = materials.dailyBriefExecutions.map(toDailyBriefSummary);
  const recentActivity: FinanceAssistantActivityEntry[] = materials.activity
    .slice()
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map((entry) => ({ action: entry.action, ownerType: entry.owner_type, occurredAt: entry.occurred_at }));

  const currency = materials.invoices[0]?.currency ?? materials.contracts[0]?.currency ?? "USD";

  return {
    generatedAt: now.toISOString(),
    currency,

    revenueThisMonthMinor: workspaceSummary.revenue_this_month_minor,
    collectedThisMonthMinor: workspaceSummary.collected_this_month_minor,
    totalInvoicedAllTimeMinor: allTimeTotals.total_invoiced_minor,
    totalCollectedAllTimeMinor: allTimeTotals.total_collected_minor,
    outstandingReceivablesMinor: workspaceSummary.outstanding_receivables_minor,
    overdueReceivablesMinor: workspaceSummary.overdue_receivables_minor,
    refundsThisMonthMinor: workspaceSummary.refunds_this_month_minor,
    depositsPendingMinor: workspaceSummary.deposits_pending_minor,
    expensesThisMonthMinor: workspaceSummary.expenses_this_month_minor,
    netCashPositionMinor: workspaceSummary.net_profit_minor,

    outstandingInvoices,
    paymentDelays,
    upcomingRevenue,
    refunds,

    contractValueTotalMinor,
    contractValueSignedMinor,
    contractValueUnsignedMinor,
    unsignedContracts,

    proposalValues,
    upcomingEvents,
    financialRisks,

    recentDailyBriefs,
    recentActivity,
    crmRecommendations: [],
    recentMemories: [],

    unavailableCategories: materials.unavailableCategories,
  };
}
