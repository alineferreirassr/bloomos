"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalEvents } from "@/lib/data";
import type { ClientPortalEvent } from "@/types/clientPortal";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; events: ClientPortalEvent[] };

export function ClientPortalEventsListView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchEvents = () =>
    getClientPortalEvents()
      .then((events) => setState({ status: "ready", events }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchEvents();
     
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">My Events</h1>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your events." onRetry={fetchEvents} />
      ) : state.events.length === 0 ? (
        <EmptyState title="No events yet" description="Your events will appear here once one is scheduled." />
      ) : (
        <div className="space-y-3">
          {state.events.map((event) => (
            <Link key={event.id} href={`/client-access/events/${event.id}`}>
              <Card className="transition-colors hover:border-accent/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-[15px] font-semibold text-text">{event.title}</h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {event.event_date ? new Date(event.event_date).toLocaleDateString() : "Date TBD"}
                      {event.location_name ? ` · ${event.location_name}` : ""}
                    </p>
                  </div>
                  <EventStatusBadge status={event.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
