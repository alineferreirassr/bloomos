"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOperationalAlertAction, acknowledgeAlertAction, resolveAlertAction, dismissAlertAction, escalateAlertAction } from "@/modules/operationsCenter/operationsCenterActions";
import type { AlertStatus, OperationalAlert, OperationalSeverity } from "@/types/operationsCenter";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon } from "@/components/ui/icons";
import { CommentsPanel } from "@/modules/communication/comments/components/CommentsPanel";

/**
 * v2.0 Checkpoint 31, Step 21 — Alert Detail. One alert's full record and
 * its own 6-state lifecycle. Acknowledging/resolving/dismissing/
 * escalating only ever mutate this alert's own record — never the
 * source module the alert references. Comments attach directly since
 * `operational_alert` is a real `EntityType` (Step 15's own Communication
 * Integration), no bespoke comment surface needed.
 */
const SEVERITY_TONE: Record<OperationalSeverity, BadgeTone> = { critical: "danger", high: "warning", medium: "accent", low: "neutral", informational: "outline" };
const STATUS_TONE: Record<AlertStatus, BadgeTone> = { open: "danger", acknowledged: "accent", resolved: "success", dismissed: "neutral", escalated: "warning", expired: "outline" };

export function AlertDetailView({ alertId }: { alertId: string }) {
  const [alert, setAlert] = useState<OperationalAlert | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    const result = await getOperationalAlertAction(alertId);
    if (result.success) setAlert(result.data);
    else setError(result.error);
  }

  useEffect(() => {
    let cancelled = false;
    getOperationalAlertAction(alertId).then((result) => {
      if (cancelled) return;
      if (result.success) setAlert(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [alertId]);

  async function run(action: () => Promise<unknown>) {
    setActing(true);
    await action();
    await load();
    setActing(false);
  }

  if (error) return <EmptyState title="This alert isn't available" description={error} icon={VendorsIcon} />;
  if (!alert) return <p className="text-sm text-text-muted">Loading alert…</p>;

  const isOpen = alert.status === "open" || alert.status === "acknowledged" || alert.status === "escalated";

  return (
    <div>
      <PageHeader
        title={alert.title}
        subtitle={`${alert.category.replace(/_/g, " ")} · rule ${alert.rule_id} · opened ${new Date(alert.created_at).toLocaleString()}`}
        icon={VendorsIcon}
        breadcrumb={[{ label: "Operations Center", href: "/operations-center" }, { label: alert.title }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
            <Badge tone={STATUS_TONE[alert.status]}>{alert.status}</Badge>
          </div>
        }
      />

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">Description</h2>
        <p className="text-sm">{alert.description}</p>
        {alert.source_record_id ? <p className="mt-2 text-xs text-text-muted">Source record: {alert.source_record_id}</p> : null}
      </Card>

      {isOpen ? (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {alert.status === "open" ? (
              <Button variant="secondary" onClick={() => run(() => acknowledgeAlertAction(alert.id))} disabled={acting}>
                Acknowledge
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => run(() => resolveAlertAction(alert.id, "Confirmed resolved from the Alert Detail view."))} disabled={acting}>
              Resolve
            </Button>
            <Button variant="secondary" onClick={() => run(() => dismissAlertAction(alert.id, "Dismissed from the Alert Detail view."))} disabled={acting}>
              Dismiss
            </Button>
            {alert.status !== "escalated" ? (
              <Button variant="secondary" onClick={() => run(() => escalateAlertAction(alert.id))} disabled={acting}>
                Escalate
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Resolution</h2>
          <p className="text-sm text-text-muted">{alert.resolution_reason ?? "No resolution reason recorded."}</p>
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Lifecycle</h2>
        <ul role="list" className="text-sm">
          <li className="border-b border-border/50 py-2">Opened {new Date(alert.created_at).toLocaleString()}</li>
          {alert.acknowledged_at ? <li className="border-b border-border/50 py-2">Acknowledged {new Date(alert.acknowledged_at).toLocaleString()} by {alert.acknowledged_by}</li> : null}
          {alert.escalated_at ? <li className="border-b border-border/50 py-2">Escalated {new Date(alert.escalated_at).toLocaleString()}</li> : null}
          {alert.dismissed_at ? <li className="border-b border-border/50 py-2">Dismissed {new Date(alert.dismissed_at).toLocaleString()}</li> : null}
          {alert.resolved_at ? <li className="py-2">Resolved {new Date(alert.resolved_at).toLocaleString()} by {alert.resolved_by}</li> : null}
        </ul>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Comments</h2>
        <CommentsPanel ownerType="operational_alert" ownerId={alert.id} />
      </Card>

      <Link href="/operations-center" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Operations Center
      </Link>
    </div>
  );
}
