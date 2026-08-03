import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import type { Event } from "@/types/event";

interface ClientEventsSummaryCardProps {
  events: Event[];
}

/**
 * Read-only rollup on Client Detail — `getEvents({ clientId })` already
 * supports this filter (`EventFilters.clientId`), so this reuses the
 * existing query as-is rather than adding a new one. Closes the Client ↔
 * Event link that previously only existed in the other direction (Event
 * Detail already links back to its Client). No client-prefill on "New
 * Event" — `NewEventView`/`EventForm` don't read a `clientId` query param
 * today (same reasoning as `EventContractsSummaryCard`'s "New Contract"
 * link), so a plain link is the honest option.
 */
export function ClientEventsSummaryCard({ events }: ClientEventsSummaryCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Events</h3>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No events linked to this client.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <Link href={`/events/${event.id}`} className="min-w-0 truncate text-text hover:text-accent hover:underline">
                {event.title}
              </Link>
              <EventStatusBadge status={event.status} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/events/new">
        <Button variant="secondary" className="mt-4">
          New Event
        </Button>
      </Link>
    </Card>
  );
}
