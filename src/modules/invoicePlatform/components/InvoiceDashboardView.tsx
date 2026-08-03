"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listInvoiceSummariesAction, getInvoiceAnalyticsAction } from "@/modules/invoicePlatform/invoicePlatformActions";
import type { InvoiceSummary, InvoiceAnalyticsSnapshot, InvoiceDocumentStatus } from "@/types/invoicePlatform";
import { INVOICE_TEMPLATE_LABELS, INVOICE_READINESS_LABELS } from "@/types/invoicePlatform";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FinanceIcon, AnalyticsIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 35, Step 19 — Invoice Dashboard. Read-only aggregate
 * over `listInvoiceSummariesAction()`/`getInvoiceAnalyticsAction()`'s own
 * already-computed results — coordinates the existing Invoice entity and
 * this checkpoint's builder layer, never a second source of truth for
 * either. "Top Templates" is grouped client-side from the summaries list
 * (this checkpoint's own analytics snapshot has no `templateUsage` field —
 * unlike Contract/Proposal, since the spec's own 7 named Analytics metrics
 * don't include it). "Recent Activity" reuses each summary's own
 * `updatedAt`, sorted, rather than building a second cross-entity Timeline
 * aggregator.
 */

const STATUS_TONE: Record<InvoiceDocumentStatus, BadgeTone> = { draft: "neutral", review: "warning", published: "success", archived: "outline" };

function formatMoney(minor: number | null, currency: string | null): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(minor / 100);
}

export function InvoiceDashboardView() {
  const [summaries, setSummaries] = useState<InvoiceSummary[] | null>(null);
  const [analytics, setAnalytics] = useState<InvoiceAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceDocumentStatus>("all");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listInvoiceSummariesAction(), getInvoiceAnalyticsAction()]).then(([summariesResult, analyticsResult]) => {
      if (cancelled) return;
      if (summariesResult.success) setSummaries(summariesResult.data);
      else setError(summariesResult.error);
      if (analyticsResult.success) setAnalytics(analyticsResult.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!summaries) return [];
    if (statusFilter === "all") return summaries;
    return summaries.filter((s) => s.documentStatus === statusFilter);
  }, [summaries, statusFilter]);

  const recentActivity = useMemo(() => [...(summaries ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8), [summaries]);

  const topTemplates = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const s of summaries ?? []) {
      if (!s.templateKey) continue;
      usage[s.templateKey] = (usage[s.templateKey] ?? 0) + 1;
    }
    return Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [summaries]);

  const readinessCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of summaries ?? []) counts[s.readinessState] = (counts[s.readinessState] ?? 0) + 1;
    return counts;
  }, [summaries]);

  if (error) return <EmptyState title="The Invoice Platform isn't available" description={error} icon={FinanceIcon} />;

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="The single Invoice & Billing Platform — reuses the existing Invoice entity, never a second billing system."
        icon={FinanceIcon}
        breadcrumb={[{ label: "Invoices" }]}
      />

      {summaries && analytics ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="Drafts" value={String(analytics.draftCount)} icon={FinanceIcon} />
            <KpiCard label="In Review" value={String(analytics.reviewCount)} icon={FinanceIcon} />
            <KpiCard label="Published" value={String(analytics.publishedCount)} icon={CheckIcon} />
            <KpiCard label="Archived" value={String(analytics.archivedCount)} icon={FinanceIcon} />
            <KpiCard label="Outstanding Balance" value={formatMoney(analytics.outstandingBalance_minor, "USD")} icon={AnalyticsIcon} />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Average Invoice / Deposit / Balance</h2>
              <p className="text-2xl font-semibold">{formatMoney(analytics.averageInvoice_minor, "USD")}</p>
              <p className="text-xs text-text-muted">
                Deposit {formatMoney(analytics.averageDeposit_minor, "USD")} · Balance {formatMoney(analytics.averageBalance_minor, "USD")}
              </p>
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Average Discount / Credit</h2>
              <p className="text-2xl font-semibold">{formatMoney(analytics.averageDiscount_minor, "USD")}</p>
              <p className="text-xs text-text-muted">Credit {formatMoney(analytics.averageCredit_minor, "USD")} average per invoice</p>
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Average Installments</h2>
              <p className="text-2xl font-semibold">{analytics.averageInstallments}</p>
              <p className="text-xs text-text-muted">{analytics.totalInvoices} total invoice{analytics.totalInvoices === 1 ? "" : "s"}</p>
            </Card>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Top Templates</h2>
              {topTemplates.length === 0 ? (
                <p className="text-sm text-text-muted">No template usage yet.</p>
              ) : (
                <ul role="list">
                  {topTemplates.map(([key, count]) => (
                    <li key={key} role="listitem" className="flex items-center justify-between py-1 text-sm">
                      <span>{INVOICE_TEMPLATE_LABELS[key as keyof typeof INVOICE_TEMPLATE_LABELS] ?? key}</span>
                      <span className="text-text-muted">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Readiness</h2>
              {Object.keys(readinessCounts).length === 0 ? (
                <p className="text-sm text-text-muted">No invoices yet.</p>
              ) : (
                <ul role="list">
                  {Object.entries(readinessCounts).map(([state, count]) => (
                    <li key={state} role="listitem" className="flex items-center justify-between py-1 text-sm">
                      <span>{INVOICE_READINESS_LABELS[state as keyof typeof INVOICE_READINESS_LABELS] ?? state}</span>
                      <span className="text-text-muted">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-text-muted" htmlFor="invoice-status-filter">
              Status
            </label>
            <select id="invoice-status-filter" className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | InvoiceDocumentStatus)}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <Card className="mb-6">
            {filtered.length === 0 ? (
              <EmptyState title="No invoices match this filter" description="Try a different status." icon={FinanceIcon} />
            ) : (
              <ul role="list">
                {filtered.map((s) => (
                  <li key={s.invoiceId} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/invoices/${s.invoiceId}`} className="truncate text-sm font-medium hover:underline">
                        {s.templateKey ? INVOICE_TEMPLATE_LABELS[s.templateKey] : "Untitled Invoice"}
                      </Link>
                      <p className="text-xs text-text-muted">
                        Health {s.overallHealthScore} · {INVOICE_READINESS_LABELS[s.readinessState]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{formatMoney(s.grandTotal_minor, s.currency)}</Badge>
                      <Badge tone={STATUS_TONE[s.documentStatus]}>{s.documentStatus}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-text-muted">No recent invoice activity.</p>
            ) : (
              <ul role="list">
                {recentActivity.map((s) => (
                  <li key={s.invoiceId} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                    <Link href={`/invoices/${s.invoiceId}`} className="truncate text-sm hover:underline">
                      {s.templateKey ? INVOICE_TEMPLATE_LABELS[s.templateKey] : "Untitled Invoice"}
                    </Link>
                    <span className="text-xs text-text-muted">{new Date(s.updatedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <p className="text-sm text-text-muted">Loading invoices…</p>
      )}
    </div>
  );
}
