import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EventPriorityBadge } from "@/modules/events/components/EventPriorityBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { EventListRow } from "@/modules/events/components/EventsListView";

export function EventListCards({ rows }: { rows: EventListRow[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {rows.map(({ event, client, checklistCompleted, checklistTotal, nextAction }) => (
        <Link key={event.id} href={`/events/${event.id}`} className="block">
          <Card className="transition-colors duration-150 hover:border-accent/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium tracking-tight text-text">{event.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {client ? `${client.first_name} ${client.last_name}` : "No client"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <EventStatusBadge status={event.status} />
                <EventPriorityBadge priority={event.priority} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>{EVENT_TYPE_LABELS[event.event_type]}</span>
              {event.event_date ? <span>{formatEventDate(event.event_date)}</span> : null}
              {event.location_name ? <span>{event.location_name}</span> : null}
              {checklistTotal > 0 ? (
                <span>
                  Checklist {checklistCompleted}/{checklistTotal}
                </span>
              ) : null}
            </div>
            {nextAction ? <p className="mt-2 text-xs text-accent">{nextAction}</p> : null}
          </Card>
        </Link>
      ))}
    </div>
  );
}
