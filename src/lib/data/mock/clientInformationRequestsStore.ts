import type { ClientInformationRequest, CreateInformationRequestInput, InformationRequestStatus } from "@/types/clientJourney";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 32 — Internal Client Information Requests (Step 15).
 * The third genuinely persisted entity this checkpoint introduces — no
 * external forms/email/SMS provider is ever involved; the Client Portal
 * (Step 16) only ever reads and responds to requests already created here.
 */
let requests: ClientInformationRequest[] = [];

export function resetClientInformationRequestsStore(): void {
  requests = [];
}

async function listRequestsForClient(workspaceId: string, clientId: string): Promise<ClientInformationRequest[]> {
  return requests.filter((r) => r.workspaceId === workspaceId && r.clientId === clientId);
}

async function getRequestById(id: string): Promise<ClientInformationRequest | null> {
  return requests.find((r) => r.id === id) ?? null;
}

async function createRequest(input: CreateInformationRequestInput): Promise<DataResult<ClientInformationRequest>> {
  if (!input.title.trim()) return fail("A title is required for an information request.");
  const timestamp = nowIso();
  const created: ClientInformationRequest = {
    id: generateId("client_information_request"),
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    title: input.title,
    description: input.description,
    requiredFields: input.requiredFields ?? [],
    requiredDocuments: input.requiredDocuments ?? [],
    dueDate: input.dueDate ?? null,
    status: "pending",
    clientResponse: null,
    internalNotes: null,
    relatedJourneyStage: input.relatedJourneyStage ?? null,
    relatedEventId: input.relatedEventId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    fulfilledAt: null,
  };
  requests = [...requests, created];
  return ok(created);
}

async function setStatus(id: string, status: InformationRequestStatus): Promise<DataResult<ClientInformationRequest>> {
  const existing = requests.find((r) => r.id === id);
  if (!existing) return fail("This information request could not be found.");
  const timestamp = nowIso();
  const updated: ClientInformationRequest = {
    ...existing,
    status,
    updatedAt: timestamp,
    fulfilledAt: status === "fulfilled" ? timestamp : existing.fulfilledAt,
  };
  requests = requests.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function recordClientResponse(id: string, response: string): Promise<DataResult<ClientInformationRequest>> {
  const existing = requests.find((r) => r.id === id);
  if (!existing) return fail("This information request could not be found.");
  const timestamp = nowIso();
  const updated: ClientInformationRequest = { ...existing, clientResponse: response, status: "fulfilled", updatedAt: timestamp, fulfilledAt: timestamp };
  requests = requests.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

async function setInternalNotes(id: string, notes: string): Promise<DataResult<ClientInformationRequest>> {
  const existing = requests.find((r) => r.id === id);
  if (!existing) return fail("This information request could not be found.");
  const updated: ClientInformationRequest = { ...existing, internalNotes: notes, updatedAt: nowIso() };
  requests = requests.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

export interface ClientInformationRequestsRepository {
  listRequestsForClient: typeof listRequestsForClient;
  getRequestById: typeof getRequestById;
  createRequest: typeof createRequest;
  setStatus: typeof setStatus;
  recordClientResponse: typeof recordClientResponse;
  setInternalNotes: typeof setInternalNotes;
}

export const mockClientInformationRequestsRepository: ClientInformationRequestsRepository = {
  listRequestsForClient,
  getRequestById,
  createRequest,
  setStatus,
  recordClientResponse,
  setInternalNotes,
};
