"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOperationalIncidentAction, setIncidentStatusAction } from "@/modules/operationsCenter/operationsCenterActions";
import type { IncidentStatus, OperationalIncident, OperationalSeverity } from "@/types/operationsCenter";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon } from "@/components/ui/icons";
import { CommentsPanel } from "@/modules/communication/comments/components/CommentsPanel";

/**
 * v2.0 Checkpoint 31, Step 22 — Incident Detail. One incident's full
 * record: the alerts it groups, every related resource id it names, and
 * its own 3-state lifecycle. Never an external incident-management
 * platform — this view only reads/transitions the one internal record
 * `incidentEngine.ts`/`operationalIncidentsStore.ts` already own.
 */
const SEVERITY_TONE: Record<OperationalSeverity, BadgeTone> = { critical: "danger", high: "warning", medium: "accent", low: "neutral", informational: "outline" };
const STATUS_TONE: Record<IncidentStatus, BadgeTone> = { open: "danger", acknowledged: "accent", resolved: "success" };

function RelatedList({ label, ids }: { label: string; ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold text-text-muted">{label}</p>
      <ul role="list" className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <li key={id} role="listitem">
            <Badge tone="outline">{id}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IncidentDetailView({ incidentId }: { incidentId: string }) {
  const [incident, setIncident] = useState<OperationalIncident | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    const result = await getOperationalIncidentAction(incidentId);
    if (result.success) setIncident(result.data);
    else setError(result.error);
  }

  useEffect(() => {
    let cancelled = false;
    getOperationalIncidentAction(incidentId).then((result) => {
      if (cancelled) return;
      if (result.success) setIncident(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  async function transition(status: IncidentStatus, resolutionNotes?: string) {
    setActing(true);
    await setIncidentStatusAction(incidentId, status, resolutionNotes);
    await load();
    setActing(false);
  }

  if (error) return <EmptyState title="This incident isn't available" description={error} icon={VendorsIcon} />;
  if (!incident) return <p className="text-sm text-text-muted">Loading incident…</p>;

  return (
    <div>
      <PageHeader
        title={incident.title}
        subtitle={`opened ${new Date(incident.created_at).toLocaleString()} · ${incident.source_alert_ids.length} linked alert${incident.source_alert_ids.length === 1 ? "" : "s"}`}
        icon={VendorsIcon}
        breadcrumb={[{ label: "Operations Center", href: "/operations-center" }, { label: incident.title }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</Badge>
            <Badge tone={STATUS_TONE[incident.status]}>{incident.status}</Badge>
          </div>
        }
      />

      <SectionHeader title="Overview" />

      <LuxuryCard className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Summary</h2>
        <p className="whitespace-pre-line text-sm">{incident.description}</p>
      </LuxuryCard>

      {incident.status !== "resolved" ? (
        <LuxuryCard tone="tint" className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {incident.status === "open" ? (
              <Button variant="secondary" onClick={() => transition("acknowledged")} disabled={acting}>
                Acknowledge
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => transition("resolved", "Confirmed resolved from the Incident Detail view.")} disabled={acting}>
              Resolve
            </Button>
          </div>
        </LuxuryCard>
      ) : (
        <LuxuryCard tone="tint" className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Resolution Notes</h2>
          <p className="text-sm text-text-muted">{incident.resolution_notes ?? "No resolution notes recorded."}</p>
        </LuxuryCard>
      )}

      <SectionHeader title="Related" />

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Related Resources</h2>
        <RelatedList label="Dispatch Orders" ids={incident.related_dispatch_order_ids} />
        <RelatedList label="Field Operations" ids={incident.related_field_operation_ids} />
        <RelatedList label="Route Plans" ids={incident.related_route_plan_ids} />
        <RelatedList label="Workers" ids={incident.related_worker_ids} />
        <RelatedList label="Vehicles" ids={incident.related_vehicle_ids} />
        <RelatedList label="Equipment" ids={incident.related_equipment_ids} />
        {incident.related_dispatch_order_ids.length === 0 &&
        incident.related_field_operation_ids.length === 0 &&
        incident.related_route_plan_ids.length === 0 &&
        incident.related_worker_ids.length === 0 &&
        incident.related_vehicle_ids.length === 0 &&
        incident.related_equipment_ids.length === 0 ? (
          <p className="text-sm text-text-muted">No related resources recorded on this incident.</p>
        ) : null}
      </LuxuryCard>

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Source Alerts <span className="font-normal text-text-muted">({incident.source_alert_ids.length})</span>
        </h2>
        {incident.source_alert_ids.length === 0 ? (
          <p className="text-sm text-text-muted">No alerts linked to this incident.</p>
        ) : (
          <ul role="list">
            {incident.source_alert_ids.map((alertId) => (
              <li key={alertId} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <span className="text-sm">{alertId}</span>
                <Link href={`/operations-center/alerts/${alertId}`} className="text-sm text-accent hover:underline">
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </LuxuryCard>

      <SectionHeader title="Activity" />

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Lifecycle</h2>
        <ul role="list" className="text-sm">
          <li className="border-b border-border/50 py-2">Opened {new Date(incident.created_at).toLocaleString()}</li>
          {incident.acknowledged_at ? <li className="border-b border-border/50 py-2">Acknowledged {new Date(incident.acknowledged_at).toLocaleString()}</li> : null}
          {incident.resolved_at ? <li className="py-2">Resolved {new Date(incident.resolved_at).toLocaleString()}</li> : null}
        </ul>
      </LuxuryCard>

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Comments</h2>
        <CommentsPanel ownerType="operational_incident" ownerId={incident.id} />
      </LuxuryCard>

      <Link href="/operations-center" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Operations Center
      </Link>
    </div>
  );
}
