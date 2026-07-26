import type { Database, Json } from "@/types/database.types";
import type { Contract, ContractVersionSnapshot } from "@/types/contract";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { CONTRACT_STATUS_LABELS, type ContractStatus } from "@/core/enums/contractStatus";
import { canTransitionContractStatus, isContractClosed, getContractNextRecommendedAction } from "@/core/workflows/contractWorkflow";
import { contractSchema, contractExhibitSchema, type ContractInput, type ContractExhibitInput } from "@/modules/contracts/schema";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import {
  mapContractRow,
  mapContractTemplateRow,
  mapContractExhibitRow,
  mapClientRow,
  mapNoteRow,
  mapTimelineActivityRow,
} from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type {
  ContractFilters,
  ContractTemplateFilters,
  ContractsRepository,
} from "@/lib/data/contracts/repository";
import { getFullName } from "@/lib/personName";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;
type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];
type ContractInsert = Omit<Database["public"]["Tables"]["contracts"]["Insert"], "contract_number">;

const MAX_CONTRACT_NUMBER_ATTEMPTS = 5;
const UNIQUE_VIOLATION = "23505";
const UNKNOWN_ERROR_CODE = "unknown";

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Same rationale as leads/clients/events/media supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

/** Contract Notes/Timeline always use owner_type='contract' — no sub-entity (unlike Events' Checklist/Schedule) ever records under a different owner_type, so this is hardcoded like Leads/Clients' insertTimelineActivity rather than parameterized like Events'. */
async function insertTimelineActivity(
  supabase: SupabaseClient,
  actor: string,
  workspaceId: string,
  contractId: string,
  type: TimelineActivity["type"],
  description: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: "contract",
    owner_id: contractId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Internal existence check — returns null rather than throwing, matching every other Supabase repository's fetchXRow pattern. RLS means a Contract in another Workspace is simply invisible here. */
async function fetchContractRow(id: string): Promise<Contract | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("contracts").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapContractRow(data) : null;
}

async function fetchContractExhibitRow(id: string): Promise<ContractExhibit | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("contract_exhibits").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapContractExhibitRow(data) : null;
}

/**
 * Generates a candidate contract_number via the generate_contract_number()
 * Postgres function, then inserts. If a concurrent writer won the race for
 * that exact number, the workspace-scoped unique index rejects the insert
 * with a 23505; this retries with a freshly generated number rather than
 * surfacing the conflict to the caller — the same "duplicate requests
 * cannot create duplicate numbers" guarantee the mock's in-memory collision
 * loop provided, made durable across concurrent connections.
 */
async function insertContractWithGeneratedNumber(
  supabase: SupabaseClient,
  workspaceId: string,
  rowWithoutNumber: ContractInsert,
): Promise<{ data: ContractRow | null; error: { code?: string } | null }> {
  for (let attempt = 1; attempt <= MAX_CONTRACT_NUMBER_ATTEMPTS; attempt++) {
    const { data: contractNumber, error: numberError } = await supabase.rpc("generate_contract_number", {
      p_workspace_id: workspaceId,
    });
    if (numberError) throw normalizeSupabaseError(numberError);

    const { data, error } = await supabase
      .from("contracts")
      .insert({ ...rowWithoutNumber, contract_number: contractNumber as string })
      .select("*")
      .single();

    if (!error) return { data, error: null };
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION || attempt === MAX_CONTRACT_NUMBER_ATTEMPTS) {
      return { data: null, error };
    }
    // Unique violation on contract_number specifically — retry with a freshly generated one.
  }
  // Unreachable — the loop always returns on its final attempt.
  return { data: null, error: { code: UNKNOWN_ERROR_CODE } };
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

async function getContracts(filters: ContractFilters = {}): Promise<Contract[]> {
  const session = await requireWorkspaceSession();
  const {
    search,
    status,
    signatureStatus,
    clientId,
    eventId,
    effectiveDateFrom,
    effectiveDateTo,
    includeArchived = false,
  } = filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("contracts").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) query = query.neq("status", "archived");
  if (status && status !== "all") query = query.eq("status", status);
  if (signatureStatus && signatureStatus !== "all") query = query.eq("signature_status", signatureStatus);
  if (clientId) query = query.eq("client_id", clientId);
  if (eventId) query = query.eq("event_id", eventId);
  if (effectiveDateFrom) query = query.gte("effective_date", effectiveDateFrom);
  if (effectiveDateTo) query = query.lte("effective_date", effectiveDateTo);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  const contracts = (data ?? []).map(mapContractRow);

  const q = search?.trim().toLowerCase();
  if (!q) return contracts;

  const { data: clientRows, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", session.workspace.id);
  if (clientsError) throw normalizeSupabaseError(clientsError);
  const clientsById = new Map((clientRows ?? []).map(mapClientRow).map((c) => [c.id, c]));

  const { data: eventRows, error: eventsError } = await supabase
    .from("events")
    .select("id, title")
    .eq("workspace_id", session.workspace.id);
  if (eventsError) throw normalizeSupabaseError(eventsError);
  const eventTitlesById = new Map((eventRows ?? []).map((e: { id: string; title: string }) => [e.id, e.title]));

  return contracts.filter((contract) => {
    const client = clientsById.get(contract.client_id);
    const clientName = client ? getFullName(client) : "";
    const eventTitle = contract.event_id ? (eventTitlesById.get(contract.event_id) ?? "") : "";
    const haystack = `${contract.contract_number} ${contract.title} ${clientName} ${eventTitle}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getContract(id: string): Promise<Contract> {
  const contract = await fetchContractRow(id);
  if (!contract) {
    throw new NotFoundError(`Contract ${id} was not found`);
  }
  return contract;
}

function computeRemainingBalance(totalValue: number | null, depositAmount: number | null): number | null {
  if (totalValue === null) return null;
  return totalValue - (depositAmount ?? 0);
}

async function createContract(input: ContractInput): Promise<DataResult<Contract>> {
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.client_id)
    .maybeSingle();
  if (clientError) throw normalizeSupabaseError(clientError);
  if (!clientRow) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  const client = mapClientRow(clientRow);

  if (parsed.data.event_id !== null) {
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", parsed.data.event_id)
      .maybeSingle();
    if (eventError) throw normalizeSupabaseError(eventError);
    if (!eventRow) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (eventRow.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.template_id !== null) {
    const { data: templateRow, error: templateError } = await supabase
      .from("contract_templates")
      .select("id")
      .eq("id", parsed.data.template_id)
      .maybeSingle();
    if (templateError) throw normalizeSupabaseError(templateError);
    if (!templateRow) {
      return fail("Please select a valid template.", { template_id: "Template not found." });
    }
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);

  const { data, error } = await insertContractWithGeneratedNumber(supabase, client.workspace_id, {
    workspace_id: client.workspace_id,
    ...parsed.data,
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    remaining_balance: computeRemainingBalance(parsed.data.total_value, parsed.data.deposit_amount),
  });
  if (error) throw normalizeSupabaseError(error);

  const contract = mapContractRow(data as ContractRow);
  await insertTimelineActivity(supabase, actor, contract.workspace_id, contract.id, "contract_created", `Contract created: "${contract.title}"`);

  return ok(contract);
}

async function updateContract(id: string, input: ContractInput): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status === "archived") {
    return fail("This contract is archived and read-only.");
  }

  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (parsed.data.client_id !== existing.client_id) {
    return fail("A contract's client can't be changed after creation.", {
      client_id: "Client cannot be changed.",
    });
  }

  const supabase = createSupabaseClient();
  if (parsed.data.event_id !== null) {
    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", parsed.data.event_id)
      .maybeSingle();
    if (eventError) throw normalizeSupabaseError(eventError);
    if (!eventRow) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (eventRow.client_id !== existing.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.template_id !== null) {
    const { data: templateRow, error: templateError } = await supabase
      .from("contract_templates")
      .select("id")
      .eq("id", parsed.data.template_id)
      .maybeSingle();
    if (templateError) throw normalizeSupabaseError(templateError);
    if (!templateRow) {
      return fail("Please select a valid template.", { template_id: "Template not found." });
    }
  }

  const session = await requireWorkspaceSession();

  const snapshot: ContractVersionSnapshot = {
    version: existing.version,
    title: existing.title,
    description: existing.description,
    total_value: existing.total_value,
    deposit_amount: existing.deposit_amount,
    recorded_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contracts")
    .update({
      ...parsed.data,
      version: existing.version + 1,
      version_history: [...existing.version_history, snapshot] as unknown as Json,
      remaining_balance: computeRemainingBalance(parsed.data.total_value, parsed.data.deposit_amount),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "contract_updated",
    `Contract updated: "${updated.title}"`,
  );

  return ok(updated);
}

async function updateContractStatus(id: string, status: ContractStatus): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (!canTransitionContractStatus(existing.status, status)) {
    return fail(
      `Cannot move a contract from "${CONTRACT_STATUS_LABELS[existing.status]}" to "${CONTRACT_STATUS_LABELS[status]}".`,
    );
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("contracts").update({ status }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    id,
    "contract_updated",
    `Status changed from ${CONTRACT_STATUS_LABELS[existing.status]} to ${CONTRACT_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

async function sendContract(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "draft" && existing.status !== "review" && existing.status !== "ready") {
    return fail(`Cannot send a contract that is already ${CONTRACT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "sent", signature_status: "sent", sent_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_sent", `Contract sent: "${existing.title}"`);

  return ok(updated);
}

/** Idempotent: re-marking an already-viewed contract keeps its original viewed_at. */
async function markViewed(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("This contract hasn't been sent yet.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "viewed", signature_status: "viewed", viewed_at: existing.viewed_at ?? timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_viewed", `Contract viewed: "${existing.title}"`);

  return ok(updated);
}

async function markSigned(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("This contract must be sent before it can be signed.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "signed", signature_status: "signed", signed_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_signed", `Contract signed: "${existing.title}"`);

  return ok(updated);
}

async function markDeclined(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("Only a sent or viewed contract can be declined.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "declined", signature_status: "declined", declined_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_declined", `Contract declined: "${existing.title}"`);

  return ok(updated);
}

async function expireContract(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("Only a sent or viewed contract can expire.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "expired", signature_status: "expired" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_updated", `Contract expired: "${existing.title}"`);

  return ok(updated);
}

async function cancelContract(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (isContractClosed(existing.status)) {
    return fail(
      `This contract is already ${CONTRACT_STATUS_LABELS[existing.status].toLowerCase()} and can't be cancelled.`,
    );
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "cancelled", signature_status: "cancelled", cancelled_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_cancelled", `Contract cancelled: "${existing.title}"`);

  return ok(updated);
}

async function completeContract(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "signed") {
    return fail("Only a signed contract can be marked completed.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "completed" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_completed", `Contract completed: "${existing.title}"`);

  return ok(updated);
}

async function archiveContract(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status === "archived") {
    return fail("This contract is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_archived", "Contract archived");

  return ok(updated);
}

async function restoreContract(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "archived") {
    return fail("This contract is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contracts")
    .update({ status: "draft", archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapContractRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, id, "contract_restored", "Contract restored");

  return ok(updated);
}

async function duplicateContract(id: string): Promise<DataResult<Contract>> {
  const existing = await fetchContractRow(id);
  if (!existing) {
    return fail("Contract not found.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await insertContractWithGeneratedNumber(supabase, existing.workspace_id, {
    workspace_id: existing.workspace_id,
    client_id: existing.client_id,
    event_id: existing.event_id,
    template_id: existing.template_id,
    title: existing.title,
    description: existing.description,
    effective_date: existing.effective_date,
    expiration_date: existing.expiration_date,
    total_value: existing.total_value,
    deposit_required: existing.deposit_required,
    deposit_amount: existing.deposit_amount,
    remaining_balance: existing.remaining_balance,
    currency: existing.currency,
    notes: existing.notes,
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
  });
  if (error) throw normalizeSupabaseError(error);

  const duplicate = mapContractRow(data as ContractRow);
  await insertTimelineActivity(
    supabase,
    actor,
    duplicate.workspace_id,
    duplicate.id,
    "contract_created",
    `Contract created (duplicated from ${existing.contract_number})`,
  );

  return ok(duplicate);
}

async function getContractNextAction(contractId: string): Promise<string | null> {
  const contract = await getContract(contractId);
  return getContractNextRecommendedAction(contract);
}

// ---------------------------------------------------------------------------
// Contract Templates — read-only in this phase.
// ---------------------------------------------------------------------------

async function getContractTemplates(filters: ContractTemplateFilters = {}): Promise<ContractTemplate[]> {
  const session = await requireWorkspaceSession();
  const { category, activeOnly = false } = filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("contract_templates").select("*").eq("workspace_id", session.workspace.id);
  if (activeOnly) query = query.eq("active", true);
  if (category && category !== "all") query = query.eq("category", category);

  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapContractTemplateRow);
}

async function getContractTemplateById(id: string): Promise<ContractTemplate> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("contract_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) {
    throw new NotFoundError(`Contract template ${id} was not found`);
  }
  return mapContractTemplateRow(data);
}

// ---------------------------------------------------------------------------
// Contract Exhibits
// ---------------------------------------------------------------------------

/** Shared by getContractExhibitsByContractId and reorderContractExhibits, which both need this query but must not re-fetch the Contract row a second time once they already have it. */
async function fetchContractExhibitsForContract(workspaceId: string, contractId: string): Promise<ContractExhibit[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contract_exhibits")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("contract_id", contractId)
    .order("display_order", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapContractExhibitRow);
}

async function getContractExhibitById(id: string): Promise<ContractExhibit> {
  const exhibit = await fetchContractExhibitRow(id);
  if (!exhibit) {
    throw new NotFoundError(`Contract exhibit ${id} was not found`);
  }
  return exhibit;
}

async function getContractExhibitsByContractId(contractId: string): Promise<ContractExhibit[]> {
  const contract = await fetchContractRow(contractId);
  if (!contract) return [];
  return fetchContractExhibitsForContract(contract.workspace_id, contractId);
}

async function createContractExhibit(
  contractId: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  const contract = await fetchContractRow(contractId);
  if (!contract) {
    return fail("Contract not found.");
  }

  const parsed = contractExhibitSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { count, error: countError } = await supabase
    .from("contract_exhibits")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", contract.workspace_id)
    .eq("contract_id", contractId);
  if (countError) throw normalizeSupabaseError(countError);

  const { data, error } = await supabase
    .from("contract_exhibits")
    .insert({
      workspace_id: contract.workspace_id,
      contract_id: contractId,
      ...parsed.data,
      display_order: count ?? 0,
      document_id: null,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapContractExhibitRow(data));
}

async function updateContractExhibit(
  id: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  const existing = await fetchContractExhibitRow(id);
  if (!existing) {
    return fail("Exhibit not found.");
  }

  const parsed = contractExhibitSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("contract_exhibits")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapContractExhibitRow(data));
}

async function deleteContractExhibit(id: string): Promise<DataResult<null>> {
  const existing = await fetchContractExhibitRow(id);
  if (!existing) {
    return fail("Exhibit not found.");
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from("contract_exhibits").delete().eq("id", id);
  if (error) throw normalizeSupabaseError(error);

  return ok(null);
}

async function reorderContractExhibits(
  contractId: string,
  orderedIds: string[],
): Promise<DataResult<ContractExhibit[]>> {
  const contract = await fetchContractRow(contractId);
  if (!contract) {
    return fail("Contract not found.");
  }

  const ownExhibits = await fetchContractExhibitsForContract(contract.workspace_id, contractId);
  if (orderedIds.length !== ownExhibits.length || !ownExhibits.every((e) => orderedIds.includes(e.id))) {
    return fail("The provided order doesn't match this contract's exhibits.");
  }

  const supabase = createSupabaseClient();
  const { error } = await Promise.all(
    orderedIds.map((id, index) => supabase.from("contract_exhibits").update({ display_order: index }).eq("id", id)),
  ).then((results) => {
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  });
  if (error) throw normalizeSupabaseError(error);

  return ok(await fetchContractExhibitsForContract(contract.workspace_id, contractId));
}

// ---------------------------------------------------------------------------
// Contract Notes and Timeline
// ---------------------------------------------------------------------------

async function getNotesByContractId(contractId: string): Promise<Note[]> {
  const contract = await fetchContractRow(contractId);
  if (!contract) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", contract.workspace_id)
    .eq("owner_type", "contract")
    .eq("owner_id", contractId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapNoteRow);
}

async function createContractNote(contractId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const contract = await fetchContractRow(contractId);
  if (!contract) {
    return fail("Contract not found.");
  }

  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const actor = resolveActorName(session);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: contract.workspace_id,
      owner_type: "contract",
      owner_id: contractId,
      ...parsed.data,
      is_pinned: false,
      attachments: [],
      created_by: actor,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const note = mapNoteRow(data);
  await insertTimelineActivity(supabase, actor, contract.workspace_id, contractId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

async function togglePinContractNote(noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data: noteRow, error: fetchError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("owner_type", "contract")
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (fetchError) throw normalizeSupabaseError(fetchError);
  if (!noteRow) return null;

  const note = mapNoteRow(noteRow);
  const nextPinned = !note.is_pinned;
  const { data: updatedRow, error: updateError } = await supabase
    .from("notes")
    .update({ is_pinned: nextPinned })
    .eq("id", noteId)
    .eq("owner_type", "contract")
    .eq("owner_id", note.owner_id)
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();
  if (updateError) throw normalizeSupabaseError(updateError);

  const updated = mapNoteRow(updatedRow);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    note.workspace_id,
    note.owner_id,
    nextPinned ? "note_pinned" : "note_unpinned",
    `${nextPinned ? "Note pinned" : "Note unpinned"}: "${note.title}"`,
  );

  return ok(updated);
}

async function getTimelineByContractId(contractId: string): Promise<TimelineActivity[]> {
  const contract = await fetchContractRow(contractId);
  if (!contract) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", contract.workspace_id)
    .eq("owner_type", "contract")
    .eq("owner_id", contractId)
    .order("timestamp", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapTimelineActivityRow);
}

export const supabaseContractsRepository: ContractsRepository = {
  getContracts,
  getContract,
  createContract,
  updateContract,
  updateContractStatus,
  sendContract,
  markViewed,
  markSigned,
  markDeclined,
  expireContract,
  cancelContract,
  completeContract,
  archiveContract,
  restoreContract,
  duplicateContract,
  getContractNextAction,
  getContractTemplates,
  getContractTemplateById,
  getContractExhibitsByContractId,
  getContractExhibitById,
  createContractExhibit,
  updateContractExhibit,
  deleteContractExhibit,
  reorderContractExhibits,
  getNotesByContractId,
  createContractNote,
  togglePinContractNote,
  getTimelineByContractId,
};
