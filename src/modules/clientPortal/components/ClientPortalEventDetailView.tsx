"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalEventById } from "@/lib/data";
import { getClientPortalKnowledgeSummaryAction, type ClientPortalKnowledgeConnection } from "@/modules/clientPortal/getClientPortalKnowledgeSummary";
import type { ClientPortalEvent } from "@/types/clientPortal";
import type { EventStatus } from "@/core/enums/eventStatus";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "error" } | { status: "ready"; event: ClientPortalEvent };

const PREPARATION_STATUSES: readonly EventStatus[] = ["draft", "inquiry", "awaiting_contract", "awaiting_deposit", "confirmed", "planning", "ready"];

/**
 * Checkpoint 36, Step 10 — "Preparation Status"/"Execution Status" are
 * derived entirely from the real, already-client-visible `event.status`
 * (`core/enums/eventStatus.ts`'s own linear progression) — no new field,
 * no second status model.
 */
function derivePreparationExecution(status: EventStatus): { preparation: string; preparationTone: BadgeTone; execution: string; executionTone: BadgeTone } {
  if (status === "cancelled" || status === "archived") {
    return { preparation: "Not applicable", preparationTone: "neutral", execution: "Not applicable", executionTone: "neutral" };
  }
  if (status === "completed") {
    return { preparation: "Complete", preparationTone: "success", execution: "Complete", executionTone: "success" };
  }
  if (status === "in_progress") {
    return { preparation: "Complete", preparationTone: "success", execution: "Underway", executionTone: "accent" };
  }
  if (PREPARATION_STATUSES.includes(status)) {
    return { preparation: "In Progress", preparationTone: "outline", execution: "Not started", executionTone: "neutral" };
  }
  return { preparation: "Not started", preparationTone: "neutral", execution: "Not started", executionTone: "neutral" };
}

export function ClientPortalEventDetailView({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [connections, setConnections] = useState<ClientPortalKnowledgeConnection[] | null>(null);

  const fetchEvent = () =>
    getClientPortalEventById(eventId)
      .then((event) => setState({ status: "ready", event }))
      .catch((err) => setState({ status: err instanceof NotFoundError ? "not-found" : "error" }));

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    getClientPortalKnowledgeSummaryAction(eventId).then((result) => setConnections(result.success ? result.data.connections : []));
  }, [eventId]);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "not-found") return <ErrorState message="This event could not be found." />;
  if (state.status === "error") return <ErrorState message="Could not load this event." onRetry={fetchEvent} />;

  const { event } = state;
  const { preparation, preparationTone, execution, executionTone } = derivePreparationExecution(event.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-text">{event.title}</h1>
        <EventStatusBadge status={event.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs text-text-muted">Preparation Status</p>
          <Badge tone={preparationTone} className="mt-1">
            {preparation}
          </Badge>
        </Card>
        <Card>
          <p className="text-xs text-text-muted">Execution Status</p>
          <Badge tone={executionTone} className="mt-1">
            {execution}
          </Badge>
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Your Reservation</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Type" value={EVENT_TYPE_LABELS[event.event_type]} />
          <Field label="Date" value={event.event_date ? new Date(event.event_date).toLocaleDateString() : null} />
          <Field label="Time" value={event.start_time ? `${event.start_time}${event.end_time ? ` – ${event.end_time}` : ""}` : null} />
          <Field label="Location" value={event.location_name} />
          <Field label="City / State" value={[event.city, event.state].filter(Boolean).join(", ") || null} />
          <Field label="Guest count" value={event.guest_count !== null ? String(event.guest_count) : null} />
          <Field label="Package" value={event.package_name} />
          <Field label="Theme" value={event.theme} />
        </dl>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-[15px] font-semibold text-text">Day-of Schedule</h2>
            <p className="mt-0.5 text-xs text-text-muted">Your minute-by-minute run of show will appear here closer to the date.</p>
          </div>
          <Button type="button" variant="ghost" disabled title="The day-of schedule isn't available yet.">
            View Full Schedule
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-serif text-[15px] font-semibold text-text">How Everything Connects</h2>
        <p className="mb-3 text-xs text-text-muted">Every proposal, contract, invoice, and document linked to this event.</p>
        {connections === null ? (
          <Skeleton className="h-16 w-full" />
        ) : connections.length === 0 ? (
          <p className="text-sm text-text-muted">No connections yet.</p>
        ) : (
          <ul className="space-y-2">
            {connections.map((connection) => (
              <li key={`${connection.nodeType}:${connection.nodeId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  <Link href={connection.href} className="truncate text-sm font-medium text-text hover:underline">
                    {connection.label}
                  </Link>
                  <p className="text-xs capitalize text-text-muted">{connection.nodeType}</p>
                </div>
                <Badge tone="neutral">{connection.relationshipLabel}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
