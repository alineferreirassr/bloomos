import { getDataMode } from "@/lib/env";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { getContracts, getInvoices, getPayments, getExpenses, getEvents } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief";
import { getCoreAuditLogService } from "@/core/audit";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";
import type { Event } from "@/types/event";
import type { ProposalDraft } from "@/types/proposal";
import type { DailyBriefExecution } from "@/types/dailyBriefExecution";
import type { AuditLogEntry } from "@/core/audit/types";
import type { FinanceAssistantDataCategory } from "@/modules/ai/financeAssistant/types";

const RECENT_PROPOSALS_LIMIT = 50;
const RECENT_DAILY_BRIEFS_LIMIT = 5;

/**
 * `getContracts`/`getInvoices`/`getPayments`/`getExpenses`/`getEvents`
 * (`@/lib/data`) are safe to call as-is in mock mode, but in `"supabase"`
 * mode every one of their repositories is wired to the *browser* Supabase
 * client (`getClientWorkspaceSession`) and throws "Authentication is
 * required." the instant it's called from server-side code — the exact
 * same constraint `fetchCrmAssistantContext.server.ts` already works
 * around, extended here from Contracts/Invoices/Events to Payments and
 * Expenses too.
 */
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

async function fetchPaymentsSupabase(): Promise<Payment[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapPaymentRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("*");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapPaymentRow);
}

async function fetchExpensesSupabase(): Promise<Expense[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapExpenseRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").select("*");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapExpenseRow);
}

async function fetchEventsSupabase(): Promise<Event[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapEventRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").neq("status", "archived");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventRow);
}

function fetchContracts(): Promise<Contract[]> {
  return getDataMode() !== "supabase" ? getContracts({ includeArchived: false }) : fetchContractsSupabase();
}

function fetchInvoices(): Promise<Invoice[]> {
  return getDataMode() !== "supabase" ? getInvoices({ includeArchived: false }) : fetchInvoicesSupabase();
}

function fetchPayments(): Promise<Payment[]> {
  return getDataMode() !== "supabase" ? getPayments({}) : fetchPaymentsSupabase();
}

function fetchExpenses(): Promise<Expense[]> {
  return getDataMode() !== "supabase" ? getExpenses({ includeArchived: false }) : fetchExpensesSupabase();
}

function fetchEvents(): Promise<Event[]> {
  return getDataMode() !== "supabase" ? getEvents({ includeArchived: false }) : fetchEventsSupabase();
}

export interface FinanceAssistantMaterials {
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  events: Event[];
  /** Always mock-only, workspace-wide by design — `getProposalsRepository()` never routes through `selectRepository()` yet (no real `proposals` table this phase). */
  proposals: ProposalDraft[];
  /** Always mock-only, same rationale as `proposals`. */
  dailyBriefExecutions: DailyBriefExecution[];
  /** Always mock-only — `getCoreAuditLogService()` is hardcoded to the mock repository this phase. */
  activity: AuditLogEntry[];
  unavailableCategories: FinanceAssistantDataCategory[];
}

function settledOr<T>(result: PromiseSettledResult<T>, fallback: T, category: FinanceAssistantDataCategory, unavailable: FinanceAssistantDataCategory[]): T {
  if (result.status === "fulfilled") return result.value;
  unavailable.push(category);
  return fallback;
}

/**
 * Fetches every raw material `contextBuilder.ts` classifies into a
 * `FinanceAssistantContext`, one category at a time via `Promise.allSettled`
 * — a single failing data source never blanks out the rest of the report;
 * it's named in `unavailableCategories` and reflected in
 * `confidence`/`missingInformation`, the same resilience pattern every
 * prior checkpoint's own materials fetch already established.
 */
export async function fetchFinanceAssistantMaterials(workspaceId: string): Promise<FinanceAssistantMaterials> {
  const [contractsResult, invoicesResult, paymentsResult, expensesResult, eventsResult, proposalsResult, dailyBriefsResult, activityResult] =
    await Promise.allSettled([
      fetchContracts(),
      fetchInvoices(),
      fetchPayments(),
      fetchExpenses(),
      fetchEvents(),
      getProposalsRepository().getRecentProposals(workspaceId, RECENT_PROPOSALS_LIMIT),
      getDailyBriefExecutionsRepository().getRecentExecutions(workspaceId, RECENT_DAILY_BRIEFS_LIMIT),
      getCoreAuditLogService().getAuditLogForWorkspace(workspaceId),
    ]);

  const unavailableCategories: FinanceAssistantDataCategory[] = [];
  const contracts = settledOr(contractsResult, [], "contracts", unavailableCategories);
  const invoices = settledOr(invoicesResult, [], "invoices", unavailableCategories);
  const payments = settledOr(paymentsResult, [], "payments", unavailableCategories);
  const expenses = settledOr(expensesResult, [], "expenses", unavailableCategories);
  const events = settledOr(eventsResult, [], "events", unavailableCategories);
  const proposals = settledOr(proposalsResult, [], "proposals", unavailableCategories);
  const dailyBriefExecutions = settledOr(dailyBriefsResult, [], "dailyBriefs", unavailableCategories);
  const activity = settledOr(activityResult, [], "activity", unavailableCategories);

  return { contracts, invoices, payments, expenses, events, proposals, dailyBriefExecutions, activity, unavailableCategories };
}
