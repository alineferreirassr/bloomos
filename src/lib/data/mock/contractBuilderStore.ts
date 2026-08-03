import type { ContractBuilderState, ContractVersion, ContractDocumentStatus } from "@/types/contractPlatform";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 34 — the mutable shell around append-only `ContractVersion`
 * history (see `types/contractPlatform.ts`'s top-level doc comment for why
 * this is a new, additive companion to the real `Contract` rather than a
 * mutation of it). One `ContractBuilderState` row per `contract_id` —
 * `getOrCreateForContract` is the only way a caller ever gets one.
 */
let states: ContractBuilderState[] = [];

export function resetContractBuilderStore(): void {
  states = [];
}

async function getByContractId(contractId: string): Promise<ContractBuilderState | null> {
  return states.find((s) => s.contract_id === contractId) ?? null;
}

async function getById(id: string): Promise<ContractBuilderState | null> {
  return states.find((s) => s.id === id) ?? null;
}

async function getOrCreateForContract(workspaceId: string, contractId: string, actor: string): Promise<ContractBuilderState> {
  const existing = states.find((s) => s.contract_id === contractId);
  if (existing) return existing;
  const now = nowIso();
  const created: ContractBuilderState = {
    id: generateId("contract_builder"),
    contract_id: contractId,
    workspace_id: workspaceId,
    status: "draft",
    current_version_id: null,
    versions: [],
    ready_at: null,
    archived_at: null,
    created_by: actor,
    created_at: now,
    updated_at: now,
  };
  states = [...states, created];
  return created;
}

async function listForWorkspace(workspaceId: string): Promise<ContractBuilderState[]> {
  return states.filter((s) => s.workspace_id === workspaceId);
}

/** Append-only — never mutates or removes an existing `ContractVersion`, only ever adds one and repoints `current_version_id`. */
async function appendVersion(contractId: string, version: ContractVersion, nextStatus: ContractDocumentStatus): Promise<ContractBuilderState | null> {
  const existing = states.find((s) => s.contract_id === contractId);
  if (!existing) return null;
  const updated: ContractBuilderState = {
    ...existing,
    versions: [...existing.versions, version],
    current_version_id: version.id,
    status: nextStatus,
    updated_at: nowIso(),
  };
  states = states.map((s) => (s.contract_id === contractId ? updated : s));
  return updated;
}

async function setStatus(contractId: string, status: ContractDocumentStatus): Promise<ContractBuilderState | null> {
  const existing = states.find((s) => s.contract_id === contractId);
  if (!existing) return null;
  const updated: ContractBuilderState = { ...existing, status, archived_at: status === "archived" ? nowIso() : existing.archived_at, updated_at: nowIso() };
  states = states.map((s) => (s.contract_id === contractId ? updated : s));
  return updated;
}

/** Points `current_version_id` back at an earlier version — the version list itself is never trimmed or reordered. */
async function restoreVersion(contractId: string, versionId: string): Promise<ContractBuilderState | null> {
  const existing = states.find((s) => s.contract_id === contractId);
  if (!existing) return null;
  const target = existing.versions.find((v) => v.id === versionId);
  if (!target) return null;
  const updated: ContractBuilderState = { ...existing, current_version_id: target.id, status: "review", updated_at: nowIso() };
  states = states.map((s) => (s.contract_id === contractId ? updated : s));
  return updated;
}

/** Only ever sets `ready_at` the first time — never cleared, never overwritten by a later call. */
async function markReady(contractId: string): Promise<ContractBuilderState | null> {
  const existing = states.find((s) => s.contract_id === contractId);
  if (!existing) return null;
  if (existing.ready_at) return existing;
  const updated: ContractBuilderState = { ...existing, ready_at: nowIso(), updated_at: nowIso() };
  states = states.map((s) => (s.contract_id === contractId ? updated : s));
  return updated;
}

export interface ContractBuilderRepository {
  getByContractId: typeof getByContractId;
  getById: typeof getById;
  getOrCreateForContract: typeof getOrCreateForContract;
  listForWorkspace: typeof listForWorkspace;
  appendVersion: typeof appendVersion;
  setStatus: typeof setStatus;
  restoreVersion: typeof restoreVersion;
  markReady: typeof markReady;
}

export const mockContractBuilderRepository: ContractBuilderRepository = {
  getByContractId,
  getById,
  getOrCreateForContract,
  listForWorkspace,
  appendVersion,
  setStatus,
  restoreVersion,
  markReady,
};
