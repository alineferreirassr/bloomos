"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEventById, updateEvent } from "@/lib/data";
import type { Event } from "@/types/event";
import { NotFoundError } from "@/core/errors";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { EventForm } from "@/modules/events/components/EventForm";
import { eventToFormInput } from "@/modules/events/mappers";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; event: Event };

/**
 * updateEvent() (lib/data/index.ts) never touches checklist_items — only
 * createEvent() applies a default template, and only on creation. So
 * editing here, including changing event_type, can never recreate or
 * replace the existing checklist; no special-casing needed in this view.
 */
export function EditEventView({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getEventById(eventId)
      .then((event) => {
        if (!cancelled) setState({ status: "ready", event });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: err instanceof NotFoundError ? "not-found" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This event could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this event." />;
  }

  return (
    // GLOBAL-VISUAL-05 (Events) — same AF-ported detail/form pattern as
    // NewEventView/EditLeadView (real PageHeader + breadcrumb, max-w-6xl).
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Event"
        title={`Edit ${state.event.title}`}
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Events", href: "/events" }, { label: state.event.title, href: `/events/${eventId}` }, { label: "Edit" }]}
      />
      <div className="mt-6 max-w-3xl">
        <EventForm
          submitLabel="Save changes"
          cancelHref={`/events/${eventId}`}
          defaultValues={eventToFormInput(state.event)}
          onSubmit={async (input) => {
            const result = await updateEvent(eventId, input);
            if (result.success) {
              router.push(`/events/${eventId}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
