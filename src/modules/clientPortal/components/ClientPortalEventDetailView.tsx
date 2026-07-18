"use client";

import { useEffect, useState } from "react";
import { getClientPortalEventById } from "@/lib/data";
import type { ClientPortalEvent } from "@/types/clientPortal";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "error" } | { status: "ready"; event: ClientPortalEvent };

export function ClientPortalEventDetailView({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchEvent = () =>
    getClientPortalEventById(eventId)
      .then((event) => setState({ status: "ready", event }))
      .catch((err) => setState({ status: err instanceof NotFoundError ? "not-found" : "error" }));

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "not-found") return <ErrorState message="This event could not be found." />;
  if (state.status === "error") return <ErrorState message="Could not load this event." onRetry={fetchEvent} />;

  const { event } = state;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-semibold text-text">{event.title}</h1>
        <EventStatusBadge status={event.status} />
      </div>

      <Card>
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
