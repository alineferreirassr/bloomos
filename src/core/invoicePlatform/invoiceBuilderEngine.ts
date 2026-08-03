import type { InvoiceBuilderState, InvoiceDocumentStatus, InvoiceSnapshot, InvoiceVersion, CreateInvoiceVersionInput } from "@/types/invoicePlatform";
import { computeInvoicePricing } from "@/core/invoicePlatform/billingEngine";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 35 — Invoice Builder (Step 3) + Versioning (Step 8). Pure
 * assembly: freezes an `InvoiceSnapshot` by value — never a live reference
 * to the real Invoice's own `paid_minor`. The module layer resolves the
 * real Invoice (real I/O) and passes its `paid_minor` in already-fetched;
 * this file only assembles and versions.
 */

export interface AssembleInvoiceSnapshotInput {
  createInput: CreateInvoiceVersionInput;
  currency: string;
  /** The real `Invoice.paid_minor` at capture time — reused, never recomputed. */
  paidToDate_minor: number;
}

export function assembleSnapshot(input: AssembleInvoiceSnapshotInput): InvoiceSnapshot {
  const { createInput } = input;
  const pricing = computeInvoicePricing({
    currency: input.currency,
    lineItems: createInput.lineItems,
    adjustments: createInput.adjustments,
    paymentSchedule: createInput.paymentSchedule,
    paidToDate_minor: input.paidToDate_minor,
  });

  return {
    id: generateId("invoice_snapshot"),
    captured_at: nowIso(),
    templateId: createInput.templateId,
    templateKey: createInput.templateKey,
    header: createInput.header,
    sections: createInput.sections,
    lineItems: createInput.lineItems,
    adjustments: createInput.adjustments,
    paymentSchedule: createInput.paymentSchedule,
    pricing,
    terms: createInput.terms,
    policies: createInput.policies,
    notes: createInput.notes,
    footer: createInput.footer,
  };
}

export function nextVersionNumber(existingVersions: InvoiceVersion[]): number {
  if (existingVersions.length === 0) return 1;
  return Math.max(...existingVersions.map((v) => v.version_number)) + 1;
}

export function buildInvoiceVersion(invoiceId: string, workspaceId: string, existingVersions: InvoiceVersion[], input: AssembleInvoiceSnapshotInput, actor: string): InvoiceVersion {
  return {
    id: generateId("invoice_version"),
    invoice_id: invoiceId,
    workspace_id: workspaceId,
    version_number: nextVersionNumber(existingVersions),
    snapshot: assembleSnapshot(input),
    reason: input.createInput.reason,
    created_by: actor,
    created_at: nowIso(),
  };
}

/**
 * A first version always leaves the document in `"draft"`; every later
 * version created while the document is already `"published"` moves it to
 * `"review"` (a real edit is happening on top of what may already be under
 * review) rather than silently staying `"published"` — the same
 * "never silently overwrite what was already sent" precedent
 * `nextStatusAfterVersion` established for Proposal (Checkpoint 33) and
 * Contract (Checkpoint 34).
 */
export function nextStatusAfterVersion(currentStatus: InvoiceDocumentStatus, isFirstVersion: boolean): InvoiceDocumentStatus {
  if (isFirstVersion) return "draft";
  if (currentStatus === "published") return "review";
  return currentStatus;
}

export function currentVersionOf(state: InvoiceBuilderState): InvoiceVersion | null {
  if (!state.current_version_id) return null;
  return state.versions.find((v) => v.id === state.current_version_id) ?? null;
}
