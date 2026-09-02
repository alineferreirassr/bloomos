"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  evaluateInvoiceAction,
  listInvoiceTemplatesAction,
  createInvoiceVersionAction,
  publishInvoiceVersionAction,
  archiveInvoiceDocumentAction,
  restoreInvoiceVersionAction,
  compareInvoiceVersionsAction,
  markInvoiceReadyAction,
} from "@/modules/invoicePlatform/invoicePlatformActions";
import type { InvoiceDetail, InvoiceTemplate, InvoiceComparisonResult, InvoiceLineItem, InvoiceLineItemKind } from "@/types/invoicePlatform";
import { INVOICE_LINE_ITEM_KINDS, INVOICE_LINE_ITEM_KIND_LABELS, INVOICE_READINESS_LABELS } from "@/types/invoicePlatform";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinanceIcon } from "@/components/ui/icons";
import { CommentsPanel } from "@/modules/communication/comments/components/CommentsPanel";

/**
 * v2.0 Checkpoint 35, Step 20 — Invoice Detail. Every figure comes
 * straight from `evaluateInvoiceAction` — nothing here recalculates
 * anything (the real `computeInvoicePricing` runs server-side inside
 * `createInvoiceVersionAction`). "New Version" is a real, working builder
 * over the Template Library and the Line Item/Billing Engine — a
 * purposefully compact form (single-section, freeform line items) rather
 * than a full drag-and-drop canvas, the same scope discipline
 * `ProposalDetailView` (Checkpoint 33) established. Every field it submits
 * flows through the same `CreateInvoiceVersionInput` the engines were
 * built and tested against.
 */

const READINESS_TONE: Record<string, BadgeTone> = { ready: "success", needs_review: "warning", missing_client: "danger", missing_proposal: "warning", missing_contract: "warning", missing_pricing: "danger", missing_schedule: "warning", missing_terms: "warning" };

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

let draftIdCounter = 0;
function nextDraftId(prefix: string): string {
  draftIdCounter += 1;
  return `${prefix}_draft_${draftIdCounter}`;
}

interface DraftLineItem {
  id: string;
  kind: InvoiceLineItemKind;
  label: string;
  amount_minor: number;
}

export function InvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [acting, setActing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [draftLineItems, setDraftLineItems] = useState<DraftLineItem[]>([{ id: nextDraftId("li"), kind: "service", label: "", amount_minor: 0 }]);
  const [terms, setTerms] = useState("Standard terms apply.");
  const [policies, setPolicies] = useState("Standard cancellation policy applies.");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [comparison, setComparison] = useState<InvoiceComparisonResult | null>(null);

  async function load() {
    const [detailResult, templatesResult] = await Promise.all([evaluateInvoiceAction(invoiceId), listInvoiceTemplatesAction()]);
    if (detailResult.success) {
      setDetail(detailResult.data);
      setError(null);
    } else {
      setError(detailResult.error);
    }
    if (templatesResult.success) setTemplates(templatesResult.data);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([evaluateInvoiceAction(invoiceId), listInvoiceTemplatesAction()]).then(([detailResult, templatesResult]) => {
      if (cancelled) return;
      if (detailResult.success) {
        setDetail(detailResult.data);
        setError(null);
      } else {
        setError(detailResult.error);
      }
      if (templatesResult.success) setTemplates(templatesResult.data);
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId) ?? null, [templates, selectedTemplateId]);
  const draftTotal_minor = useMemo(() => draftLineItems.reduce((sum, li) => sum + (li.kind === "discount" || li.kind === "tax_placeholder" ? -Math.abs(li.amount_minor) : li.amount_minor), 0), [draftLineItems]);

  function addDraftLineItem(): void {
    setDraftLineItems((prev) => [...prev, { id: nextDraftId("li"), kind: "service", label: "", amount_minor: 0 }]);
  }

  function updateDraftLineItem(id: string, patch: Partial<DraftLineItem>): void {
    setDraftLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  }

  function removeDraftLineItem(id: string): void {
    setDraftLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  async function handleCreateVersion() {
    if (!selectedTemplate) return;
    setActing(true);

    const sectionId = nextDraftId("sec");
    const lineItems: InvoiceLineItem[] = draftLineItems
      .filter((li) => li.label.trim().length > 0)
      .map((li) => ({
        id: li.id,
        sectionId,
        kind: li.kind,
        label: li.label,
        description: null,
        quantity: 1,
        unitPrice_minor: li.amount_minor,
        amount_minor: li.kind === "discount" || li.kind === "tax_placeholder" ? -Math.abs(li.amount_minor) : li.amount_minor,
      }));

    await createInvoiceVersionAction(invoiceId, {
      templateId: selectedTemplate.id,
      templateKey: selectedTemplate.key,
      header: selectedTemplate.structure.header,
      sections: [{ id: sectionId, title: selectedTemplate.structure.defaultSectionTitles[0] ?? "Services", isCustom: false }],
      lineItems,
      adjustments: [],
      paymentSchedule: [{ id: nextDraftId("inst"), kind: "final_payment", label: "Payment in Full", dueDate: null, amount_minor: Math.max(0, draftTotal_minor) }],
      terms,
      policies,
      notes: "",
      footer: selectedTemplate.structure.footer,
      reason: null,
    });

    setBuilderOpen(false);
    await load();
    setActing(false);
  }

  async function handlePublish() {
    setActing(true);
    await publishInvoiceVersionAction(invoiceId);
    await load();
    setActing(false);
  }

  async function handleArchive() {
    setActing(true);
    await archiveInvoiceDocumentAction(invoiceId);
    await load();
    setActing(false);
  }

  async function handleRestore(versionId: string) {
    setActing(true);
    await restoreInvoiceVersionAction(invoiceId, versionId);
    await load();
    setActing(false);
  }

  async function handleMarkReady() {
    setActing(true);
    await markInvoiceReadyAction(invoiceId);
    await load();
    setActing(false);
  }

  async function handleCompare() {
    if (compareA === null || compareB === null) return;
    const result = await compareInvoiceVersionsAction(invoiceId, compareA, compareB);
    if (result.success) setComparison(result.data);
  }

  if (error) return <EmptyState title="This invoice isn't available" description={error} icon={FinanceIcon} />;
  if (!detail) return <p className="text-sm text-text-muted">Loading invoice…</p>;

  const snapshot = detail.currentVersion?.snapshot ?? null;

  return (
    <div>
      <div className="mb-6">
        <Link href="/invoices" className="text-sm text-accent hover:underline">
          ← Back to Invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">{snapshot?.header.title ?? detail.invoice.title}</h2>
          <Badge tone={READINESS_TONE[detail.readiness.state] ?? "neutral"}>{INVOICE_READINESS_LABELS[detail.readiness.state]}</Badge>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Invoice {detail.invoice.invoice_number} — currently {detail.builderState?.status ?? "not yet built"}
          {" · "}
          <Link href={`/clients/${detail.invoice.client_id}`} className="text-accent hover:underline">
            View client
          </Link>
          {detail.invoice.contract_id && (
            <>
              {" · "}
              <Link href={`/contracts/${detail.invoice.contract_id}`} className="text-accent hover:underline">
                View contract
              </Link>
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setBuilderOpen((v) => !v)} disabled={acting}>
            New Version
          </Button>
          {detail.builderState && detail.builderState.status !== "published" && (
            <Button variant="secondary" onClick={handlePublish} disabled={acting}>
              Publish
            </Button>
          )}
          {detail.builderState && detail.builderState.status !== "archived" && (
            <Button variant="secondary" onClick={handleArchive} disabled={acting}>
              Archive
            </Button>
          )}
          <Button onClick={handleMarkReady} disabled={acting || !detail.readiness.canPublish || detail.builderState?.ready_at != null}>
            Mark Ready
          </Button>
        </div>
      </div>

      {!detail.readiness.canPublish && detail.readiness.reasons.length > 0 && (
        <LuxuryCard className="mb-6 border-warning/40 bg-warning/5">
          <p className="text-sm text-warning">{detail.readiness.reasons[0]}</p>
        </LuxuryCard>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <LuxuryCard>
          <h2 className="mb-2 text-sm font-semibold">Overall Health</h2>
          <p className="text-2xl font-semibold">{detail.health.overallScore}</p>
        </LuxuryCard>
        <LuxuryCard>
          <h2 className="mb-2 text-sm font-semibold">Current Version</h2>
          <p className="text-2xl font-semibold">{detail.currentVersion?.version_number ?? "—"}</p>
        </LuxuryCard>
        <LuxuryCard>
          <h2 className="mb-2 text-sm font-semibold">Grand Total</h2>
          <p className="text-2xl font-semibold">{snapshot ? formatMoney(snapshot.pricing.grandTotal_minor, snapshot.pricing.currency) : "—"}</p>
        </LuxuryCard>
        <LuxuryCard>
          <h2 className="mb-2 text-sm font-semibold">Outstanding Balance</h2>
          <p className="text-2xl font-semibold">{snapshot ? formatMoney(snapshot.pricing.outstandingBalance_minor, snapshot.pricing.currency) : "—"}</p>
        </LuxuryCard>
      </div>

      {builderOpen && (
        <LuxuryCard className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Build a New Version</h2>
          <label className="text-sm">
            Template
            <select className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Line Items</p>
            <ul role="list" className="space-y-2">
              {draftLineItems.map((li) => (
                <li key={li.id} role="listitem" className="flex flex-wrap items-center gap-2">
                  <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={li.kind} onChange={(e) => updateDraftLineItem(li.id, { kind: e.target.value as InvoiceLineItemKind })}>
                    {INVOICE_LINE_ITEM_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {INVOICE_LINE_ITEM_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                  <input className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm" placeholder="Label" value={li.label} onChange={(e) => updateDraftLineItem(li.id, { label: e.target.value })} />
                  <input type="number" min={0} className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-sm" value={li.amount_minor / 100} onChange={(e) => updateDraftLineItem(li.id, { amount_minor: Math.round(Number(e.target.value) * 100) })} />
                  <Button variant="secondary" onClick={() => removeDraftLineItem(li.id)} disabled={draftLineItems.length === 1}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="mt-2" onClick={addDraftLineItem}>
              + Add Line Item
            </Button>
            <p className="mt-2 text-sm text-text-muted">Grand Total: {formatMoney(Math.max(0, draftTotal_minor), "USD")}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm">
              Terms
              <textarea className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </label>
            <label className="text-sm">
              Policies
              <textarea className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm" rows={3} value={policies} onChange={(e) => setPolicies(e.target.value)} />
            </label>
          </div>

          <Button className="mt-4" onClick={handleCreateVersion} disabled={acting || !selectedTemplate}>
            Create Version
          </Button>
        </LuxuryCard>
      )}

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Line Items</h2>
        {!snapshot || snapshot.lineItems.length === 0 ? (
          <p className="text-sm text-text-muted">No line items yet — build a version to add content.</p>
        ) : (
          <ul role="list">
            {snapshot.lineItems.map((li) => (
              <li key={li.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0 text-sm">
                <span>
                  {li.label} <span className="text-text-muted">({INVOICE_LINE_ITEM_KIND_LABELS[li.kind]})</span>
                </span>
                <span>{formatMoney(li.amount_minor, snapshot.pricing.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </LuxuryCard>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">Installments</h2>
          {!snapshot || snapshot.paymentSchedule.length === 0 ? (
            <p className="text-sm text-text-muted">No payment schedule yet.</p>
          ) : (
            <ul role="list">
              {snapshot.paymentSchedule.map((inst) => (
                <li key={inst.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0 text-sm">
                  <span>{inst.label}</span>
                  <span>{formatMoney(inst.amount_minor, snapshot.pricing.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>
        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">Credits &amp; Adjustments</h2>
          {!snapshot || snapshot.adjustments.length === 0 ? (
            <p className="text-sm text-text-muted">No credits or adjustments yet.</p>
          ) : (
            <ul role="list">
              {snapshot.adjustments.map((adj) => (
                <li key={adj.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0 text-sm">
                  <span>{adj.label}</span>
                  <span>{formatMoney(adj.amount_minor, snapshot.pricing.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>
      </div>

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Version History</h2>
        {!detail.builderState || detail.builderState.versions.length === 0 ? (
          <p className="text-sm text-text-muted">No versions yet.</p>
        ) : (
          <ul role="list">
            {detail.builderState.versions.map((v) => (
              <li key={v.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Version {v.version_number} {v.id === detail.builderState?.current_version_id && <Badge tone="accent">current</Badge>}
                  </p>
                  <p className="text-xs text-text-muted">{new Date(v.created_at).toLocaleString()}</p>
                </div>
                {v.id !== detail.builderState?.current_version_id && (
                  <Button variant="secondary" onClick={() => handleRestore(v.id)} disabled={acting}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {detail.builderState && detail.builderState.versions.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={compareA ?? ""} onChange={(e) => setCompareA(Number(e.target.value))}>
              <option value="">Version A</option>
              {detail.builderState.versions.map((v) => (
                <option key={v.id} value={v.version_number}>
                  Version {v.version_number}
                </option>
              ))}
            </select>
            <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={compareB ?? ""} onChange={(e) => setCompareB(Number(e.target.value))}>
              <option value="">Version B</option>
              {detail.builderState.versions.map((v) => (
                <option key={v.id} value={v.version_number}>
                  Version {v.version_number}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={handleCompare} disabled={compareA === null || compareB === null}>
              Compare
            </Button>
          </div>
        )}

        {comparison && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">{comparison.hasChanges ? `${comparison.diffs.length} difference(s) found` : "No differences found"}</p>
            {comparison.diffs.length > 0 && (
              <ul role="list" className="space-y-1">
                {comparison.diffs.map((d, i) => (
                  <li key={i} role="listitem" className="text-xs text-text-muted">
                    <span className="font-medium capitalize">{d.category}</span> · {d.field}: {d.before ?? "—"} → {d.after ?? "—"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </LuxuryCard>

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Health Breakdown</h2>
        <ul role="list" className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {detail.health.categories.map((c) => (
            <li key={c.category} role="listitem" className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
              <span className="capitalize">{c.category.replace(/_/g, " ")}</span>
              <span>{c.score === null ? "N/A" : c.score}</span>
            </li>
          ))}
        </ul>
      </LuxuryCard>

      <LuxuryCard>
        <h2 className="mb-3 text-sm font-semibold">Internal Notes &amp; Comments</h2>
        <CommentsPanel ownerType="invoice" ownerId={invoiceId} />
      </LuxuryCard>
    </div>
  );
}
