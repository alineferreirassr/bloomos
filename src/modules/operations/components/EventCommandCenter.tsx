"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getEventOperationsData, type EventOperationsData } from "@/modules/operations/eventOperationsData";
import { recordInventoryMovement } from "@/lib/data";
import { OPERATIONS_HEALTH_BAND_LABELS } from "@/core/operations/types";
import { PACKING_CATEGORY_LABELS, LOGISTICS_PHASE_LABELS } from "@/core/operations/types";
import { LiveEventModePanel } from "@/modules/operations/components/LiveEventModePanel";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState = { status: "loading" } | { status: "ready"; data: EventOperationsData } | { status: "error" };

const HEALTH_BAND_TONE: Record<string, BadgeTone> = {
  excellent: "success",
  good: "accent",
  attention: "warning",
  critical: "danger",
};

const RISK_SEVERITY_TONE: Record<string, BadgeTone> = { critical: "danger", warning: "warning" };

function formatMinor(minor: number): string {
  return `$${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * v2 Checkpoint 21, Step 1 — the Event Command Center. Every event's own
 * one-screen operational hub: Countdown, Health Score v2, Risk Center,
 * Team/Vendor/Purchase/Budget/Inventory summaries, the Packing Assistant,
 * the Logistics Center, and the unified Operations Timeline — composed
 * entirely from `getEventOperationsData()` (Step 1's own data seam) and the
 * reusable engines from Step 17. Mounted on `EventDetailView.tsx` in place
 * of the old "Future Integrations — reserved for upcoming modules" card.
 */
export function EventCommandCenter({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [liveModeOpen, setLiveModeOpen] = useState(false);
  const [reservingItemId, setReservingItemId] = useState<string | null>(null);
  const session = useMemberSession();

  const load = () => {
    setState((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    getEventOperationsData(eventId).then(
      (data) => setState({ status: "ready", data }),
      () => setState({ status: "error" }),
    );
  };

  useEffect(() => {
    let cancelled = false;
    getEventOperationsData(eventId).then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleReserveItem = async (inventoryItemId: string, itemName: string, quantity: number) => {
    setReservingItemId(inventoryItemId);
    await recordInventoryMovement(inventoryItemId, {
      movement_type: "reservation",
      quantity,
      reason: `Reserved for event: ${itemName}`,
      reference_type: "event",
      reference_id: eventId,
    });
    setReservingItemId(null);
    load();
  };

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load the Event Command Center." onRetry={load} />;
  }

  const { data } = state;
  const loggedByName = session.status === "active" ? (session.profile?.full_name ?? session.user?.email ?? "Team member") : "Team member";
  const isLiveEventDay = ["setup", "execution", "live_event", "breakdown"].includes(data.event.lifecycle_stage);

  return (
    <Card className="border-accent/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-[19px] font-semibold text-text">Event Command Center</h3>
          <p className="mt-0.5 text-xs text-text-muted">Everything operational for this event, in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={HEALTH_BAND_TONE[data.health.band]}>{OPERATIONS_HEALTH_BAND_LABELS[data.health.band]}</Badge>
            <ProgressBar value={data.health.score} label="Operations health score" className="w-28" />
          </div>
          {data.daysUntilEvent !== null ? (
            <Badge tone={data.daysUntilEvent <= 7 && data.daysUntilEvent >= 0 ? "warning" : "neutral"}>
              {data.daysUntilEvent > 0 ? `${data.daysUntilEvent} days to go` : data.daysUntilEvent === 0 ? "Today" : `${Math.abs(data.daysUntilEvent)} days ago`}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        <Button variant={isLiveEventDay ? "primary" : "secondary"} onClick={() => setLiveModeOpen(true)}>
          {isLiveEventDay ? "Open Live Event Mode" : "Preview Live Event Mode"}
        </Button>
      </div>

      {data.risks.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Risk Center</p>
          <ul className="mt-2 space-y-2">
            {data.risks.map((risk) => (
              <li key={risk.kind} className="flex items-start gap-2 rounded-md border border-border p-2.5">
                <Badge tone={RISK_SEVERITY_TONE[risk.severity]} className="mt-0.5 shrink-0">
                  {risk.severity}
                </Badge>
                <div>
                  <p className="text-sm text-text">{risk.message}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{risk.recommendation}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-muted">No operational risks detected right now.</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryTile label="Checklist" value={`${data.checklistCompletionPercentage}%`} />
        <SummaryTile
          label="Team"
          value={`${data.teamRequirements.filter((r) => r.member !== null).length}/${data.teamRequirements.length}`}
        />
        <SummaryTile
          label="Vendors"
          value={`${data.vendorAssignments.filter((a) => a.assignment.status === "confirmed").length}/${data.vendorAssignments.length}`}
        />
        <SummaryTile
          label="Purchases"
          value={`${data.purchaseRequirements.filter((p) => p.purchase !== null).length}/${data.purchaseRequirements.length}`}
        />
        <SummaryTile label="Budget margin" value={`${data.budget.marginPercentage}%`} />
        <SummaryTile label="Gallery" value={String(data.galleryAssetCount)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Team Assignments</p>
          {data.teamRequirements.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No team roles required for this event&apos;s assigned Services yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {data.teamRequirements.map(({ requirement, member }) => (
                <li key={requirement.id} className="flex items-center justify-between text-sm">
                  <span className="text-text">{requirement.role_label}</span>
                  {member ? <span className="text-text-muted">{member.full_name ?? member.email}</span> : <Badge tone="warning">Unassigned</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Vendor Assignments</p>
          {data.vendorAssignments.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No vendor requirements for this event&apos;s assigned Services yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {data.vendorAssignments.map(({ assignment, vendor }) => (
                <li key={assignment.id} className="flex items-center justify-between text-sm">
                  <span className="text-text">{vendor?.company_name ?? "Unknown vendor"}</span>
                  <Badge tone={assignment.status === "confirmed" ? "success" : assignment.status === "declined" ? "danger" : "outline"}>{assignment.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Packing Assistant</p>
        {data.packingGroups.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">Nothing to pack yet — assign Services with inventory requirements to generate a list.</p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.packingGroups.map((group) => (
              <div key={group.category} className="rounded-md border border-border p-2.5">
                <p className="text-xs font-semibold text-text">{PACKING_CATEGORY_LABELS[group.category]}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                  {group.items.map((item) => (
                    <li key={item.itemName} className="flex items-center justify-between gap-2">
                      <span>
                        {item.itemName} × {item.quantity}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={item.source === "inventory" ? "accent" : "outline"}>{item.source === "inventory" ? "Pull from stock" : "Needs sourcing"}</Badge>
                        {item.source === "inventory" && item.inventoryItemId ? (
                          <Button
                            variant="ghost"
                            className="min-h-0 px-1.5 py-0.5 text-[11px]"
                            disabled={reservingItemId === item.inventoryItemId}
                            onClick={() => handleReserveItem(item.inventoryItemId as string, item.itemName, item.quantity)}
                          >
                            {reservingItemId === item.inventoryItemId ? "Reserving…" : "Reserve"}
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Logistics Center</p>
          {data.logistics.phases.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No arrival/setup/ceremony/photography/cleanup/departure schedule items yet.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {data.logistics.phases.map((phase) => (
                <li key={phase.scheduleItemId} className="flex items-center justify-between text-sm">
                  <span className="text-text">{LOGISTICS_PHASE_LABELS[phase.phase]}</span>
                  <span className="text-text-muted">{phase.time ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-text-muted">{data.logistics.loadingNote}</p>
          <p className="text-xs text-text-muted">{data.logistics.unloadingNote}</p>
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Budget Center</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <BudgetField label="Estimated revenue" value={formatMinor(data.budget.estimatedRevenueMinor)} />
            <BudgetField label="Estimated cost" value={formatMinor(data.budget.estimatedCostMinor)} />
            <BudgetField label="Actual revenue" value={formatMinor(data.budget.actualRevenueMinor)} />
            <BudgetField label="Actual cost" value={formatMinor(data.budget.actualCostMinor)} />
            <BudgetField label="Profit" value={formatMinor(data.budget.profitMinor)} />
            <BudgetField label="Margin" value={`${data.budget.marginPercentage}%`} />
          </dl>
          <p className="mt-2 text-xs text-text-muted">{data.budget.forecastNote}</p>
          <Link href="/purchases" className="mt-2 inline-block text-xs text-accent hover:underline">
            View Purchase Center →
          </Link>
        </section>
      </div>

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Operations Timeline</p>
        {data.timeline.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No operational milestones recorded yet.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {data.timeline.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="text-text">{entry.title}</p>
                  {entry.description ? <p className="text-xs text-text-muted">{entry.description}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-text-muted">{new Date(entry.occurredAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-3 rounded-md bg-surface-tint p-3">
        <p className="text-xs font-medium text-text">Weather</p>
        <p className="mt-1 text-xs text-text-muted">
          {data.event.weather_plan || "No weather plan on file yet — this workspace doesn't have a connected weather source."}
        </p>
      </div>

      {liveModeOpen ? (
        <LiveEventModePanel
          event={data.event}
          loggedByName={loggedByName}
          onClose={() => setLiveModeOpen(false)}
          onChanged={load}
        />
      ) : null}
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-tint p-2.5 text-center">
      <p className="text-lg font-semibold text-text">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
    </div>
  );
}

function BudgetField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
