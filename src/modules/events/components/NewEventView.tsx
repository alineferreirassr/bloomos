"use client";

import { useRouter } from "next/navigation";
import { createEvent } from "@/lib/data";
import { EventForm } from "@/modules/events/components/EventForm";

export function NewEventView() {
  const router = useRouter();

  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">New Event</h2>
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
