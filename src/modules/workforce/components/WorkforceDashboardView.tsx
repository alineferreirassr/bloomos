"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { evaluateWorkforceAction, setWorkerStatusAction, type EvaluateWorkforceResult } from "@/modules/workforce/workforceActions";
import type { Worker } from "@/types/workforce";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamIcon, CheckIcon, AssetsIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 26, Step 13 — Workforce Dashboard. Every figure here is
 * read straight from `evaluateWorkforceAction`'s already-computed result —
 * no scheduling, no dispatch, no route planning; this checkpoint is
 * infrastructure only, per its own stop condition.
 *
 * Accessibility: every interactive row is a real `<button>`, status
 * changes are announced via an `aria-live` region, and every list carries
 * `role="list"`/`role="listitem"` so screen readers get an accurate
 * count — mirrors `ExecutiveDashboardView.tsx`'s established pattern.
 *
 * Performance: groupings are `useMemo`-derived, and the full worker
 * roster is lazy — it only renders once expanded.
 */

const STATUS_TONE: Record<Worker["status"], BadgeTone> = {
  active: "success",
  inactive: "neutral",
  on_leave: "warning",
  terminated: "danger",
};

const WORKER_ROLE_LABELS: Record<Worker["role"], string> = {
  technician: "Technician",
  photographer: "Photographer",
  videographer: "Videographer",
  installer: "Installer",
  inspector: "Inspector",
  driver: "Driver",
  crew_member: "Crew Member",
  supervisor: "Supervisor",
  contractor: "Contractor",
  vendor_rep: "Vendor Representative",
  other: "Other",
};

function WorkerRow({ worker, onArchive, busy }: { worker: Worker; onArchive: (id: string) => void; busy: boolean }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[worker.status]}>{worker.status.replace(/_/g, " ")}</Badge>
          <Link href={`/assets/workforce/workers/${worker.id}`} className="truncate text-sm font-medium text-accent hover:underline">
            {worker.first_name} {worker.last_name}
          </Link>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{WORKER_ROLE_LABELS[worker.role]}</p>
      </div>
      {worker.status !== "terminated" ? (
        <Button variant="secondary" onClick={() => onArchive(worker.id)} disabled={busy} aria-label={`Archive ${worker.first_name} ${worker.last_name}`}>
          Archive
        </Button>
      ) : (
        <Badge tone="danger">archived</Badge>
      )}
    </li>
  );
}

export function WorkforceDashboardView() {
  const [data, setData] = useState<EvaluateWorkforceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showAllWorkers, setShowAllWorkers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    evaluateWorkforceAction().then((result) => {
      if (cancelled) return;
      if (result.success) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reevaluate() {
    setLoading(true);
    setError(null);
    const result = await evaluateWorkforceAction();
    if (result.success) setData(result.data);
    else setError(result.error);
    setLoading(false);
  }

  async function handleArchive(workerId: string) {
    setBusyId(workerId);
    const result = await setWorkerStatusAction(workerId, "terminated");
    if (result.success) {
      setAnnouncement(`${result.data.first_name} ${result.data.last_name} archived.`);
      await reevaluate();
    } else {
      setAnnouncement(result.error);
    }
    setBusyId(null);
  }

  const activeWorkers = useMemo(() => data?.workers.filter((w) => w.status === "active") ?? [], [data]);
  const onLeaveWorkers = useMemo(() => data?.workers.filter((w) => w.status === "on_leave") ?? [], [data]);

  return (
    <div>
      <PageHeader
        title="Mobile Workforce Platform"
        subtitle="Workers, teams, availability, assignments, equipment, and vehicles — the operational foundation future dispatch and scheduling checkpoints will extend."
        icon={TeamIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: "Business Health", href: "/assets/business-health" }, { label: "Workforce" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/assets/workforce/capabilities">
              <Button variant="secondary">Capabilities</Button>
            </Link>
            <Button variant="secondary" onClick={reevaluate} disabled={loading}>
              {loading ? "Evaluating…" : "Re-evaluate"}
            </Button>
          </div>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="The Workforce Platform isn't available" description={error} icon={TeamIcon} /> : null}

      {data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total Workers" value={String(data.scorecard.totalWorkers)} icon={TeamIcon} helper={`${data.scorecard.activeWorkers} active`} />
            <KpiCard label="Available Now" value={String(data.scorecard.availableNow)} icon={CheckIcon} helper={`${data.scorecard.onAssignmentNow} on assignment`} />
            <KpiCard label="Teams" value={String(data.scorecard.teamsCount)} icon={AssetsIcon} helper={`${data.scorecard.activeAssignments} active assignments`} />
            <KpiCard label="Expiring Certifications" value={String(data.scorecard.expiringCertificationsCount)} icon={AnalyticsIcon} helper="Within 30 days" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">
                Active Workers <span className="font-normal text-text-muted">({activeWorkers.length})</span>
              </h2>
              {activeWorkers.length === 0 ? (
                <EmptyState title="No active workers yet" description="Add a worker to start building your field workforce." icon={TeamIcon} />
              ) : (
                <ul role="list">{activeWorkers.slice(0, 8).map((w) => <WorkerRow key={w.id} worker={w} onArchive={handleArchive} busy={busyId === w.id} />)}</ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">
                On Leave <span className="font-normal text-text-muted">({onLeaveWorkers.length})</span>
              </h2>
              {onLeaveWorkers.length === 0 ? <p className="text-sm text-success">No one is currently on leave.</p> : <ul role="list">{onLeaveWorkers.map((w) => <WorkerRow key={w.id} worker={w} onArchive={handleArchive} busy={busyId === w.id} />)}</ul>}
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Equipment</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">In use</dt>
                  <dd>{data.equipmentUtilization.inUseCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Available</dt>
                  <dd>{data.equipmentUtilization.availableCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Maintenance</dt>
                  <dd>{data.equipmentUtilization.maintenanceCount}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">Vehicles</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-text-muted">In use</dt>
                  <dd>{data.vehicleUtilization.inUseCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Available</dt>
                  <dd>{data.vehicleUtilization.availableCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Maintenance</dt>
                  <dd>{data.vehicleUtilization.maintenanceCount}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">Expiring Certifications</h2>
              {data.expiringCertifications.length === 0 ? (
                <p className="text-sm text-success">Nothing expiring in the next 30 days.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.expiringCertifications.slice(0, 5).map((c) => (
                    <li key={`${c.workerId}:${c.certification.id}`} className="flex items-center justify-between">
                      <span className="truncate">
                        {c.workerName} — {c.certification.name}
                      </span>
                      <Badge tone={c.daysUntilExpiration < 0 ? "danger" : "warning"}>{c.daysUntilExpiration < 0 ? "expired" : `${c.daysUntilExpiration}d`}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                All Workers <span className="font-normal text-text-muted">({data.workers.length})</span>
              </h2>
              <Button variant="secondary" onClick={() => setShowAllWorkers((v) => !v)} aria-expanded={showAllWorkers}>
                {showAllWorkers ? "Hide" : "Show"}
              </Button>
            </div>
            {showAllWorkers ? (
              data.workers.length === 0 ? (
                <EmptyState title="No workers yet" icon={TeamIcon} />
              ) : (
                <ul role="list">{data.workers.map((w) => <WorkerRow key={w.id} worker={w} onArchive={handleArchive} busy={busyId === w.id} />)}</ul>
              )
            ) : (
              <p className="text-xs text-text-muted">Expand to render the full roster.</p>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="mb-1 text-sm font-semibold">Mobile &amp; Offline Foundation</h2>
            <p className="text-xs text-text-muted">
              {data.scorecard.activeMobileSessions} active mobile session{data.scorecard.activeMobileSessions === 1 ? "" : "s"}. Session lifecycle, offline queueing, and location snapshots are infrastructure only this checkpoint — no sync engine, no route
              optimization, no GPS history. Future checkpoints extend this foundation.
            </p>
          </Card>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Evaluating the workforce platform…</p>
      ) : null}
    </div>
  );
}
