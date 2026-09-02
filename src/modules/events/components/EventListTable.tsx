import Link from "next/link";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EventPriorityBadge } from "@/modules/events/components/EventPriorityBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { EventListRow } from "@/modules/events/components/EventsListView";
import { getFullName } from "@/lib/personName";

function formatTime(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? "—";
}

/**
 * Relationships/CRM visual pass's premium editorial-data recipe, carried
 * into Events — quiet dividers, comfortable padding, strong primary
 * identity. Trimmed from the original 11 columns to 7 by folding related
 * fields into a single cell (event type lives under the title, date+time
 * combine into one column) — no field is dropped from the underlying data,
 * only from this list's visible columns.
 */
export function EventListTable({ rows }: { rows: EventListRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-luxury-sm md:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border/70">
            {["Event", "Client", "Date & time", "Location", "Status", "Checklist", "Next action"].map((heading) => (
              <th
                key={heading}
                className="px-5 py-3.5 text-[11px] font-medium tracking-wide text-text-muted uppercase whitespace-nowrap"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map(({ event, client, checklistCompleted, checklistTotal, nextAction }) => (
            <tr key={event.id} className="transition-colors duration-150 hover:bg-accent-100/25">
              <td className="px-5 py-4">
                <Link href={`/events/${event.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                  {event.title}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{EVENT_TYPE_LABELS[event.event_type]}</p>
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">{client ? getFullName(client) : "—"}</td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted">
                {formatEventDate(event.event_date)}
                {event.start_time || event.end_time ? (
                  <span className="block text-xs text-text-muted/70">{formatTime(event.start_time, event.end_time)}</span>
                ) : null}
              </td>
              <td className="px-5 py-4 text-text-muted">{event.location_name ?? event.city ?? "—"}</td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <EventStatusBadge status={event.status} />
                  <EventPriorityBadge priority={event.priority} />
                </div>
              </td>
              <td className="px-5 py-4 whitespace-nowrap text-text-muted tabular-nums">
                {checklistTotal > 0 ? `${checklistCompleted}/${checklistTotal}` : "—"}
              </td>
              <td className="px-5 py-4 text-text-muted">{nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
