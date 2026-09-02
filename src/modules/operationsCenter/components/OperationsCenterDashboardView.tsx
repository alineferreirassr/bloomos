"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { evaluateOperationsCenterAction, acknowledgeAlertAction, resolveAlertAction, type EvaluateOperationsCenterResult } from "@/modules/operationsCenter/operationsCenterActions";
import type { OperationalSeverity, OperationalStatus } from "@/types/operationsCenter";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon, CheckIcon, AnalyticsIcon, TeamIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 31, Steps 17-20 — Operations Center Dashboard. Read-only
 * aggregate view over `evaluateOperationsCenterAction`'s own already-
 * computed result — the single unified command surface the whole
 * checkpoint exists to build. "The Operations Center observes and
 * coordinates": nothing here dispatches a worker, changes execution
 * state, recalculates a route/schedule/allocation, or renders a real
 * map. Acknowledge/Resolve are wired directly (Alerts are this
 * checkpoint's own writable domain), mirroring the "one wired mutation
 * surface" precedent every prior platform dashboard in this codebase
 * establishes for its own new aggregate root.
 *
 * One adaptive view serves Owner/Team/Mobile (Steps 17-19) — the same
 * figures at every breakpoint, laid out in a responsive grid rather than
 * three separate components, consistent with every other checkpoint's
 * own "one dashboard, responsive" precedent.
 */
const SEVERITY_TONE: Record<OperationalSeverity, BadgeTone> = { critical: "danger", high: "warning", medium: "accent", low: "neutral", informational: "outline" };
const STATUS_TONE: Record<OperationalStatus, BadgeTone> = { normal: "success", attention: "accent", at_risk: "warning", critical: "danger", degraded: "warning", unknown: "neutral" };
const STATUS_LABEL: Record<OperationalStatus, string> = { normal: "Normal", attention: "Attention", at_risk: "At Risk", critical: "Critical", degraded: "Degraded", unknown: "Unknown" };

export function OperationsCenterDashboardView() {
  const [data, setData] = useState<EvaluateOperationsCenterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actingAlertId, setActingAlertId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  async function refresh() {
    setLoading(true);
    const result = await evaluateOperationsCenterAction();
    if (result.success) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setAnnouncement("Operations Center refreshed.");
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    evaluateOperationsCenterAction().then((result) => {
      if (cancelled) return;
      if (result.success) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAcknowledge(alertId: string) {
    setActingAlertId(alertId);
    await acknowledgeAlertAction(alertId);
    await refresh();
    setActingAlertId(null);
  }

  async function handleResolve(alertId: string) {
    setActingAlertId(alertId);
    await resolveAlertAction(alertId, "Resolved from the Operations Center dashboard.");
    await refresh();
    setActingAlertId(null);
  }

  const openAlerts = useMemo(() => (data?.alerts ?? []).filter((a) => a.status === "open" || a.status === "acknowledged" || a.status === "escalated"), [data]);
  const openIncidents = useMemo(() => (data?.incidents ?? []).filter((i) => i.status !== "resolved"), [data]);
  const topPriorities = useMemo(() => (data?.priorityQueue ?? []).slice(0, 10), [data]);

  if (error) return <EmptyState title="The Operations Center isn't available" description={error} icon={VendorsIcon} />;

  return (
    <div>
      <PageHeader
        title="Operations Center"
        subtitle="Observes and coordinates every existing platform — never a new source of truth, never dispatches work, never a real map."
        icon={VendorsIcon}
        breadcrumb={[{ label: "Operations Center" }]}
        actions={
          data ? (
            <div className="flex items-center gap-3">
              <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
              <Button variant="secondary" onClick={refresh} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          ) : undefined
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Active Operations" value={String(data.kpis.activeOperations)} icon={AnalyticsIcon} />
            <KpiCard label="Pending Acceptances" value={String(data.kpis.pendingAcceptances)} icon={CheckIcon} />
            <KpiCard label="Critical Alerts" value={String(data.kpis.criticalAlerts)} icon={AnalyticsIcon} />
            <KpiCard label="Open Incidents" value={String(data.kpis.openIncidents)} icon={AnalyticsIcon} />
            <KpiCard label="High-Risk Routes" value={String(data.kpis.highRiskRoutes)} icon={VendorsIcon} />
            <KpiCard label="Scheduling Conflicts" value={String(data.kpis.schedulingConflicts)} icon={AnalyticsIcon} />
            <KpiCard label="Available Workers" value={String(data.kpis.availableWorkers)} icon={TeamIcon} />
            <KpiCard label="Overall Health" value={String(data.health.overallOperationsCenterHealth)} icon={CheckIcon} />
          </div>

          <SectionHeader title="Overview" />

          <LuxuryCard className="mb-6">
            <h2 className="mb-2 text-sm font-semibold">Operations Brief</h2>
            <p className="text-sm text-text-muted">{data.digest}</p>
          </LuxuryCard>

          <LuxuryCard tone="tint" className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Priority Queue <span className="font-normal text-text-muted">({data.priorityQueue.length})</span>
            </h2>
            {topPriorities.length === 0 ? (
              <p className="text-sm text-success">Nothing requires immediate attention.</p>
            ) : (
              <ul role="list">
                {topPriorities.map((item) => (
                  <li key={item.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      <p className="mt-0.5 truncate text-xs text-text-muted">{item.description}</p>
                    </div>
                    <Badge tone={SEVERITY_TONE[item.severity]}>{item.severity}</Badge>
                    {item.deepLink ? (
                      <Link href={item.deepLink} className="text-sm text-accent hover:underline">
                        View →
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <SectionHeader title="Alerts & Incidents" />

          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Open Alerts <span className="font-normal text-text-muted">({openAlerts.length})</span>
            </h2>
            {openAlerts.length === 0 ? (
              <p className="text-sm text-success">No open alerts.</p>
            ) : (
              <ul role="list">
                {openAlerts.slice(0, 15).map((alert) => (
                  <li key={alert.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{alert.title}</span>
                      <p className="mt-0.5 truncate text-xs text-text-muted">{alert.description}</p>
                    </div>
                    <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
                    {alert.status === "open" ? (
                      <Button variant="secondary" onClick={() => handleAcknowledge(alert.id)} disabled={actingAlertId === alert.id}>
                        Acknowledge
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => handleResolve(alert.id)} disabled={actingAlertId === alert.id}>
                        Resolve
                      </Button>
                    )}
                    <Link href={`/operations-center/alerts/${alert.id}`} className="text-sm text-accent hover:underline">
                      Detail
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Open Incidents <span className="font-normal text-text-muted">({openIncidents.length})</span>
            </h2>
            {openIncidents.length === 0 ? (
              <p className="text-sm text-success">No open incidents.</p>
            ) : (
              <ul role="list">
                {openIncidents.map((incident) => (
                  <li key={incident.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">{incident.title}</span>
                      <p className="mt-0.5 text-xs text-text-muted">{incident.source_alert_ids.length} linked alert{incident.source_alert_ids.length === 1 ? "" : "s"}</p>
                    </div>
                    <Badge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</Badge>
                    <Badge tone="outline">{incident.status}</Badge>
                    <Link href={`/operations-center/incidents/${incident.id}`} className="text-sm text-accent hover:underline">
                      Detail
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <SectionHeader title="Resources" />

          <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <LuxuryCard>
              <h2 className="mb-3 text-sm font-semibold">Resource Overview</h2>
              <ul role="list" className="grid grid-cols-2 gap-3 text-sm">
                <li>
                  Workers available <span className="font-semibold">{data.resourceOverview.workersAvailable}</span>
                </li>
                <li>
                  Workers busy <span className="font-semibold">{data.resourceOverview.workersBusy}</span>
                </li>
                <li>
                  Equipment available <span className="font-semibold">{data.resourceOverview.equipmentAvailable}</span>
                </li>
                <li>
                  Vehicles available <span className="font-semibold">{data.resourceOverview.vehiclesAvailable}</span>
                </li>
                <li>
                  Teams active <span className="font-semibold">{data.resourceOverview.teamsActive}</span>
                </li>
              </ul>
            </LuxuryCard>

            <LuxuryCard>
              <h2 className="mb-3 text-sm font-semibold">Location Summary</h2>
              <p className="mb-2 text-xs text-text-muted">List-based summary only — provider-ready placeholder, never a real map, no exact coordinates exposed.</p>
              <ul role="list" className="grid grid-cols-2 gap-3 text-sm">
                <li>
                  Known worker locations <span className="font-semibold">{data.locationSummary.knownWorkerLocationsCount}</span>
                </li>
                <li>
                  Unknown locations <span className="font-semibold">{data.locationSummary.unknownLocationCount}</span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-text-muted">{data.locationSummary.locationAccuracySummary}</p>
            </LuxuryCard>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">Loading Operations Center…</p>
      )}
    </div>
  );
}
