import type { InvoiceBuilderState, InvoiceVersion, InvoiceDocumentStatus } from "@/types/invoicePlatform";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 35 — the mutable shell around append-only `InvoiceVersion`
 * history (see `types/invoicePlatform.ts`'s top-level doc comment for why
 * this is a new, additive companion to the real `Invoice` rather than a
 * mutation of it). One `InvoiceBuilderState` row per `invoice_id` —
 * `getOrCreateForInvoice` is the only way a caller ever gets one.
 */
let states: InvoiceBuilderState[] = [];

export function resetInvoiceBuilderStore(): void {
  states = [];
}

async function getByInvoiceId(invoiceId: string): Promise<InvoiceBuilderState | null> {
  return states.find((s) => s.invoice_id === invoiceId) ?? null;
}

async function getById(id: string): Promise<InvoiceBuilderState | null> {
  return states.find((s) => s.id === id) ?? null;
}

async function getOrCreateForInvoice(workspaceId: string, invoiceId: string, actor: string): Promise<InvoiceBuilderState> {
  const existing = states.find((s) => s.invoice_id === invoiceId);
  if (existing) return existing;
  const now = nowIso();
  const created: InvoiceBuilderState = {
    id: generateId("invoice_builder"),
    invoice_id: invoiceId,
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

async function listForWorkspace(workspaceId: string): Promise<InvoiceBuilderState[]> {
  return states.filter((s) => s.workspace_id === workspaceId);
}

/** Append-only — never mutates or removes an existing `InvoiceVersion`, only ever adds one and repoints `current_version_id`. */
async function appendVersion(invoiceId: string, version: InvoiceVersion, nextStatus: InvoiceDocumentStatus): Promise<InvoiceBuilderState | null> {
  const existing = states.find((s) => s.invoice_id === invoiceId);
  if (!existing) return null;
  const updated: InvoiceBuilderState = {
    ...existing,
    versions: [...existing.versions, version],
    current_version_id: version.id,
    status: nextStatus,
    updated_at: nowIso(),
  };
  states = states.map((s) => (s.invoice_id === invoiceId ? updated : s));
  return updated;
}

async function setStatus(invoiceId: string, status: InvoiceDocumentStatus): Promise<InvoiceBuilderState | null> {
  const existing = states.find((s) => s.invoice_id === invoiceId);
  if (!existing) return null;
  const updated: InvoiceBuilderState = { ...existing, status, archived_at: status === "archived" ? nowIso() : existing.archived_at, updated_at: nowIso() };
  states = states.map((s) => (s.invoice_id === invoiceId ? updated : s));
  return updated;
}

/** Points `current_version_id` back at an earlier version — the version list itself is never trimmed or reordered. */
async function restoreVersion(invoiceId: string, versionId: string): Promise<InvoiceBuilderState | null> {
  const existing = states.find((s) => s.invoice_id === invoiceId);
  if (!existing) return null;
  const target = existing.versions.find((v) => v.id === versionId);
  if (!target) return null;
  const updated: InvoiceBuilderState = { ...existing, current_version_id: target.id, status: "review", updated_at: nowIso() };
  states = states.map((s) => (s.invoice_id === invoiceId ? updated : s));
  return updated;
}

/** Only ever sets `ready_at` the first time — never cleared, never overwritten by a later call. */
async function markReady(invoiceId: string): Promise<InvoiceBuilderState | null> {
  const existing = states.find((s) => s.invoice_id === invoiceId);
  if (!existing) return null;
  if (existing.ready_at) return existing;
  const updated: InvoiceBuilderState = { ...existing, ready_at: nowIso(), updated_at: nowIso() };
  states = states.map((s) => (s.invoice_id === invoiceId ? updated : s));
  return updated;
}

export interface InvoiceBuilderRepository {
  getByInvoiceId: typeof getByInvoiceId;
  getById: typeof getById;
  getOrCreateForInvoice: typeof getOrCreateForInvoice;
  listForWorkspace: typeof listForWorkspace;
  appendVersion: typeof appendVersion;
  setStatus: typeof setStatus;
  restoreVersion: typeof restoreVersion;
  markReady: typeof markReady;
}

export const mockInvoiceBuilderRepository: InvoiceBuilderRepository = {
  getByInvoiceId,
  getById,
  getOrCreateForInvoice,
  listForWorkspace,
  appendVersion,
  setStatus,
  restoreVersion,
  markReady,
};
