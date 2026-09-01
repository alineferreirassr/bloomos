"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/types/calendarEvent";
import { groupEventsByDate, formatEventTime } from "@/modules/calendar/components/calendarFormat";
import { CATEGORY_ICON, CATEGORY_LABEL, CATEGORY_BADGE_TONE, CATEGORY_TEXT_CLASS } from "@/modules/calendar/components/calendarEventVisuals";
import { DayWeatherBadge, findWeatherPoint } from "@/modules/calendar/components/DayWeatherBadge";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventsIcon, PinIcon } from "@/components/ui/icons";

interface AgendaListProps {
  events: CalendarEvent[];
  pinnedSourceKeys?: Set<string>;
  onTogglePin?: (event: CalendarEvent) => void;
  pinPending?: boolean;
}

/**
 * Advanced Calendar phase — a clean chronological list grouped by date,
 * covering the Agenda view's rolling 14-day window. Reads well on mobile:
 * one column, no grid math, every row a real tap target.
 */
export function AgendaList({ events, pinnedSourceKeys, onTogglePin, pinPending }: AgendaListProps) {
  if (events.length === 0) {
    return <EmptyState title="No upcoming items" description="Events, tasks, and deadlines in the next two weeks appear here." icon={EventsIcon} />;
  }

  const grouped = groupEventsByDate(events);
  const sortedKeys = [...grouped.keys()].sort();

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5">
      {sortedKeys.map((key) => {
        const [year, month, day] = key.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        const items = grouped.get(key) ?? [];
        const weatherPoint = findWeatherPoint(items);
        return (
          <div key={key}>
            <div className="mb-2.5 flex items-center gap-3">
              <p className="shrink-0 text-sm font-semibold tracking-wide text-text uppercase">
                {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <span className="h-px flex-1 bg-border" />
              {weatherPoint ? <DayWeatherBadge latitude={weatherPoint.latitude} longitude={weatherPoint.longitude} timezone={weatherPoint.timezone} date={key} size={16} /> : null}
            </div>
            <ul className="flex flex-col gap-1.5">
              {items.map((event) => {
                const Icon = CATEGORY_ICON[event.category];
                const isPinned = pinnedSourceKeys?.has(`${event.sourceType}:${event.sourceId}`) ?? false;
                const rowContent = (
                  <>
                    <Icon className={`h-4 w-4 shrink-0 ${CATEGORY_TEXT_CLASS[event.category]}`} aria-hidden="true" />
                    <span className="w-20 shrink-0 text-xs font-medium text-text-muted">{formatEventTime(event.start, event.allDay)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{event.title}</span>
                    <Badge tone={CATEGORY_BADGE_TONE[event.category]}>{CATEGORY_LABEL[event.category]}</Badge>
                  </>
                );
                return (
                  <li key={event.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-tint/50 p-2.5 transition-colors duration-150 hover:bg-text/5">
                    {event.href ? (
                      <Link href={event.href} className="flex min-w-0 flex-1 items-center gap-2.5">
                        {rowContent}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">{rowContent}</div>
                    )}
                    {onTogglePin ? (
                      <button
                        type="button"
                        onClick={() => onTogglePin(event)}
                        disabled={pinPending}
                        aria-label={isPinned ? "Unpin" : "Pin"}
                        aria-pressed={isPinned}
                        className={`shrink-0 rounded-md p-1 transition-colors duration-150 disabled:opacity-40 ${isPinned ? "text-accent" : "text-text-muted hover:text-accent"}`}
                      >
                        <PinIcon className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
