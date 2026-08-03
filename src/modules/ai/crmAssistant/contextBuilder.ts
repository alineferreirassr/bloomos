import { formatMoney, sumMinor } from "@/lib/money";
import { clockNow } from "@/core/time/clock";
import type { CrmAssistantMaterials } from "@/modules/ai/crmAssistant/fetchCrmAssistantContext.server";
import type {
  CrmAssistantContext,
  CrmAssistantClientSummary,
  CrmAssistantLeadSummary,
  CrmAssistantEventSummary,
  CrmAssistantContractSummary,
  CrmAssistantInvoiceSummary,
  CrmAssistantProposalSummary,
  CrmAssistantDailyBriefSummary,
  CrmAssistantActivityEntry,
  CrmAssistantClientRisk,
  CrmCommunicationSummary,
} from "@/modules/ai/crmAssistant/types";

export const CRM_ASSISTANT_CONTEXT_VERSION = "crm-assistant-context-v1";

const UPCOMING_EVENTS_LIMIT = 20;
const PAST_EVENTS_LIMIT = 10;
const PROPOSAL_HISTORY_LIMIT = 10;
const RECENT_ACTIVITY_LIMIT = 20;
const ACTIVE_LEADS_LIMIT = 20;
const PRIORITY_EVENT_WINDOW_DAYS = 14;

const CLOSED_LEAD_STATUSES = new Set(["converted", "lost", "archived"]);

const COMMUNICATION_ACTIVITY_TYPES = new Set(["welcome_guide_sent", "note_added", "communication_preference_changed"]);

function daysUntil(dateIso: string | null, now: Date): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso.length > 10 ? dateIso : `${dateIso}T00:00:00`);
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

function toClientSummary(client: CrmAssistantMaterials["clients"][number]): CrmAssistantClientSummary {
  return {
    clientId: client.id,
    name: `${client.first_name} ${client.last_name}`.trim(),
    status: client.internal_status,
    isVip: client.is_vip,
    isReturning: client.is_returning,
    tags: client.tags,
    createdAt: client.created_at,
  };
}

function toLeadSummary(lead: CrmAssistantMaterials["leads"][number]): CrmAssistantLeadSummary {
  return {
    leadId: lead.id,
    name: `${lead.first_name} ${lead.last_name}`.trim(),
    status: lead.status,
    source: lead.source,
    eventType: lead.event_type,
    eventDate: lead.event_date,
    createdAt: lead.created_at,
  };
}

function toEventSummary(event: CrmAssistantMaterials["events"][number]): CrmAssistantEventSummary {
  return {
    eventId: event.id,
    title: event.title,
    eventDate: event.event_date,
    clientId: event.client_id,
    status: event.status,
    lifecycleStage: event.lifecycle_stage,
  };
}

function toContractSummary(contract: CrmAssistantMaterials["contracts"][number]): CrmAssistantContractSummary {
  return {
    contractId: contract.id,
    contractNumber: contract.contract_number,
    clientId: contract.client_id,
    eventId: contract.event_id,
    signatureStatus: contract.signature_status,
    effectiveDate: contract.effective_date,
  };
}

function toInvoiceSummary(invoice: CrmAssistantMaterials["invoices"][number]): CrmAssistantInvoiceSummary {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientId: invoice.client_id,
    eventId: invoice.event_id,
    status: invoice.status,
    balanceMinor: invoice.balance_minor,
    currency: invoice.currency,
    dueDate: invoice.due_date,
  };
}

function toProposalSummary(proposal: CrmAssistantMaterials["proposals"][number]): CrmAssistantProposalSummary {
  return {
    proposalId: proposal.id,
    eventId: proposal.event_id,
    clientId: proposal.client_id,
    status: proposal.status,
    version: proposal.version,
    generatedAt: proposal.generated_at,
  };
}

function toDailyBriefSummary(execution: CrmAssistantMaterials["dailyBriefExecutions"][number]): CrmAssistantDailyBriefSummary {
  return { executionId: execution.id, status: execution.status, generatedAt: execution.generated_at };
}

function isEventUpcomingSoon(events: CrmAssistantMaterials["events"], clientId: string, now: Date): boolean {
  return events.some((event) => {
    if (event.client_id !== clientId) return false;
    const days = daysUntil(event.event_date, now);
    return days !== null && days >= 0 && days <= PRIORITY_EVENT_WINDOW_DAYS;
  });
}

/**
 * Priority Clients (Checkpoint 7, Step 4) — a deterministic rule, never a
 * model judgment: VIP status, or an Event coming up within
 * `PRIORITY_EVENT_WINDOW_DAYS`. Inactive Clients is a direct status read
 * (`internal_status === "inactive"`) — no invented heuristic.
 */
function classifyClients(
  clients: CrmAssistantMaterials["clients"],
  events: CrmAssistantMaterials["events"],
  now: Date,
): { priorityClients: CrmAssistantClientSummary[]; inactiveClients: CrmAssistantClientSummary[] } {
  const priorityClients: CrmAssistantClientSummary[] = [];
  const inactiveClients: CrmAssistantClientSummary[] = [];

  for (const client of clients) {
    const summary = toClientSummary(client);
    if (client.internal_status === "inactive") inactiveClients.push(summary);
    if (client.is_vip || isEventUpcomingSoon(events, client.id, now)) priorityClients.push(summary);
  }

  return { priorityClients, inactiveClients };
}

/**
 * Clients At Risk (Checkpoint 7, Step 4) — a Client with at least one
 * unsigned Contract or at least one overdue Invoice. `reasons` are computed
 * facts (a real Contract number, a real formatted overdue amount), never a
 * model's own claim — the model may only add a short *explanation* for an
 * already-identified risk (`clientRiskExplanations`, matched by `clientId`
 * in `assembleBrief.ts`), never decide who counts as at-risk in the first
 * place.
 */
function classifyClientsAtRisk(
  clients: CrmAssistantMaterials["clients"],
  unsignedContracts: CrmAssistantContractSummary[],
  overdueInvoices: CrmAssistantInvoiceSummary[],
): CrmAssistantClientRisk[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const reasonsByClientId = new Map<string, string[]>();

  function addReason(clientId: string, reason: string): void {
    const existing = reasonsByClientId.get(clientId) ?? [];
    existing.push(reason);
    reasonsByClientId.set(clientId, existing);
  }

  for (const contract of unsignedContracts) {
    addReason(contract.clientId, `Unsigned contract ${contract.contractNumber}`);
  }
  for (const invoice of overdueInvoices) {
    addReason(invoice.clientId, `Overdue invoice ${invoice.invoiceNumber} (${formatMoney(invoice.balanceMinor, invoice.currency)})`);
  }

  return [...reasonsByClientId.entries()]
    .map(([clientId, reasons]) => {
      const client = clientById.get(clientId);
      return client ? { clientId, name: `${client.first_name} ${client.last_name}`.trim(), reasons } : null;
    })
    .filter((risk): risk is CrmAssistantClientRisk => risk !== null);
}

/** Active Leads (feeds "Upcoming Opportunities") — every stage except the three terminal ones, newest first, bounded. */
function classifyActiveLeads(leads: CrmAssistantMaterials["leads"]): CrmAssistantLeadSummary[] {
  return leads
    .filter((lead) => !CLOSED_LEAD_STATUSES.has(lead.status))
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, ACTIVE_LEADS_LIMIT)
    .map(toLeadSummary);
}

function classifyEvents(events: CrmAssistantMaterials["events"], now: Date): { upcomingEvents: CrmAssistantEventSummary[]; pastEvents: CrmAssistantEventSummary[] } {
  const upcoming: CrmAssistantEventSummary[] = [];
  const past: CrmAssistantEventSummary[] = [];

  for (const event of events) {
    const days = daysUntil(event.event_date, now);
    if (days === null || days >= 0) upcoming.push(toEventSummary(event));
    else past.push(toEventSummary(event));
  }

  upcoming.sort((a, b) => (a.eventDate ?? "9999-99-99").localeCompare(b.eventDate ?? "9999-99-99"));
  past.sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? ""));

  return { upcomingEvents: upcoming.slice(0, UPCOMING_EVENTS_LIMIT), pastEvents: past.slice(0, PAST_EVENTS_LIMIT) };
}

function computeCommunicationSummary(activity: CrmAssistantActivityEntry[]): CrmCommunicationSummary {
  const touchpoints = activity.filter((entry) => COMMUNICATION_ACTIVITY_TYPES.has(entry.action));
  const mostRecent = touchpoints.reduce<string | null>((latest, entry) => {
    if (latest === null || entry.occurredAt > latest) return entry.occurredAt;
    return latest;
  }, null);
  return { totalLoggedTouchpoints: touchpoints.length, mostRecentTouchpointAt: mostRecent };
}

/**
 * Pure and deterministic — the only place `CrmAssistantContext` is
 * assembled (Checkpoint 7, Step 2). `recentMemories` is left empty here;
 * it's populated by the Skill's own `composeContext`, which owns merging
 * in whatever the optional `"memory"` Context Orchestrator section
 * supplied — the same separation of concerns `dailyBriefContext`/
 * `previousSnapshot` already established in Checkpoint 6.
 */
export function buildCrmAssistantContext(materials: CrmAssistantMaterials, now: Date = clockNow()): CrmAssistantContext {
  const { priorityClients, inactiveClients } = classifyClients(materials.clients, materials.events, now);
  const activeLeads = classifyActiveLeads(materials.leads);
  const { upcomingEvents, pastEvents } = classifyEvents(materials.events, now);

  const unsignedContracts = materials.contracts.filter((contract) => contract.signature_status === "unsigned").map(toContractSummary);
  const outstandingInvoices = materials.invoices
    .filter((invoice) => invoice.balance_minor > 0 && invoice.status !== "voided" && invoice.status !== "archived")
    .map(toInvoiceSummary);
  const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.status === "overdue");

  const clientsAtRisk = classifyClientsAtRisk(materials.clients, unsignedContracts, overdueInvoices);

  const outstandingBalanceMinor = sumMinor(outstandingInvoices.map((invoice) => invoice.balanceMinor));
  const outstandingCurrency = outstandingInvoices[0]?.currency ?? materials.invoices[0]?.currency ?? "USD";

  const proposalHistory = materials.proposals
    .slice()
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
    .slice(0, PROPOSAL_HISTORY_LIMIT)
    .map(toProposalSummary);

  const recentDailyBriefs = materials.dailyBriefExecutions.map(toDailyBriefSummary);

  const recentActivity: CrmAssistantActivityEntry[] = materials.activity
    .slice()
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map((entry) => ({ action: entry.action, ownerType: entry.owner_type, occurredAt: entry.occurred_at }));

  return {
    generatedAt: now.toISOString(),
    totalClientCount: materials.clients.length,
    totalLeadCount: materials.leads.length,
    priorityClients,
    inactiveClients,
    clientsAtRisk,
    activeLeads,
    upcomingEvents,
    pastEvents,
    unsignedContracts,
    outstandingInvoices,
    outstandingBalanceMinor,
    outstandingCurrency,
    proposalHistory,
    recentDailyBriefs,
    recentActivity,
    communicationSummary: computeCommunicationSummary(recentActivity),
    recentMemories: [],
    unavailableCategories: materials.unavailableCategories,
  };
}
