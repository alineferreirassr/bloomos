import Link from "next/link";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { EventPriorityBadge } from "@/modules/events/components/EventPriorityBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import type { EventListRow } from "@/modules/events/components/EventsListView";
import { getFullName } from "@/lib/personName";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";

function formatTime(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? "—";
}

// GLOBAL-VISUAL-05 (Events) — deep control migration: rebuilt on the
// shared Table primitive (see LeadListTable.tsx for the full rationale),
// replacing the bespoke hand-rolled <table> this carried over from the
// earlier Relationships/CRM visual pass. Same 7 columns, same data,
// same links/actions as before.
export function EventListTable({ rows }: { rows: EventListRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            {["Event", "Client", "Date & time", "Location", "Status", "Checklist", "Next action"].map((heading) => (
              <TableHeaderCell key={heading} className="whitespace-nowrap">
                {heading}
              </TableHeaderCell>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {rows.map(({ event, client, checklistCompleted, checklistTotal, nextAction }) => (
            <TableRow key={event.id}>
              <TableCell>
                <Link href={`/events/${event.id}`} className="text-[15px] font-medium text-text hover:text-accent">
                  {event.title}
                </Link>
                <p className="mt-0.5 text-xs text-text-muted">{EVENT_TYPE_LABELS[event.event_type]}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">{client ? getFullName(client) : "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-text-muted">
                {formatEventDate(event.event_date)}
                {event.start_time || event.end_time ? (
                  <span className="block text-xs text-text-muted/70">{formatTime(event.start_time, event.end_time)}</span>
                ) : null}
              </TableCell>
              <TableCell className="text-text-muted">{event.location_name ?? event.city ?? "—"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <EventStatusBadge status={event.status} />
                  <EventPriorityBadge priority={event.priority} />
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-text-muted tabular-nums">
                {checklistTotal > 0 ? `${checklistCompleted}/${checklistTotal}` : "—"}
              </TableCell>
              <TableCell className="text-text-muted">{nextAction ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
