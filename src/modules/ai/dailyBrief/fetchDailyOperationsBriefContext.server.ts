import { getDataMode } from "@/lib/env";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { fetchEventContextRecord, type EventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { getInvoices, getContracts, getClients } from "@/lib/data";
import { getCoreNotificationsService } from "@/core/notifications";
import { getCoreAuditLogService } from "@/core/audit";
import type { Invoice } from "@/types/invoice";
import type { Contract } from "@/types/contract";
import type { Client } from "@/types/client";
import type { AuditLogEntry } from "@/core/audit/types";

/** Mock mode has no multi-tenant concept — same "read the flat store" shape `fetchEventContext.server.ts`'s own mock branch uses. */
function listActiveEventIdsMock(): string[] {
  return readEvents()
    .filter((event) => event.status !== "archived")
    .map((event) => event.id);
}

/**
 * `@/lib/supabase/server` is imported dynamically, only inside this
 * `"supabase"`-mode branch — same reasoning as `clientContextBuilder.ts`'s
 * own doc comment: that module is marked `import "server-only"`, which
 * throws the instant it loads in a jsdom test environment. A static
 * top-level import here would break every test that transitively registers
 * `dailyBriefContextBuilder` (via `registerDefaultAIContextBuilders`,
 * called by every AI feature's entry point) without itself mocking
 * `@/lib/supabase/server` — this file no longer needs its own
 * `import "server-only"` guard either, since every other call it makes
 * (`@/lib/data`, `@/core/notifications`, `@/core/audit`) is already safe to
 * import from anywhere, exactly like `getDashboardMetrics`'s own precedent.
 */
async function listActiveEventIdsSupabase(): Promise<string[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("id").neq("status", "archived");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map((row: { id: string }) => row.id);
}

/**
 * Server-only, workspace-wide fetch of every active Event's own context —
 * deliberately reuses `fetchEventContextRecord` per Event rather than
 * writing a second per-Event read path (same N+1-but-accepted shape
 * `OperationalPipelineBoard`'s own loader already uses).
 */
export async function fetchDailyOperationsBriefRecords(): Promise<EventContextRecord[]> {
  const ids = getDataMode() !== "supabase" ? listActiveEventIdsMock() : await listActiveEventIdsSupabase();
  const records = await Promise.all(ids.map((id) => fetchEventContextRecord(id)));
  return records.filter((record): record is EventContextRecord => record !== null);
}

/**
 * `getInvoices`/`getContracts`/`getClients` (`@/lib/data`) are safe to call
 * as-is in mock mode (no session lookup at all), but in `"supabase"` mode
 * their repositories are wired to the *browser* Supabase client
 * (`getClientWorkspaceSession`, `@/lib/auth/workspaceSessionClient.ts`) and
 * throw "Authentication is required." the instant they're called from
 * server-side code — confirmed live, the same documented constraint
 * `fetchEventContextRecord.ts`'s own doc comment already names ("that
 * repository... can't be called from a Server Action, so a `use server` AI
 * action needs its own server-side read path"). These three functions are
 * that same server-side read path for Finance/Contracts/Clients, workspace-
 * scoped via RLS the same way `fetchEventContextRecordSupabase` already is.
 */
async function fetchLateInvoicesSupabase(): Promise<Invoice[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapInvoiceRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoices").select("*").eq("status", "overdue");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInvoiceRow);
}

async function fetchUnsignedContractsSupabase(): Promise<Contract[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapContractRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("contracts").select("*").eq("signature_status", "unsigned");
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapContractRow);
}

async function fetchHighPriorityClientsSupabase(): Promise<Client[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { mapClientRow } = await import("@/lib/supabase/mappers");
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("*").eq("is_vip", true);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapClientRow);
}

function fetchLateInvoices(): Promise<Invoice[]> {
  return getDataMode() !== "supabase" ? getInvoices({ overdueOnly: true }) : fetchLateInvoicesSupabase();
}

function fetchUnsignedContracts(): Promise<Contract[]> {
  return getDataMode() !== "supabase" ? getContracts({ signatureStatus: "unsigned" }) : fetchUnsignedContractsSupabase();
}

function fetchHighPriorityClients(): Promise<Client[]> {
  return getDataMode() !== "supabase" ? getClients({ vipOnly: true }) : fetchHighPriorityClientsSupabase();
}

/** One of the 7 independently-fetched data categories the Daily Brief aggregates. */
export type DailyBriefDataCategory = "events" | "finance" | "contracts" | "clients" | "notifications" | "activity";

export interface DailyOperationsBriefMaterials {
  eventRecords: EventContextRecord[];
  lateInvoices: Invoice[];
  unsignedContracts: Contract[];
  highPriorityClients: Client[];
  unreadNotificationCount: number;
  recentActivity: AuditLogEntry[];
  unavailableCategories: DailyBriefDataCategory[];
}

function settledOr<T>(result: PromiseSettledResult<T>, fallback: T, category: DailyBriefDataCategory, unavailable: DailyBriefDataCategory[]): T {
  if (result.status === "fulfilled") return result.value;
  unavailable.push(category);
  return fallback;
}

/**
 * Fetches every raw material `contextBuilder.ts` aggregates into a
 * `DailyOperationsBriefContext`, one category at a time via
 * `Promise.allSettled` — a single failing data source (e.g. Finance being
 * temporarily unavailable) never blanks out the rest of the brief; it's
 * simply named in the returned `unavailableCategories` and reflected in
 * `confidence`/`missingInformation` rather than aborting the whole
 * generation. `memberId` scopes the unread-notification count to the
 * member who triggered generation — there is no "unread notifications for
 * the whole Workspace" concept (notifications are per-recipient by design).
 */
export async function fetchDailyOperationsBriefMaterials(workspaceId: string, memberId: string): Promise<DailyOperationsBriefMaterials> {
  const [eventsResult, invoicesResult, contractsResult, clientsResult, notificationsResult, activityResult] =
    await Promise.allSettled([
      fetchDailyOperationsBriefRecords(),
      fetchLateInvoices(),
      fetchUnsignedContracts(),
      fetchHighPriorityClients(),
      getCoreNotificationsService().getNotificationsForMember(workspaceId, memberId),
      getCoreAuditLogService().getAuditLogForWorkspace(workspaceId),
    ]);

  const unavailableCategories: DailyBriefDataCategory[] = [];
  const eventRecords = settledOr(eventsResult, [], "events", unavailableCategories);
  const lateInvoices = settledOr(invoicesResult, [], "finance", unavailableCategories);
  const unsignedContracts = settledOr(contractsResult, [], "contracts", unavailableCategories);
  const highPriorityClients = settledOr(clientsResult, [], "clients", unavailableCategories);
  const unreadNotifications = settledOr(notificationsResult, [], "notifications", unavailableCategories);
  const recentActivity = settledOr(activityResult, [], "activity", unavailableCategories);

  return {
    eventRecords,
    lateInvoices,
    unsignedContracts,
    highPriorityClients,
    unreadNotificationCount: unreadNotifications.filter((n) => n.read_at === null).length,
    recentActivity,
    unavailableCategories,
  };
}
