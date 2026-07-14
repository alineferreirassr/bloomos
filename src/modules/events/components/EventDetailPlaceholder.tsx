"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEventById, getClientById } from "@/lib/data";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EventLifecycleBadge } from "@/modules/events/components/EventLifecycleBadge";
import { formatEventDate } from "@/modules/events/dateFormat";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; event: Event; client: Client | null };

/**
 * Temporary placeholder — the full Event Detail page (checklist, schedule,
 * notes, timeline, quick actions) is Phase 2. This exists only so a row
 * click from the Events list has somewhere real to land.
 */
export function EventDetailPlaceholder({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getEventById(eventId)
      .then(async (event) => {
        const client = await getClientById(event.client_id).catch(() => null);
        if (!cancelled) setState({ status: "ready", event, client });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (state.status === "loading") {
    return <Skeleton className="h-40 w-full max-w-2xl" />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this event." />;
  }

  const { event, client } = state;

  return (
    <div>
      <Link href="/events" className="text-sm text-accent hover:underline">
        ← Back to Events
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-3xl font-semibold text-text">{event.title}</h2>
        <div className="flex items-center gap-2">
          <EventStatusBadge status={event.status} />
          <EventLifecycleBadge stage={event.lifecycle_stage} />
        </div>
      </div>
      {client ? (
        <p className="mt-1 text-sm text-text-muted">
          {client.first_name} {client.last_name}
        </p>
      ) : null}

      <Card className="mt-6 max-w-2xl">
        <p className="font-serif text-[17px] font-semibold text-text">Event details</p>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-muted">Event date</dt>
            <dd className="text-sm text-text">{formatEventDate(event.event_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Location</dt>
            <dd className="text-sm text-text">{event.location_name ?? event.city ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <p className="mt-6 max-w-2xl text-sm text-text-muted">
        The full Event profile — checklist, day-of schedule, notes, and timeline — is coming in Phase 2.
      </p>
    </div>
  );
}
