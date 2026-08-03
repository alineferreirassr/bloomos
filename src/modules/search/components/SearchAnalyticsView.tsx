"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { AnalyticsIcon } from "@/components/ui/icons";
import { getSearchAnalyticsAction, getSearchHealthAction } from "@/modules/search/searchActions";
import type { SearchAnalyticsSummary } from "@/types/searchAnalytics";
import type { SearchHealthReport } from "@/types/searchHealth";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; analytics: SearchAnalyticsSummary; health: SearchHealthReport };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * v2.0 Checkpoint 40 — `/search/analytics`, gated on `workspace.manage` the
 * same way `getSearchAnalyticsAction()`/`getSearchHealthAction()` already
 * gate themselves. Every number here is the raw output of
 * `searchAnalyticsEngine.ts` / `searchHealthEngine.ts` — this view formats,
 * it never recomputes.
 */
export function SearchAnalyticsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    Promise.all([getSearchAnalyticsAction(), getSearchHealthAction()]).then(([analyticsResult, healthResult]) => {
      if (!analyticsResult.success) {
        setState({ status: "error", message: analyticsResult.error });
        return;
      }
      if (!healthResult.success) {
        setState({ status: "error", message: healthResult.error });
        return;
      }
      setState({ status: "ready", analytics: analyticsResult.data, health: healthResult.data });
    });
  }, []);

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Search Analytics" subtitle="How this Workspace searches — coverage, usage, and success, computed from real history." />
        <TableSkeleton rows={5} columns={2} />
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState message={state.message} />;
  }

  const { analytics, health } = state;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Search Analytics"
        subtitle="How this Workspace searches — coverage, usage, and success, computed from real history."
        breadcrumb={[{ label: "Search", href: "/search" }, { label: "Analytics" }]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total searches" value={String(analytics.totalSearches)} icon={AnalyticsIcon} />
        <KpiCard label="Average results per search" value={analytics.averageResultCount.toFixed(1)} icon={AnalyticsIcon} />
        <KpiCard label="Success rate" value={`${Math.round(analytics.successRate * 100)}%`} icon={AnalyticsIcon} />
        <KpiCard label="No-result rate" value={`${Math.round(analytics.noResultRate * 100)}%`} icon={AnalyticsIcon} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Most searched terms</h3>
          {analytics.mostSearchedTerms.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No searches recorded yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {analytics.mostSearchedTerms.map((entry) => (
                <li key={entry.term} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-text">{entry.term}</span>
                  <span className="shrink-0 text-text-muted">{entry.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Most searched entity types</h3>
          {analytics.mostSearchedEntityTypes.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No searches recorded yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {analytics.mostSearchedEntityTypes.map((entry) => (
                <li key={entry.entityType} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-text">{entry.entityType.replace(/_/g, " ")}</span>
                  <span className="shrink-0 text-text-muted">{entry.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Most used commands</h3>
          {analytics.mostSearchedCommands.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No commands invoked yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {analytics.mostSearchedCommands.map((entry) => (
                <li key={entry.commandId} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-text">{entry.commandId}</span>
                  <span className="shrink-0 text-text-muted">{entry.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-serif text-base font-semibold text-text">No-result searches</h3>
          {analytics.noResultSearches.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">Every recent search returned something.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border text-sm">
              {analytics.noResultSearches.map((entry, index) => (
                <li key={`${entry.term}-${index}`} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-text">{entry.term}</span>
                  <span className="shrink-0 text-text-muted">{formatDateTime(entry.searched_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Most opened result</h3>
          {analytics.mostOpenedResult ? (
            <p className="mt-2 text-sm text-text">
              {analytics.mostOpenedResult.label} <span className="text-text-muted">({analytics.mostOpenedResult.visit_count} visits)</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-text-muted">No results opened yet.</p>
          )}
        </Card>
        <Card>
          <h3 className="font-serif text-base font-semibold text-text">Most pinned result</h3>
          {analytics.mostPinnedResult ? <p className="mt-2 text-sm text-text">{analytics.mostPinnedResult.label}</p> : <p className="mt-2 text-sm text-text-muted">Nothing pinned yet.</p>}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-base font-semibold text-text">Search Health</h3>
          <Badge tone={health.overallScore >= 80 ? "success" : health.overallScore >= 50 ? "warning" : "danger"}>{health.overallScore}/100</Badge>
        </div>
        <ul className="mt-2 divide-y divide-border text-sm">
          {health.categories.map((category) => (
            <li key={category.category} className="flex items-center justify-between gap-2 py-1.5">
              <span className="capitalize text-text">{category.category}</span>
              {category.score !== null ? (
                <Badge tone={category.score >= 80 ? "success" : category.score >= 50 ? "warning" : "danger"}>{category.score}/100</Badge>
              ) : (
                <span className="text-xs text-text-muted">{category.notApplicableReason}</span>
              )}
            </li>
          ))}
        </ul>
        {health.recommendations.length > 0 ? (
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-text-muted">
            {health.recommendations.map((recommendation, index) => (
              <li key={index}>{recommendation}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
