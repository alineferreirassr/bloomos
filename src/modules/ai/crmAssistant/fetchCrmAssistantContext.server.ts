import { getDataMode } from "@/lib/env";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { getClients, getLeads, getEvents, getContracts, getInvoices } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief";
import { getCoreAuditLogService } from "@/core/audit";
import type { Client } from "@/types/client";
import type { Lead } from "@/types/lead";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { ProposalDraft } from "@/types/proposal";
import type { DailyBriefExecution } from "@/types/dailyBriefExecution";
import type { AuditLogEntry } from "@/core/audit/types";
import type { CrmAssistantDataCategory } from "@/modules/ai/crmAssistant/types";

const RECENT_PROPOSALS_LIMIT = 50;
const RECENT_DAILY_BRIEFS_LIMIT = 5;

/**
 * `getClients`/`getLeads`/`getEvents`/`getContracts`/`getInvoices` (`@/lib/data`)
 * are safe to call as-is in mock mode, but in `"supabase"` mode every one of
 * their repositories is wired to the *browser* Supabase client
 * (`getClientWorkspaceSession`, `@/lib/auth/workspaceSessionClient.ts`) and
 * throws "Authentication is required." the instant it's called from
 * server-side code — the exact same constraint `fetchDailyOperationsBriefContext.server.ts`
 * already works around for Finance/Contracts/Clients. These five functions
 * are that same server-side read path, extended to Leads and Events, each
 * workspace-scoped via RLS rather than an explicit filter (`select("*")`
 * with no `.eq`, unlike Daily Brief's own narrower unsigned/overdue reads —
 * this Skill needs the full workspace picture to classify Clients/Leads
 * itself, not a single pre-filtered slice).
 */
async function fetchClientsSupabase(): Promise<Client[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapClientRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapClientRow);
}

async function fetchLeadsSupabase(): Promise<Lead[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapLeadRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapLeadRow);
}

async function fetchEventsSupabase(): Promise<Event[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapEventRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").neq("status", "archived");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventRow);
}

async function fetchContractsSupabase(): Promise<Contract[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapContractRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("contracts").select("*");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapContractRow);
}

async function fetchInvoicesSupabase(): Promise<Invoice[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapInvoiceRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoices").select("*");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInvoiceRow);
}

function fetchClients(): Promise<Client[]> {
  return getDataMode() !== "supabase" ? getClients({ includeArchived: false }) : fetchClientsSupabase();
}

function fetchLeads(): Promise<Lead[]> {
  return getDataMode() !== "supabase" ? getLeads({ includeArchived: false }) : fetchLeadsSupabase();
}

function fetchEvents(): Promise<Event[]> {
  return getDataMode() !== "supabase" ? getEvents({ includeArchived: false }) : fetchEventsSupabase();
}

function fetchContracts(): Promise<Contract[]> {
  return getDataMode() !== "supabase" ? getContracts({ includeArchived: false }) : fetchContractsSupabase();
}

function fetchInvoices(): Promise<Invoice[]> {
  return getDataMode() !== "supabase" ? getInvoices({ includeArchived: false }) : fetchInvoicesSupabase();
}

export interface CrmAssistantMaterials {
  clients: Client[];
  leads: Lead[];
  events: Event[];
  contracts: Contract[];
  invoices: Invoice[];
  /** Always mock-only, workspace-wide by design — `getProposalsRepository()` never routes through `selectRepository()` yet (no real `proposals` table this phase), see its own doc comment. */
  proposals: ProposalDraft[];
  /** Always mock-only, same rationale as `proposals` — `getDailyBriefExecutionsRepository()` never routes through `selectRepository()` yet either. */
  dailyBriefExecutions: DailyBriefExecution[];
  /** Always mock-only — `getCoreAuditLogService()` is hardcoded to the mock repository this phase, regardless of data mode. */
  activity: AuditLogEntry[];
  unavailableCategories: CrmAssistantDataCategory[];
}

function settledOr<T>(result: PromiseSettledResult<T>, fallback: T, category: CrmAssistantDataCategory, unavailable: CrmAssistantDataCategory[]): T {
  if (result.status === "fulfilled") return result.value;
  unavailable.push(category);
  return fallback;
}

/**
 * Fetches every raw material `contextBuilder.ts` classifies into a
 * `CrmAssistantContext`, one category at a time via `Promise.allSettled` —
 * a single failing data source never blanks out the rest of the report;
 * it's named in `unavailableCategories` and reflected in
 * `confidence`/`missingInformation`, the same resilience pattern
 * `fetchDailyOperationsBriefMaterials` already established.
 */
export async function fetchCrmAssistantMaterials(workspaceId: string): Promise<CrmAssistantMaterials> {
  const [clientsResult, leadsResult, eventsResult, contractsResult, invoicesResult, proposalsResult, dailyBriefsResult, activityResult] =
    await Promise.allSettled([
      fetchClients(),
      fetchLeads(),
      fetchEvents(),
      fetchContracts(),
      fetchInvoices(),
      getProposalsRepository().getRecentProposals(workspaceId, RECENT_PROPOSALS_LIMIT),
      getDailyBriefExecutionsRepository().getRecentExecutions(workspaceId, RECENT_DAILY_BRIEFS_LIMIT),
      getCoreAuditLogService().getAuditLogForWorkspace(workspaceId),
    ]);

  const unavailableCategories: CrmAssistantDataCategory[] = [];
  const clients = settledOr(clientsResult, [], "clients", unavailableCategories);
  const leads = settledOr(leadsResult, [], "leads", unavailableCategories);
  const events = settledOr(eventsResult, [], "events", unavailableCategories);
  const contracts = settledOr(contractsResult, [], "contracts", unavailableCategories);
  const invoices = settledOr(invoicesResult, [], "finance", unavailableCategories);
  const proposals = settledOr(proposalsResult, [], "proposals", unavailableCategories);
  const dailyBriefExecutions = settledOr(dailyBriefsResult, [], "dailyBriefs", unavailableCategories);
  const activity = settledOr(activityResult, [], "activity", unavailableCategories);

  return { clients, leads, events, contracts, invoices, proposals, dailyBriefExecutions, activity, unavailableCategories };
}
