"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/types/calendarEvent";
import { formatEventTime, dateKey } from "@/modules/calendar/components/calendarFormat";
import { CATEGORY_ICON, CATEGORY_LABEL, CATEGORY_BADGE_TONE, CATEGORY_TEXT_CLASS } from "@/modules/calendar/components/calendarEventVisuals";
import { DayWeatherBadge, findWeatherPoint } from "@/modules/calendar/components/DayWeatherBadge";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventsIcon, PinIcon } from "@/components/ui/icons";

interface DayTimelineProps {
  date: Date;
  events: CalendarEvent[];
  pinnedSourceKeys?: Set<string>;
  onTogglePin?: (event: CalendarEvent) => void;
  pinPending?: boolean;
  /** Renders a lighter single-row style for the Month view's day-detail slot — a compact preview, never a second copy of the full premium timeline below. */
  compact?: boolean;
}

/**
 * Advanced Calendar phase — the daily operational timeline: time, name,
 * category, and (only where the underlying Event/ChecklistItem record
 * actually carries them) assignee and status — never a fabricated field.
 * The standalone Day view renders a premium time-column + divider layout;
 * `compact` renders a lighter single-row variant so the Month view's
 * day-detail slot reads as a preview, not a duplicate of the full view.
 */
export function DayTimeline({ date, events, pinnedSourceKeys, onTogglePin, pinPending, compact = false }: DayTimelineProps) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const weatherPoint = findWeatherPoint(events);

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="Nothing scheduled"
        description={`No events, tasks, or deadlines fall on ${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.`}
        icon={EventsIcon}
      />
    );
  }

  if (compact) {
    return (
      <ol className="flex flex-col gap-1.5">
        {sorted.map((event) => {
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
            <li key={event.id} className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2 transition-colors duration-150 hover:bg-text/5">
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
      </ol>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {weatherPoint ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-tint/60 px-3 py-2">
          <DayWeatherBadge latitude={weatherPoint.latitude} longitude={weatherPoint.longitude} timezone={weatherPoint.timezone} date={dateKey(date)} size={24} />
          <span className="text-xs text-text-muted">Weather for {date.toLocaleDateString("en-US", { weekday: "long" })}</span>
        </div>
      ) : null}
      <ol className="flex flex-col">
        {sorted.map((event, index) => {
        const Icon = CATEGORY_ICON[event.category];
        const metaParts = [event.assignedName, event.statusLabel].filter(Boolean);
        const isPinned = pinnedSourceKeys?.has(`${event.sourceType}:${event.sourceId}`) ?? false;
        const isLast = index === sorted.length - 1;
        const rowContent = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100">
              <Icon className="h-4.5 w-4.5 text-accent" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-text">{event.title}</p>
                <Badge tone={CATEGORY_BADGE_TONE[event.category]}>{CATEGORY_LABEL[event.category]}</Badge>
              </div>
              {metaParts.length > 0 ? <p className="mt-0.5 text-sm text-text-muted">{metaParts.join(" · ")}</p> : null}
            </div>
          </>
        );
        return (
          <li key={event.id} className="flex gap-4">
            <div className="flex w-20 shrink-0 flex-col items-end pt-1">
              <span className="text-sm font-semibold text-text">{formatEventTime(event.start, event.allDay)}</span>
            </div>
            <div className="relative flex shrink-0 flex-col items-center">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
              {!isLast ? <span className="w-px flex-1 bg-border" /> : null}
            </div>
            <div className="flex min-w-0 flex-1 items-start gap-3 pb-5">
              {event.href ? (
                <Link href={event.href} className="flex min-w-0 flex-1 items-start gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-text/5">
                  {rowContent}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-3 p-2">{rowContent}</div>
              )}
              {onTogglePin ? (
                <button
                  type="button"
                  onClick={() => onTogglePin(event)}
                  disabled={pinPending}
                  aria-label={isPinned ? "Unpin" : "Pin"}
                  aria-pressed={isPinned}
                  className={`mt-2 shrink-0 rounded-md p-1 transition-colors duration-150 disabled:opacity-40 ${isPinned ? "text-accent" : "text-text-muted hover:text-accent"}`}
                >
                  <PinIcon className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
      </ol>
    </div>
  );
}
