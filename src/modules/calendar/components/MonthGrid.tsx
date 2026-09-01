"use client";

import type { CalendarEvent } from "@/types/calendarEvent";
import { dateKey, groupEventsByDate } from "@/modules/calendar/components/calendarFormat";
import { CATEGORY_ICON, CATEGORY_CHIP_CLASS } from "@/modules/calendar/components/calendarEventVisuals";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PER_DAY = 3;

interface MonthGridProps {
  anchorDate: Date;
  events: CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

/**
 * Advanced Calendar phase — the Month view's own day grid. Each cell shows
 * up to three real entries as small tinted icon+label chips (never a bare
 * colored speck) with a refined "+N more", per the phase's explicit "don't
 * overload cells, don't turn them into mini cards" instruction. Cells are
 * click targets that select a day (exposed below by the caller's Day Detail
 * panel) — event titles here are not themselves links, since a busy day's
 * three-line preview isn't the click-through surface; that's the Day Detail
 * panel and the Day/Agenda views.
 *
 * Today and Selected use two deliberately different visual mechanisms
 * (a filled accent date badge vs. a soft full-cell tint + thin border) so
 * they never both read as "the same red circle/border" — see the UX
 * refinement pass this phase went through after the first founder review.
 */
export function MonthGrid({ anchorDate, events, selectedDate, onSelectDate }: MonthGridProps) {
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const days: Date[] = Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const eventsByDate = groupEventsByDate(events);
  const today = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="grid grid-cols-7 border-b border-border bg-surface-tint">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-text uppercase">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
          const isToday = key === today;
          const isSelected = key === selectedKey;
          const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayEvents.length - visible.length;

          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelectDate(day)}
              aria-pressed={isSelected}
              aria-label={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${dayEvents.length > 0 ? `, ${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}` : ""}`}
              className={`flex min-h-[112px] flex-col items-stretch gap-1.5 border-r border-b border-border p-2 text-left transition-colors duration-150 last:border-r-0 hover:bg-text/5 sm:min-h-[136px] ${
                isCurrentMonth ? "bg-surface" : "bg-surface-tint/60"
              } ${isSelected ? "bg-accent-100/70 border-accent/40" : ""}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full text-sm font-semibold ${
                  isToday ? "bg-accent text-white" : isCurrentMonth ? "text-text" : "text-text-muted/70"
                }`}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-1">
                {visible.map((event) => {
                  const Icon = CATEGORY_ICON[event.category];
                  return (
                    <span key={event.id} className={`flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_CHIP_CLASS[event.category]}`}>
                      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{event.title}</span>
                    </span>
                  );
                })}
                {overflow > 0 ? <span className="px-1.5 text-xs font-medium text-text-muted">+{overflow} more</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
