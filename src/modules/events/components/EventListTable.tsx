import Link from "next/link";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EventLifecycleBadge } from "@/modules/events/components/EventLifecycleBadge";
import { EventPriorityBadge } from "@/modules/events/components/EventPriorityBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { EventListRow } from "@/modules/events/components/EventsListView";

function formatTime(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? "—";
}

export function EventListTable({ rows }: { rows: EventListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-md border border-border md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {[
              "Event",
              "Client",
              "Date",
              "Time",
              "Location",
              "Type",
              "Status",
              "Lifecycle stage",
              "Priority",
              "Checklist",
              "Next action",
            ].map((heading) => (
              <th
                key={heading}
                className="border-b border-border px-2.5 py-2 text-[11px] tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ event, client, checklistCompleted, checklistTotal, nextAction }) => (
            <tr key={event.id} className="hover:bg-text/4">
              <td className="border-b border-border px-2.5 py-2">
                <Link href={`/events/${event.id}`} className="font-medium text-text hover:text-accent">
                  {event.title}
                </Link>
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {client ? `${client.first_name} ${client.last_name}` : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatEventDate(event.event_date)}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {formatTime(event.start_time, event.end_time)}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">
                {event.location_name ?? event.city ?? "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {EVENT_TYPE_LABELS[event.event_type]}
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <EventStatusBadge status={event.status} />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <EventLifecycleBadge stage={event.lifecycle_stage} />
              </td>
              <td className="border-b border-border px-2.5 py-2">
                <EventPriorityBadge priority={event.priority} />
              </td>
              <td className="border-b border-border px-2.5 py-2 whitespace-nowrap text-text-muted">
                {checklistTotal > 0 ? `${checklistCompleted}/${checklistTotal}` : "—"}
              </td>
              <td className="border-b border-border px-2.5 py-2 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
