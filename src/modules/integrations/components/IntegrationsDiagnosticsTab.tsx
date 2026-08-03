"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BadgeTone } from "@/components/ui/Badge";
import { summarizeHealth } from "@/core/integrations/healthMonitor";
import { CONNECTION_STATE_LABELS } from "@/core/integrations/types";
import type { ConnectionState, QueueJobStatus, SyncRunStatus } from "@/core/integrations/types";
import type { AuditLogEntry } from "@/core/audit";
import type { IntegrationsConsoleData } from "@/modules/integrations/getIntegrationsConsoleData";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

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

const QUEUE_STATUS_TONE: Record<QueueJobStatus, BadgeTone> = {
  queued: "neutral",
  running: "warning",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
  delayed: "warning",
};

const SYNC_STATUS_TONE: Record<SyncRunStatus, BadgeTone> = {
  running: "warning",
  succeeded: "success",
  failed: "danger",
  conflict: "warning",
};

interface IntegrationsDiagnosticsTabProps {
  data: IntegrationsConsoleData;
}

/**
 * The Developer Center diagnostics (v2 Checkpoint 22, Step 15) — a
 * read-only cross-engine view: Health Monitor snapshots, the Queue
 * Engine's own jobs, the Synchronization Engine's own runs/conflicts, and
 * the Audit Center's own append-only trail for every `integration_*`
 * owner type. Nothing here mutates anything — every action a member can
 * take lives on the Configuration Center tab instead.
 */
export function IntegrationsDiagnosticsTab({ data }: IntegrationsDiagnosticsTabProps) {
  const healthSnapshots = data.connections.map((entry) => entry.health).filter((health): health is NonNullable<typeof health> => health !== null);
  const summary = summarizeHealth(healthSnapshots);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-text-muted">Connections</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.total}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Healthy</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.healthy}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Needs attention</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{summary.needsAttention}</p>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Webhook dead letters</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{data.deadLetterCount}</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Connection health</h3>
        {data.connections.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No connections to monitor" description="Install a provider from the Integrations tab to see its health here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Provider</th>
                  <th className="pb-2 pr-3 font-normal">State</th>
                  <th className="pb-2 pr-3 font-normal">Failures</th>
                  <th className="pb-2 pr-3 font-normal">Retries</th>
                  <th className="pb-2 font-normal">Token expires</th>
                </tr>
              </thead>
              <tbody>
                {data.connections.map(({ connection, provider, health }) => (
                  <tr key={connection.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{provider?.name ?? connection.provider_id}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={STATE_TONE[connection.state]}>{CONNECTION_STATE_LABELS[connection.state]}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{health?.failure_count ?? 0}</td>
                    <td className="py-2 pr-3 text-text-muted">{health?.retry_count ?? 0}</td>
                    <td className="py-2 text-text-muted">{health?.token_expires_at ? formatDateTime(health.token_expires_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Queue jobs</h3>
        {data.queueJobs.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No queued jobs" description="Jobs enqueued on the Queue Engine appear here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Queue</th>
                  <th className="pb-2 pr-3 font-normal">Kind</th>
                  <th className="pb-2 pr-3 font-normal">Status</th>
                  <th className="pb-2 pr-3 font-normal">Priority</th>
                  <th className="pb-2 pr-3 font-normal">Attempts</th>
                  <th className="pb-2 font-normal">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.queueJobs.map((job) => (
                  <tr key={job.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{job.queue}</td>
                    <td className="py-2 pr-3 text-text-muted">{job.kind}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={QUEUE_STATUS_TONE[job.status]}>{job.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{job.priority}</td>
                    <td className="py-2 pr-3 text-text-muted">
                      {job.attempts} / {job.max_attempts}
                    </td>
                    <td className="py-2 text-text-muted">{formatDateTime(job.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Synchronization runs</h3>
        {data.syncRuns.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No sync runs yet" description="Runs started on the Synchronization Engine appear here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Mode</th>
                  <th className="pb-2 pr-3 font-normal">Status</th>
                  <th className="pb-2 pr-3 font-normal">Records</th>
                  <th className="pb-2 pr-3 font-normal">Conflicts</th>
                  <th className="pb-2 font-normal">Started</th>
                </tr>
              </thead>
              <tbody>
                {data.syncRuns.map((run) => (
                  <tr key={run.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{run.mode}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={SYNC_STATUS_TONE[run.status]}>{run.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{run.records_processed}</td>
                    <td className="py-2 pr-3 text-text-muted">{run.conflicts_detected}</td>
                    <td className="py-2 text-text-muted">{formatDateTime(run.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Audit log</h3>
        {data.auditLog.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No audit entries yet" description="Install, connect, or transition a connection to see its audit trail here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Action</th>
                  <th className="pb-2 pr-3 font-normal">Owner</th>
                  <th className="pb-2 pr-3 font-normal">Actor</th>
                  <th className="pb-2 font-normal">Occurred</th>
                </tr>
              </thead>
              <tbody>
                {data.auditLog.map((entry: AuditLogEntry) => (
                  <tr key={entry.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">
                      <code className="text-xs">{entry.action}</code>
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{entry.owner_type}</td>
                    <td className="py-2 pr-3 text-text-muted">{entry.actor}</td>
                    <td className="py-2 text-text-muted">{formatDateTime(entry.occurred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Stripe API calls</h3>
        <p className="mt-1 text-xs text-text-muted">
          Every real call this workspace&apos;s Stripe connection has made. Rate limit tracking isn&apos;t implemented this checkpoint — Stripe only exposes it through raw response headers the typed SDK methods here don&apos;t surface; see{" "}
          <code className="text-xs">docs/stripe-provider.md</code>.
        </p>
        {data.stripeApiCalls.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No Stripe API calls yet" description="Every real call — customer sync, checkout sessions, refunds, invoices — appears here once Stripe is connected and used." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Method</th>
                  <th className="pb-2 pr-3 font-normal">Status</th>
                  <th className="pb-2 pr-3 font-normal">Duration</th>
                  <th className="pb-2 font-normal">Occurred</th>
                </tr>
              </thead>
              <tbody>
                {data.stripeApiCalls.map((call) => (
                  <tr key={call.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">
                      <code className="text-xs">{call.method}</code>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={call.success ? "success" : "danger"}>{call.success ? "Succeeded" : "Failed"}</Badge>
                      {call.error ? <span className="ml-2 text-xs text-text-muted">{call.error}</span> : null}
                    </td>
                    <td className="py-2 pr-3 text-text-muted">{call.durationMs}ms</td>
                    <td className="py-2 text-text-muted">{formatDateTime(call.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
