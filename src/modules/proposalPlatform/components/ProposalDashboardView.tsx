"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listProposalSummariesAction, getProposalAnalyticsAction } from "@/modules/proposalPlatform/proposalPlatformActions";
import type { ProposalSummary, ProposalAnalyticsSnapshot, ProposalDocumentStatus } from "@/types/proposalPlatform";
import { PROPOSAL_TEMPLATE_LABELS, PROPOSAL_READINESS_LABELS } from "@/types/proposalPlatform";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentTemplatesIcon, AnalyticsIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 33, Step 18 — Proposal Dashboard. Read-only aggregate
 * over `listProposalSummariesAction()`/`getProposalAnalyticsAction()`'s
 * own already-computed results — coordinates the existing Proposal
 * entity and this checkpoint's builder layer, never a second source of
 * truth for either. "Recent Activity" reuses each summary's own
 * `updatedAt`, sorted, rather than building a second cross-entity
 * Timeline aggregator.
 */

const STATUS_TONE: Record<ProposalDocumentStatus, BadgeTone> = { draft: "neutral", revision: "warning", published: "success", archived: "outline" };

function formatMoney(minor: number | null, currency: string | null): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(minor / 100);
}

function topEntries(usage: Record<string, number>, limit = 5): Array<[string, number]> {
  return Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function ProposalDashboardView() {
  const [summaries, setSummaries] = useState<ProposalSummary[] | null>(null);
  const [analytics, setAnalytics] = useState<ProposalAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ProposalDocumentStatus>("all");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listProposalSummariesAction(), getProposalAnalyticsAction()]).then(([summariesResult, analyticsResult]) => {
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

  if (error) return <EmptyState title="The Proposal Platform isn't available" description={error} icon={DocumentTemplatesIcon} />;

  return (
    <div>
      <PageHeader
        title="Proposals"
        subtitle="The single Proposal & Quote Platform — reuses the existing Proposal entity, never a second proposal system."
        icon={DocumentTemplatesIcon}
        breadcrumb={[{ label: "Proposals" }]}
      />

      {summaries && analytics ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Drafts" value={String(analytics.draftCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Published" value={String(analytics.publishedCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Sent" value={String(analytics.sentCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Viewed" value={String(analytics.viewedCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Accepted" value={String(analytics.acceptedCount)} icon={CheckIcon} />
            <KpiCard label="Declined" value={String(analytics.declinedCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Archived" value={String(analytics.archivedCount)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Acceptance Rate" value={`${analytics.acceptanceRate}%`} icon={AnalyticsIcon} />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Average Proposal Value</h2>
              <p className="text-2xl font-semibold">{formatMoney(analytics.averageProposalValue_minor, "USD")}</p>
              <p className="text-xs text-text-muted">Conversion rate {analytics.conversionRate}% of all proposals ever created</p>
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Average Discount / Deposit</h2>
              <p className="text-2xl font-semibold">{analytics.averageDiscountPercent}% / {analytics.averageDepositPercent}%</p>
              <p className="text-xs text-text-muted">Average {analytics.averageRevisionCount} revision(s) per proposal</p>
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Average Time to Accept</h2>
              <p className="text-2xl font-semibold">{analytics.averageTimeToAcceptHours !== null ? `${analytics.averageTimeToAcceptHours}h` : "—"}</p>
              <p className="text-xs text-text-muted">From generation to staff decision</p>
            </Card>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Top Templates</h2>
              {topEntries(analytics.templateUsage).length === 0 ? (
                <p className="text-sm text-text-muted">No template usage yet.</p>
              ) : (
                <ul role="list">
                  {topEntries(analytics.templateUsage).map(([key, count]) => (
                    <li key={key} role="listitem" className="flex items-center justify-between py-1 text-sm">
                      <span>{PROPOSAL_TEMPLATE_LABELS[key as keyof typeof PROPOSAL_TEMPLATE_LABELS] ?? key}</span>
                      <span className="text-text-muted">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Top Packages</h2>
              {topEntries(analytics.packageUsage).length === 0 ? (
                <p className="text-sm text-text-muted">No package usage yet.</p>
              ) : (
                <ul role="list">
                  {topEntries(analytics.packageUsage).map(([id, count]) => (
                    <li key={id} role="listitem" className="flex items-center justify-between py-1 text-sm">
                      <span className="truncate">{id}</span>
                      <span className="text-text-muted">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Top Add-ons</h2>
              {topEntries(analytics.addonUsage).length === 0 ? (
                <p className="text-sm text-text-muted">No add-on usage yet.</p>
              ) : (
                <ul role="list">
                  {topEntries(analytics.addonUsage).map(([id, count]) => (
                    <li key={id} role="listitem" className="flex items-center justify-between py-1 text-sm">
                      <span className="truncate">{id}</span>
                      <span className="text-text-muted">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-text-muted" htmlFor="proposal-status-filter">
              Status
            </label>
            <select id="proposal-status-filter" className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | ProposalDocumentStatus)}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="revision">Revision</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <Card className="mb-6">
            {filtered.length === 0 ? (
              <EmptyState title="No proposals match this filter" description="Try a different status." icon={DocumentTemplatesIcon} />
            ) : (
              <ul role="list">
                {filtered.map((s) => (
                  <li key={s.proposalId} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/proposals/${s.proposalId}`} className="truncate text-sm font-medium hover:underline">
                        {s.templateKey ? PROPOSAL_TEMPLATE_LABELS[s.templateKey] : "Untitled Proposal"}
                      </Link>
                      <p className="text-xs text-text-muted">
                        Health {s.overallHealthScore} · {PROPOSAL_READINESS_LABELS[s.readinessState]}
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
              <p className="text-sm text-text-muted">No recent proposal activity.</p>
            ) : (
              <ul role="list">
                {recentActivity.map((s) => (
                  <li key={s.proposalId} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                    <Link href={`/proposals/${s.proposalId}`} className="truncate text-sm hover:underline">
                      {s.templateKey ? PROPOSAL_TEMPLATE_LABELS[s.templateKey] : "Untitled Proposal"}
                    </Link>
                    <span className="text-xs text-text-muted">{new Date(s.updatedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <p className="text-sm text-text-muted">Loading proposals…</p>
      )}
    </div>
  );
}
