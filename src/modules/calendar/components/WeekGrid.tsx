"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/types/calendarEvent";
import { dateKey, groupEventsByDate, formatEventTime } from "@/modules/calendar/components/calendarFormat";
import { CATEGORY_ICON, CATEGORY_TEXT_CLASS } from "@/modules/calendar/components/calendarEventVisuals";

interface WeekGridProps {
  anchorDate: Date;
  events: CalendarEvent[];
}

function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/**
 * Advanced Calendar phase — seven day-columns, each a scannable chronological
 * list of that day's real entries (time, category icon, title). Deliberately
 * not an hour-by-hour absolute-positioned grid — BloomOS's own operational
 * calendar reads as a scannable list per day, not a Google Calendar clone.
 *
 * Each column has a real minimum width (never shrinks text into illegibility)
 * — the row scrolls horizontally at intermediate desktop widths rather than
 * cramming all seven days into unusable slivers, and stretches to fill the
 * available width once there's genuinely room.
 */
export function WeekGrid({ anchorDate, events }: WeekGridProps) {
  const start = startOfWeek(anchorDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return day;
  });
  const eventsByDate = groupEventsByDate(events);
  const today = dateKey(new Date());

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
      <div className="grid grid-cols-[repeat(7,minmax(168px,1fr))] divide-x divide-border">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isToday = key === today;
          return (
            <div key={key} className={`flex flex-col p-3 ${isToday ? "bg-accent-100/40" : "bg-surface"}`}>
              <p className={`mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide ${isToday ? "text-accent" : "text-text"}`}>
                {day.toLocaleDateString("en-US", { weekday: "short" })}
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${isToday ? "bg-accent text-white" : "text-text"}`}>{day.getDate()}</span>
              </p>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-text-muted">Nothing scheduled.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayEvents.map((event) => {
                    const Icon = CATEGORY_ICON[event.category];
                    const content = (
                      <span className="flex items-start gap-2">
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${CATEGORY_TEXT_CLASS[event.category]}`} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-text-muted">{formatEventTime(event.start, event.allDay)}</span>
                          <span className="block truncate text-sm font-medium text-text">{event.title}</span>
                        </span>
                      </span>
                    );
                    return (
                      <li key={event.id}>
                        {event.href ? (
                          <Link href={event.href} className="block rounded-md p-1.5 transition-colors duration-150 hover:bg-text/7">
                            {content}
                          </Link>
                        ) : (
                          <div className="p-1.5">{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
