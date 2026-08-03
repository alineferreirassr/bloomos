import type { Contract, ContractVersionSnapshot } from "@/types/contract";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
import { CONTRACT_STATUS_LABELS, type ContractStatus } from "@/core/enums/contractStatus";
import { canTransitionContractStatus, isContractClosed, getContractNextRecommendedAction } from "@/core/workflows/contractWorkflow";
import { contractSchema, contractExhibitSchema, type ContractInput, type ContractExhibitInput } from "@/modules/contracts/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { readContracts, writeContracts } from "@/lib/data/mock/contractsStore";
import { readContractTemplates } from "@/lib/data/mock/contractTemplatesStore";
import { readContractExhibits, writeContractExhibits } from "@/lib/data/mock/contractExhibitsStore";
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import type {
  ContractFilters,
  ContractTemplateFilters,
  ContractsRepository,
} from "@/lib/data/contracts/repository";
import { getFullName } from "@/lib/personName";

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

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

async function getContracts(filters: ContractFilters = {}): Promise<Contract[]> {
  await delay(200);
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
  const clientsById = new Map(readClients().map((client) => [client.id, client]));
  const eventsById = new Map(readEvents().map((event) => [event.id, event]));

  return readContracts().filter((contract) => {
    if (!includeArchived && contract.status === "archived") return false;
    if (status && status !== "all" && contract.status !== status) return false;
    if (signatureStatus && signatureStatus !== "all" && contract.signature_status !== signatureStatus) return false;
    if (clientId && contract.client_id !== clientId) return false;
    if (eventId && contract.event_id !== eventId) return false;
    if (effectiveDateFrom || effectiveDateTo) {
      if (!contract.effective_date) return false;
      if (effectiveDateFrom && contract.effective_date < effectiveDateFrom) return false;
      if (effectiveDateTo && contract.effective_date > effectiveDateTo) return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(contract.client_id);
      const clientName = client ? getFullName(client) : "";
      const event = contract.event_id ? eventsById.get(contract.event_id) : undefined;
      const haystack = `${contract.contract_number} ${contract.title} ${clientName} ${event?.title ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

async function getContract(id: string): Promise<Contract> {
  await delay(150);
  const contract = readContracts().find((c) => c.id === id);
  if (!contract) {
    throw new NotFoundError(`Contract ${id} was not found`);
  }
  return contract;
}

/** Workspace-scoped and collision-checked — extracted verbatim from the prior lib/data/index.ts implementation. */
function generateContractNumber(workspaceId: string): string {
  const year = new Date().getUTCFullYear();
  const workspaceContracts = readContracts().filter((c) => c.workspace_id === workspaceId);
  const existingNumbers = new Set(workspaceContracts.map((c) => c.contract_number));

  let sequence = workspaceContracts.length + 1;
  let candidate = `CT-${year}-${String(sequence).padStart(4, "0")}`;
  while (existingNumbers.has(candidate)) {
    sequence += 1;
    candidate = `CT-${year}-${String(sequence).padStart(4, "0")}`;
  }
  return candidate;
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

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (event.client_id !== parsed.data.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.template_id !== null && !readContractTemplates().some((t) => t.id === parsed.data.template_id)) {
    return fail("Please select a valid template.", { template_id: "Template not found." });
  }

  const timestamp = nowIso();
  const contract: Contract = {
    id: generateId("contract"),
    workspace_id: client.workspace_id,
    contract_number: generateContractNumber(client.workspace_id),
    ...parsed.data,
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    signed_at: null,
    sent_at: null,
    viewed_at: null,
    declined_at: null,
    cancelled_at: null,
    archived_at: null,
    remaining_balance: computeRemainingBalance(parsed.data.total_value, parsed.data.deposit_amount),
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeContracts([...readContracts(), contract]);
  recordTimelineActivity(
    contract.workspace_id,
    "contract",
    contract.id,
    "contract_created",
    `Contract created: "${contract.title}"`,
  );

  return ok(contract);
}

async function updateContract(id: string, input: ContractInput): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
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
  if (parsed.data.event_id !== null) {
    const event = readEvents().find((e) => e.id === parsed.data.event_id);
    if (!event) {
      return fail("Please select a valid event.", { event_id: "Event not found." });
    }
    if (event.client_id !== existing.client_id) {
      return fail("The selected event doesn't belong to this client.", {
        event_id: "Event belongs to a different client.",
      });
    }
  }
  if (parsed.data.template_id !== null && !readContractTemplates().some((t) => t.id === parsed.data.template_id)) {
    return fail("Please select a valid template.", { template_id: "Template not found." });
  }

  const snapshot: ContractVersionSnapshot = {
    version: existing.version,
    title: existing.title,
    description: existing.description,
    total_value: existing.total_value,
    deposit_amount: existing.deposit_amount,
    recorded_at: nowIso(),
  };

  const updated: Contract = {
    ...existing,
    ...parsed.data,
    version: existing.version + 1,
    version_history: [...existing.version_history, snapshot],
    remaining_balance: computeRemainingBalance(parsed.data.total_value, parsed.data.deposit_amount),
    updated_at: nowIso(),
  };

  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_updated",
    `Contract updated: "${updated.title}"`,
  );

  return ok(updated);
}

async function updateContractStatus(id: string, status: ContractStatus): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (!canTransitionContractStatus(existing.status, status)) {
    return fail(
      `Cannot move a contract from "${CONTRACT_STATUS_LABELS[existing.status]}" to "${CONTRACT_STATUS_LABELS[status]}".`,
    );
  }

  const updated: Contract = { ...existing, status, updated_at: nowIso() };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_updated",
    `Status changed from ${CONTRACT_STATUS_LABELS[existing.status]} to ${CONTRACT_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

async function sendContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "draft" && existing.status !== "review" && existing.status !== "ready") {
    return fail(`Cannot send a contract that is already ${CONTRACT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "sent",
    signature_status: "sent",
    sent_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "contract", id, "contract_sent", `Contract sent: "${existing.title}"`);

  return ok(updated);
}

/** Idempotent: re-marking an already-viewed contract keeps its original viewed_at. */
async function markViewed(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("This contract hasn't been sent yet.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "viewed",
    signature_status: "viewed",
    viewed_at: existing.viewed_at ?? timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_viewed",
    `Contract viewed: "${existing.title}"`,
  );

  return ok(updated);
}

/** Allowed from "sent" directly (a client can sign without a tracked "viewed" step in this mock) or from "viewed". */
async function markSigned(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("This contract must be sent before it can be signed.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "signed",
    signature_status: "signed",
    signed_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_signed",
    `Contract signed: "${existing.title}"`,
  );

  return ok(updated);
}

async function markDeclined(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("Only a sent or viewed contract can be declined.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "declined",
    signature_status: "declined",
    declined_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_declined",
    `Contract declined: "${existing.title}"`,
  );

  return ok(updated);
}

/** "expired" has no dedicated timeline activity type of its own — recorded as "contract_updated" with a description that says so, same as updateContractStatus's generic moves. */
async function expireContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "sent" && existing.status !== "viewed") {
    return fail("Only a sent or viewed contract can expire.");
  }

  const updated: Contract = {
    ...existing,
    status: "expired",
    signature_status: "expired",
    updated_at: nowIso(),
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_updated",
    `Contract expired: "${existing.title}"`,
  );

  return ok(updated);
}

/** Allowed from any non-closed status (draft through signed) — a signed-but-unpaid contract can still be cancelled, unlike a completed one. */
async function cancelContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (isContractClosed(existing.status)) {
    return fail(
      `This contract is already ${CONTRACT_STATUS_LABELS[existing.status].toLowerCase()} and can't be cancelled.`,
    );
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "cancelled",
    signature_status: "cancelled",
    cancelled_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_cancelled",
    `Contract cancelled: "${existing.title}"`,
  );

  return ok(updated);
}

/** Only a signed contract can be marked completed — no Invoice/Payments module exists yet to gate on further. */
async function completeContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "signed") {
    return fail("Only a signed contract can be marked completed.");
  }

  const updated: Contract = { ...existing, status: "completed", updated_at: nowIso() };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    id,
    "contract_completed",
    `Contract completed: "${existing.title}"`,
  );

  return ok(updated);
}

async function archiveContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status === "archived") {
    return fail("This contract is already archived.");
  }

  const timestamp = nowIso();
  const updated: Contract = {
    ...existing,
    status: "archived",
    archived_at: timestamp,
    updated_at: timestamp,
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "contract", id, "contract_archived", "Contract archived");

  return ok(updated);
}

/** Restoring returns the Contract to "draft" — same precedent as restoreEvent; a genuinely different resumption status is a manual updateContractStatus/sendContract call away. */
async function restoreContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }
  if (existing.status !== "archived") {
    return fail("This contract is not archived.");
  }

  const updated: Contract = {
    ...existing,
    status: "draft",
    archived_at: null,
    updated_at: nowIso(),
  };
  writeContracts(readContracts().map((c) => (c.id === id ? updated : c)));
  recordTimelineActivity(existing.workspace_id, "contract", id, "contract_restored", "Contract restored");

  return ok(updated);
}

/** Fresh draft copy with a new id and guaranteed-unique contract_number, resetting status/signature_status/version/version_history and every lifecycle timestamp. */
async function duplicateContract(id: string): Promise<DataResult<Contract>> {
  const existing = readContracts().find((c) => c.id === id);
  if (!existing) {
    return fail("Contract not found.");
  }

  const timestamp = nowIso();
  const duplicate: Contract = {
    ...existing,
    id: generateId("contract"),
    contract_number: generateContractNumber(existing.workspace_id),
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    signed_at: null,
    sent_at: null,
    viewed_at: null,
    declined_at: null,
    cancelled_at: null,
    archived_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeContracts([...readContracts(), duplicate]);
  recordTimelineActivity(
    duplicate.workspace_id,
    "contract",
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
  await delay(150);
  const { category, activeOnly = false } = filters;
  return readContractTemplates().filter((template) => {
    if (activeOnly && !template.active) return false;
    if (category && category !== "all" && template.category !== category) return false;
    return true;
  });
}

async function getContractTemplateById(id: string): Promise<ContractTemplate> {
  await delay(100);
  const template = readContractTemplates().find((t) => t.id === id);
  if (!template) {
    throw new NotFoundError(`Contract template ${id} was not found`);
  }
  return template;
}

// ---------------------------------------------------------------------------
// Contract Exhibits — no document upload yet (document_id stays null until a
// Documents module exists). Read-only enforcement for locked/closed
// Contracts happens in the UI layer, same precedent as
// deleteScheduleItem/deleteChecklistItem.
// ---------------------------------------------------------------------------

async function getContractExhibitsByContractId(contractId: string): Promise<ContractExhibit[]> {
  await delay(100);
  return readContractExhibits()
    .filter((exhibit) => exhibit.contract_id === contractId)
    .sort((a, b) => a.display_order - b.display_order);
}

async function getContractExhibitById(id: string): Promise<ContractExhibit> {
  await delay(100);
  const exhibit = readContractExhibits().find((e) => e.id === id);
  if (!exhibit) {
    throw new NotFoundError(`Contract exhibit ${id} was not found`);
  }
  return exhibit;
}

async function createContractExhibit(
  contractId: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) {
    return fail("Contract not found.");
  }

  const parsed = contractExhibitSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const ownExhibits = readContractExhibits().filter((e) => e.contract_id === contractId);
  const timestamp = nowIso();
  const exhibit: ContractExhibit = {
    id: generateId("exhibit"),
    workspace_id: contract.workspace_id,
    contract_id: contractId,
    ...parsed.data,
    display_order: ownExhibits.length,
    document_id: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeContractExhibits([...readContractExhibits(), exhibit]);

  return ok(exhibit);
}

async function updateContractExhibit(
  id: string,
  input: ContractExhibitInput,
): Promise<DataResult<ContractExhibit>> {
  const existing = readContractExhibits().find((e) => e.id === id);
  if (!existing) {
    return fail("Exhibit not found.");
  }

  const parsed = contractExhibitSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: ContractExhibit = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeContractExhibits(readContractExhibits().map((e) => (e.id === id ? updated : e)));

  return ok(updated);
}

async function deleteContractExhibit(id: string): Promise<DataResult<null>> {
  const existing = readContractExhibits().find((e) => e.id === id);
  if (!existing) {
    return fail("Exhibit not found.");
  }

  writeContractExhibits(readContractExhibits().filter((e) => e.id !== id));

  return ok(null);
}

async function reorderContractExhibits(
  contractId: string,
  orderedIds: string[],
): Promise<DataResult<ContractExhibit[]>> {
  const ownExhibits = readContractExhibits().filter((e) => e.contract_id === contractId);
  if (orderedIds.length !== ownExhibits.length || !ownExhibits.every((e) => orderedIds.includes(e.id))) {
    return fail("The provided order doesn't match this contract's exhibits.");
  }

  const timestamp = nowIso();
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  writeContractExhibits(
    readContractExhibits().map((e) =>
      order.has(e.id) ? { ...e, display_order: order.get(e.id) as number, updated_at: timestamp } : e,
    ),
  );

  const updated = readContractExhibits()
    .filter((e) => e.contract_id === contractId)
    .sort((a, b) => a.display_order - b.display_order);

  return ok(updated);
}

// ---------------------------------------------------------------------------
// Contract Notes and Timeline — reuse the shared owner_type/owner_id Notes
// and Timeline architecture, same as Events.
// ---------------------------------------------------------------------------

async function getNotesByContractId(contractId: string): Promise<Note[]> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) return [];
  return getNotesByOwner(contract.workspace_id, "contract", contractId);
}

async function createContractNote(contractId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) {
    return fail("Contract not found.");
  }
  return createNoteForOwner(contract.workspace_id, "contract", contractId, input);
}

async function togglePinContractNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "contract");
  if (!existing) return null;

  const updated: Note = {
    ...existing,
    is_pinned: !existing.is_pinned,
    updated_at: nowIso(),
  };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "contract",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByContractId(contractId: string): Promise<TimelineActivity[]> {
  const contract = readContracts().find((c) => c.id === contractId);
  if (!contract) return [];
  return getTimelineByOwner(contract.workspace_id, "contract", contractId);
}

export const mockContractsRepository: ContractsRepository = {
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
