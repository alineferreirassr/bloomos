"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/types/calendarEvent";
import { dateKey, groupEventsByDate, formatEventTime } from "@/modules/calendar/components/calendarFormat";
import { CATEGORY_ICON, CATEGORY_DOT_CLASS } from "@/modules/calendar/components/calendarEventVisuals";
import { getCalendarEventsAction } from "@/modules/calendar/calendarActions";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_DOTS_PER_DAY = 3;

/** Same "assigned to me" free-text match `getTeamDashboardData.ts` already uses — reimplemented locally rather than exported cross-module, since it's a 2-line pure function and this widget has no other reason to import from that aggregator. */
function isMine(candidateName: string | null | undefined, memberName: string | undefined): boolean {
  if (!memberName) return false;
  return (candidateName ?? "").trim().toLowerCase() === memberName.trim().toLowerCase();
}

interface CalendarWidgetProps {
  /** The current calendar month's events, already fetched server-side by the dashboard aggregator (Events + Tasks sources, via the same registry `/calendar` itself uses) — this is the widget's first paint, before any client-side month navigation. */
  initialEvents: CalendarEvent[];
  /** Any ISO date inside the month `initialEvents` covers — the widget derives "today" and its starting anchor month from this, never from the browser's own clock at first paint, to stay consistent with server-rendered HTML. */
  initialAnchorIso: string;
  /**
   * When present, days in the agenda list whose `assignedName` matches this
   * (case/whitespace-insensitive) sort first and carry a small "You" tag —
   * Team's own prioritization request. Omitted entirely for the Founder
   * variant, where there's no "assigned to me" framing to begin with.
   * This never narrows which events are fetched or rendered — the Team
   * member's authorization ceiling is exactly `events.view`, identical to
   * the full `/calendar` page; this only reorders/highlights within it.
   */
  currentMemberName?: string;
  /**
   * Tighter month-grid/agenda spacing and a small rose capsule around just
   * the selected day's number (instead of a soft wash across the whole
   * cell) for the "A little look at today ♡" right column, where this widget
   * sits in a ~25% width card next to Weather rather than owning a
   * full-width row of its own. The underlying grid/data/navigation are
   * unchanged — only spacing and the selection treatment scale down.
   */
  compact?: boolean;
}

/**
 * The Founder/Team Home's compact Calendar widget — reuses the Advanced
 * Calendar's own `CalendarEventSource` registry (via the same
 * `getCalendarEventsAction` `/calendar` itself calls) rather than a second
 * data path, and the same category icon/color mapping
 * (`calendarEventVisuals.tsx`) rather than inventing widget-only colors.
 * Deliberately NOT the full Month/Week/Day/Agenda view — a small month
 * grid (day number + up to 3 category dots) plus the selected day's
 * agenda list, with a "View full calendar" link out to `/calendar` for
 * anything this widget doesn't try to do.
 */
export function CalendarWidget({ initialEvents, initialAnchorIso, currentMemberName, compact = false }: CalendarWidgetProps) {
  const initialAnchor = new Date(initialAnchorIso);
  const [anchorDate, setAnchorDate] = useState(() => new Date(initialAnchor.getFullYear(), initialAnchor.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(initialAnchor);
  const [events, setEvents] = useState(initialEvents);
  const [isPending, startTransition] = useTransition();

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const days: Date[] = Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const eventsByDate = groupEventsByDate(events);
  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);
  const selectedDayEvents = [...(eventsByDate.get(selectedKey) ?? [])].sort((a, b) => {
    const aMine = isMine(a.assignedName, currentMemberName) ? 0 : 1;
    const bMine = isMine(b.assignedName, currentMemberName) ? 0 : 1;
    return aMine - bMine;
  });

  function navigateMonth(direction: -1 | 1) {
    const nextAnchor = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
    setAnchorDate(nextAnchor);
    const rangeStart = new Date(nextAnchor.getFullYear(), nextAnchor.getMonth(), 1);
    const rangeEnd = new Date(nextAnchor.getFullYear(), nextAnchor.getMonth() + 1, 1);
    startTransition(async () => {
      const result = await getCalendarEventsAction(rangeStart.toISOString(), rangeEnd.toISOString());
      if (result.success) setEvents(result.data);
    });
  }

  return (
    <div>
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-2" : "mb-3"}`}>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => navigateMonth(-1)} aria-label="Previous month" className="flex h-7 w-7 items-center justify-center rounded-luxury-full text-luxury-text-muted transition-colors hover:bg-luxury-blush hover:text-luxury-rose">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className={`text-center text-luxury-small font-semibold text-luxury-text ${compact ? "" : "min-w-[110px]"}`}>
            {anchorDate.toLocaleDateString("en-US", { month: compact ? "short" : "long", year: "numeric" })}
          </span>
          <button type="button" onClick={() => navigateMonth(1)} aria-label="Next month" className="flex h-7 w-7 items-center justify-center rounded-luxury-full text-luxury-text-muted transition-colors hover:bg-luxury-blush hover:text-luxury-rose">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {/* In compact mode the parent card's own SectionHeader already carries an "Open" link to /calendar — a second "View full calendar" link here would be redundant. */}
        {compact ? null : (
          <Link href="/calendar" className="text-luxury-small font-medium text-luxury-rose">
            View full calendar
          </Link>
        )}
      </div>

      <div className={`grid grid-cols-7 transition-opacity ${compact ? "gap-y-0.5" : "gap-1"} ${isPending ? "opacity-60" : ""}`}>
        {WEEKDAY_LETTERS.map((letter, index) => (
          <div key={`${letter}-${index}`} className={`text-center font-semibold uppercase tracking-wide text-luxury-text-muted ${compact ? "text-[10px]" : "text-[11px]"}`}>
            {letter}
          </div>
        ))}
        {days.map((day) => {
          const key = dateKey(day);
          const dayEvents = eventsByDate.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === anchorDate.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const dots = dayEvents.slice(0, MAX_DOTS_PER_DAY);

          return (
            <button
              type="button"
              key={key}
              onClick={() => setSelectedDate(day)}
              aria-pressed={isSelected}
              aria-label={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${dayEvents.length > 0 ? `, ${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}` : ""}`}
              className={`flex flex-col items-center gap-1 rounded-luxury-md transition-colors duration-150 ${compact ? "py-0.5" : "py-1.5"} ${
                isSelected && !compact ? "bg-luxury-rose/15" : "hover:bg-luxury-blush/60"
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-luxury-full font-semibold ${compact ? "h-5 w-5 text-[11px]" : "h-6 w-6 text-luxury-small"} ${
                  isToday
                    ? "bg-luxury-rose text-luxury-rose-foreground"
                    : isSelected && compact
                      ? "bg-luxury-rose/15 text-luxury-rose ring-1 ring-luxury-rose/40"
                      : isCurrentMonth
                        ? "text-luxury-text"
                        : "text-luxury-text-muted/50"
                }`}
              >
                {day.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                {dots.map((event, index) => (
                  <span key={index} className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT_CLASS[event.category]}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`border-t border-luxury-border ${compact ? "mt-2 pt-2" : "mt-4 pt-3"}`}>
        <p className="mb-2 text-luxury-small font-semibold text-luxury-text">
          {selectedDate.toLocaleDateString("en-US", { weekday: compact ? "short" : "long", month: "short", day: "numeric" })}
        </p>
        {selectedDayEvents.length === 0 ? (
          <p className="text-luxury-small text-luxury-text-muted">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-1.5">
            {selectedDayEvents.slice(0, compact ? 3 : 5).map((event) => {
              const Icon = CATEGORY_ICON[event.category];
              const mine = isMine(event.assignedName, currentMemberName);
              return (
                <li key={event.id} className="flex items-center gap-2 text-luxury-small">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-luxury-rose" aria-hidden="true" />
                  {event.href ? (
                    <Link href={event.href} className="min-w-0 flex-1 truncate text-luxury-text hover:text-luxury-rose">
                      {event.title}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-luxury-text">{event.title}</span>
                  )}
                  {mine ? <span className="shrink-0 rounded-luxury-full bg-luxury-rose/15 px-1.5 py-0.5 text-[11px] font-medium text-luxury-rose">You</span> : null}
                  <span className="shrink-0 text-[11px] text-luxury-text-muted">{formatEventTime(event.start, event.allDay)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
