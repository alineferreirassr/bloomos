"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { CONNECTION_STATE_LABELS } from "@/core/integrations/types";
import type { ConnectionState } from "@/core/integrations/types";
import { getIntegrationsDashboardData, type IntegrationsDashboardData } from "@/modules/integrations/getIntegrationsDashboardData";

type LoadState = { status: "loading" } | { status: "ready"; data: IntegrationsDashboardData } | { status: "error" };

const STATE_TONE: Record<ConnectionState, BadgeTone> = {
  disconnected: "neutral",
  connecting: "warning",
  connected: "success",
  expired: "warning",
  refreshing: "warning",
  failed: "danger",
  disabled: "neutral",
  reconnecting: "warning",
  unknown: "neutral",
};

/**
 * The Integration Dashboard (v2 Checkpoint 22, Step 16) — a workspace-
 * wide read view of the Enterprise Integration Platform, mirroring
 * `OperationsDashboardView.tsx`'s (Checkpoint 21) own self-fetching
 * pattern. Every figure comes from `getIntegrationsDashboardData()`,
 * never fabricated. All mutation happens on the Developer Console's
 * Integrations tab (`/developer`) — this page is read-only, a deliberate
 * split matching "dashboard = summary, console = action" everywhere else
 * in this codebase.
 */
export function IntegrationsDashboardView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = () => {
    setState({ status: "loading" });
    getIntegrationsDashboardData().then((result) => {
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      setState({ status: "ready", data: result.data });
    });
  };

  useEffect(() => {
    let cancelled = false;
    getIntegrationsDashboardData().then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      setState({ status: "ready", data: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    registerCommand({ id: "open-integrations-dashboard", label: "Open Integrations Dashboard", group: "Integrations", keywords: ["integrations", "providers", "connections", "health"], run: () => router.push("/integrations") });
    return () => unregisterCommand("open-integrations-dashboard");
  }, [router]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="The Integrations Dashboard isn't available." onRetry={load} />;
  }

  const { data } = state;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        subtitle="A workspace-wide read of every provider connection, its health, and the platform's own queue, sync, and audit activity."
        actions={
          <Link href="/developer" className="text-sm text-accent underline">
            Manage in Developer Console
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Providers available" value={data.providerCount.toString()} href="/developer" />
        <MetricCard label="Connections" value={data.health.total.toString()} href="/developer" />
        <MetricCard label="Healthy" value={data.health.healthy.toString()} href="/developer" />
        <MetricCard label="Needs attention" value={data.health.needsAttention.toString()} href="/developer" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Queue backlog" value={data.queueBacklog.toString()} href="/developer" />
        <MetricCard label="Unresolved sync conflicts" value={data.unresolvedConflicts.toString()} href="/developer" />
        <MetricCard label="Webhook dead letters" value={data.deadLetterCount.toString()} href="/developer" />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[17px] font-semibold text-text">Integration Health</h3>
          <span className="text-sm text-text-muted">Score {data.integrationsHealth.overallScore}/100</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.integrationsHealth.categories.map((category) => (
            <div key={category.category} className="rounded-md border border-border/60 p-2">
              <div className="text-xs text-text-muted">{category.category.replace(/_/g, " ")}</div>
              <div className="text-text">{category.score === null ? "N/A" : `${category.score}/100`}</div>
            </div>
          ))}
        </div>
        {data.integrationsHealth.recommendations.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-muted">
            {data.integrationsHealth.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total syncs" value={data.integrationsAnalytics.totalSyncs.toString()} href="/developer" />
        <MetricCard label="Failed syncs" value={data.integrationsAnalytics.failedSyncs.toString()} href="/developer" />
        <MetricCard label="Webhook events received" value={data.integrationsAnalytics.webhookEventsReceived.toString()} href="/developer" />
        <MetricCard label="Webhook events failed" value={data.integrationsAnalytics.webhookEventsFailed.toString()} href="/developer" />
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Connections</h3>
        {data.connections.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No connections yet" description="Install a provider from the Developer Console's Integrations tab to see it here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Provider</th>
                  <th className="pb-2 pr-3 font-normal">Category</th>
                  <th className="pb-2 pr-3 font-normal">State</th>
                  <th className="pb-2 font-normal">Failures</th>
                </tr>
              </thead>
              <tbody>
                {data.connections.map(({ connection, provider }) => (
                  <tr key={connection.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">
                      <Link href={`/integrations/${connection.provider_id}`} className="text-accent underline">
                        {provider?.name ?? connection.provider_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{provider?.category ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={STATE_TONE[connection.state]}>{CONNECTION_STATE_LABELS[connection.state]}</Badge>
                    </td>
                    <td className="py-2 text-text-muted">{connection.failure_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Recent activity</h3>
        {data.recentAuditLog.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No activity yet" description="Install or reconfigure a connection to see activity here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.recentAuditLog.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between border-b border-border/60 pb-2 text-sm last:border-0">
                <span className="text-text">
                  <code className="text-xs">{entry.action}</code> on {entry.owner_type}
                </span>
                <span className="text-xs text-text-muted">{new Date(entry.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
