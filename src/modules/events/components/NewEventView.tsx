"use client";

import { useRouter } from "next/navigation";
import { createEvent } from "@/lib/data";
import { PageHeader } from "@/components/ui/PageHeader";
import { EventForm } from "@/modules/events/components/EventForm";

export function NewEventView() {
  const router = useRouter();

  return (
    // GLOBAL-VISUAL-05 (Events) — same AF-ported detail/form pattern
    // already established for Leads/Clients/Contracts (real PageHeader +
    // breadcrumb, max-w-6xl content width).
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Event"
        title="New Event"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Events", href: "/events" }, { label: "New" }]}
      />
      <div className="mt-6 max-w-3xl">
        <EventForm
          submitLabel="Create Event"
          cancelHref="/events"
          onSubmit={async (input) => {
            const result = await createEvent(input);
            if (result.success) {
              router.push(`/events/${result.data.id}`);
            }
            return result;
          }}
        />
      </div>
    </div>
  );
}
