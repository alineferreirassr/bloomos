"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { CONNECTION_STATE_LABELS } from "@/core/integrations/types";
import type { ConnectionState } from "@/core/integrations/types";
import { getIntegrationConnectionDetail, type IntegrationConnectionDetailData } from "@/modules/integrations/getIntegrationConnectionDetail";

type LoadState = { status: "loading" } | { status: "ready"; data: IntegrationConnectionDetailData } | { status: "error" };

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
 * v2 Checkpoint 43 — the `/integrations/[provider]` detail page. Every
 * figure comes from `getIntegrationConnectionDetail()`; there is no
 * separate connect/disconnect/reconnect action here — that mutation
 * surface stays on the Developer Console's Integrations tab
 * (`/developer`), matching this dashboard's own "dashboard = summary,
 * console = action" split.
 */
export function IntegrationConnectionDetailView({ providerId }: { providerId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = () => {
    setState({ status: "loading" });
    getIntegrationConnectionDetail(providerId).then((result) => {
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      setState({ status: "ready", data: result.data });
    });
  };

  useEffect(() => {
    let cancelled = false;
    getIntegrationConnectionDetail(providerId).then((result) => {
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
  }, [providerId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="This integration isn't available." onRetry={load} />;
  }

  const { data } = state;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.provider?.name ?? providerId}
        subtitle={data.provider?.description ?? "Provider details, connection health, mappings, and recent errors."}
        actions={
          <div className="flex items-center gap-3 text-sm">
            <Link href="/integrations" className="text-accent underline">
              Back to Integrations
            </Link>
            <Link href="/developer" className="text-accent underline">
              Manage in Developer Console
            </Link>
          </div>
        }
      />

      {data.provider && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <Badge tone="neutral">{data.provider.category}</Badge>
            {data.provider.capabilities.map((capability) => (
              <Badge key={capability} tone="neutral">
                {capability}
              </Badge>
            ))}
            <span>v{data.provider.version}</span>
          </div>
        </Card>
      )}

      {data.connections.length === 0 ? (
        <Card>
          <EmptyState title="Not connected" description="Install this provider from the Developer Console's Integrations tab to see connection details here." />
        </Card>
      ) : (
        data.connections.map((row) => (
          <Card key={row.connection.id}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-semibold text-text">Connection {row.connection.id}</h3>
              <Badge tone={STATE_TONE[row.connection.state]}>{CONNECTION_STATE_LABELS[row.connection.state]}</Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-text-muted">Failures</div>
                <div className="text-text">{row.connection.failure_count}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Retries</div>
                <div className="text-text">{row.connection.retry_count}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Sync runs</div>
                <div className="text-text">{row.syncRunCount}</div>
              </div>
              <div>
                <div className="text-xs text-text-muted">Last sync</div>
                <div className="text-text">{row.connection.last_sync_at ? new Date(row.connection.last_sync_at).toLocaleString() : "Never"}</div>
              </div>
            </div>

            {row.health?.rate_limited && (
              <div className="mt-3">
                <Badge tone="warning">Rate limited</Badge>
              </div>
            )}

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-text">Entity mappings ({row.mappings.length})</h4>
              {row.mappings.length === 0 ? (
                <p className="mt-1 text-sm text-text-muted">No entities have been mapped to this connection yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-text-muted">
                        <th className="pb-2 pr-3 font-normal">Internal entity</th>
                        <th className="pb-2 pr-3 font-normal">External id</th>
                        <th className="pb-2 font-normal">Last synced</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.mappings.map((mapping) => (
                        <tr key={mapping.id} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-3 text-text">
                            {mapping.internal_entity_type} · {mapping.internal_entity_id}
                          </td>
                          <td className="py-2 pr-3 text-text-muted">{mapping.external_id}</td>
                          <td className="py-2 text-text-muted">{mapping.last_synced_at ? new Date(mapping.last_synced_at).toLocaleString() : "Never"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-text">Recent errors ({row.recentErrors.length})</h4>
              {row.recentErrors.length === 0 ? (
                <p className="mt-1 text-sm text-text-muted">No errors recorded for this connection.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {row.recentErrors.map((error) => (
                    <li key={error.id} className="flex items-center justify-between border-b border-border/60 pb-2 text-sm last:border-0">
                      <span className="text-text">
                        <Badge tone={error.retryable ? "warning" : "danger"}>{error.category}</Badge> {error.message}
                      </span>
                      <span className="text-xs text-text-muted">{new Date(error.occurred_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-text">Recent state history</h4>
              {row.history.length === 0 ? (
                <p className="mt-1 text-sm text-text-muted">No state changes recorded yet.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {row.history.map((transition) => (
                    <li key={transition.id} className="flex items-center justify-between text-text-muted">
                      <span>
                        {transition.from_state} → {transition.to_state} ({transition.event})
                      </span>
                      <span className="text-xs">{new Date(transition.occurred_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
