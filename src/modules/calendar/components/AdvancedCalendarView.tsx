"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventsIcon } from "@/components/ui/icons";
import { CalendarNavigationBar } from "@/modules/calendar/components/CalendarNavigationBar";
import { MonthGrid } from "@/modules/calendar/components/MonthGrid";
import { WeekGrid } from "@/modules/calendar/components/WeekGrid";
import { DayTimeline } from "@/modules/calendar/components/DayTimeline";
import { AgendaList } from "@/modules/calendar/components/AgendaList";
import { PinnedEventsPanel, type PinnedEventDisplay } from "@/modules/calendar/components/PinnedEventsPanel";
import { DayWeatherBadge, findWeatherPoint } from "@/modules/calendar/components/DayWeatherBadge";
import { CATEGORY_LABEL } from "@/modules/calendar/components/calendarEventVisuals";
import { dateKey } from "@/modules/calendar/components/calendarFormat";
import { getRangeForView, goToNext, goToPrevious, goToToday } from "@/core/calendar/navigation";
import type { CalendarView, CalendarEventCategory } from "@/core/calendar/types";
import { getCalendarEventsAction, listPinnedCalendarEventsAction } from "@/modules/calendar/calendarActions";
import { toggleFavoriteAction, togglePinnedFavoriteAction } from "@/modules/workspace/workspaceActions";
import type { CalendarEvent } from "@/types/calendarEvent";
import type { WorkspaceFavorite } from "@/types/smartWorkspace";
import type { EntityType } from "@/core/enums/entityType";

type FilterId = "all" | CalendarEventCategory;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "event", label: CATEGORY_LABEL.event },
  { id: "task", label: CATEGORY_LABEL.task },
  { id: "deadline", label: CATEGORY_LABEL.deadline },
];

function sourceKey(event: CalendarEvent): string {
  return `${event.sourceType}:${event.sourceId}`;
}

/**
 * Advanced Calendar phase — the operational calendar for Amoré Bloom: a
 * VIEW over the real Events/Tasks domains (never a second source of
 * truth), with Month/Week/Day/Agenda switching, a small closed category
 * filter, and Pinned Events reusing the Smart Workspace Platform's
 * existing favorites store. Weather is now integrated (see
 * `core/weather/eventWeatherEngine.ts` and `core/calendar/registry.ts`'s
 * note on the `CalendarEvent.latitude/longitude/timezone` extension
 * point); Google Calendar sync remains out of scope.
 *
 * UX refinement pass: the calendar and Pinned Events render inside one
 * shared workspace shell (not two independently floating blocks) so the
 * page reads as a single operational surface, matching the founder's
 * "one coherent calendar workspace, not a small calendar floating in a
 * large empty page" direction. Purely presentational — no change to any
 * of the data fetching, sources, or persistence below this component.
 */
export function AdvancedCalendarView() {
  const [view, setView] = useState<CalendarView>("month");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [filter, setFilter] = useState<FilterId>("all");
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<WorkspaceFavorite[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const range = useMemo(() => getRangeForView(anchorDate, view), [anchorDate, view]);

  useEffect(() => {
    let cancelled = false;
    getCalendarEventsAction(range.start.toISOString(), range.end.toISOString()).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setEvents(result.data);
        setError(null);
      } else {
        setEvents([]);
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  function refreshPinned() {
    listPinnedCalendarEventsAction().then((result) => {
      if (result.success) setPinned(result.data);
    });
  }

  useEffect(refreshPinned, []);

  const pinnedSourceKeys = useMemo(() => new Set((pinned ?? []).map((favorite) => `${favorite.entity_type}:${favorite.entity_id}`)), [pinned]);

  const filteredEvents = useMemo(() => (events ?? []).filter((event) => filter === "all" || event.category === filter), [events, filter]);

  const selectedDayEvents = useMemo(() => {
    const key = dateKey(selectedDate);
    return filteredEvents.filter((event) => event.start.slice(0, 10) === key);
  }, [filteredEvents, selectedDate]);

  const selectedDayWeatherPoint = useMemo(() => findWeatherPoint(selectedDayEvents), [selectedDayEvents]);

  /** A pure display join over data already in memory — resolves each pinned favorite's real date/time whenever it happens to fall in the currently-loaded range; never a new fetch, never fabricated when unresolved. */
  const pinnedDisplay: PinnedEventDisplay[] = useMemo(() => {
    const byKey = new Map((events ?? []).map((event) => [sourceKey(event), event]));
    return (pinned ?? []).map((favorite) => ({
      favorite,
      event: byKey.get(`${favorite.entity_type}:${favorite.entity_id}`) ?? null,
    }));
  }, [pinned, events]);

  function handleTogglePin(event: CalendarEvent) {
    if (!event.href) return;
    const key = sourceKey(event);
    const alreadyPinned = pinnedSourceKeys.has(key);

    startTransition(async () => {
      const result = await toggleFavoriteAction(event.sourceType as EntityType, event.sourceId, event.title, event.href as string);
      if (!result.success) return;

      if (!alreadyPinned) {
        const created = result.data.find((favorite) => favorite.entity_type === event.sourceType && favorite.entity_id === event.sourceId);
        if (created) await togglePinnedFavoriteAction(created.id);
      }
      refreshPinned();
    });
  }

  function handleUnpin(favoriteId: string) {
    startTransition(async () => {
      await togglePinnedFavoriteAction(favoriteId);
      const favorite = (pinned ?? []).find((item) => item.id === favoriteId);
      if (favorite) await toggleFavoriteAction(favorite.entity_type, favorite.entity_id, favorite.label, favorite.href);
      refreshPinned();
    });
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Events, tasks, and deadlines across Amoré Bloom's operations."
        icon={EventsIcon}
        breadcrumb={[{ label: "Calendar" }]}
      />

      <div className="rounded-xl border border-border bg-surface-tint/60 p-3 sm:p-4">
        <div className="mb-4 rounded-lg border border-border bg-surface p-3 shadow-sm sm:p-4">
          <CalendarNavigationBar
            anchorDate={anchorDate}
            view={view}
            onViewChange={setView}
            onPrevious={() => setAnchorDate((current) => goToPrevious(current, view))}
            onNext={() => setAnchorDate((current) => goToNext(current, view))}
            onToday={() => setAnchorDate(goToToday())}
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                filter === option.id ? "border-accent bg-accent text-white" : "border-border bg-surface text-text-muted hover:border-accent/50 hover:text-text"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4">
            <EmptyState title="The Calendar isn't available" description={error} icon={EventsIcon} />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {events === null ? (
              <p className="p-6 text-sm text-text-muted">Loading the calendar…</p>
            ) : (
              <>
                {view === "month" ? <MonthGrid anchorDate={anchorDate} events={filteredEvents} selectedDate={selectedDate} onSelectDate={setSelectedDate} /> : null}
                {view === "week" ? <WeekGrid anchorDate={anchorDate} events={filteredEvents} /> : null}
                {view === "day" ? <DayTimeline date={anchorDate} events={filteredEvents} pinnedSourceKeys={pinnedSourceKeys} onTogglePin={handleTogglePin} pinPending={isPending} /> : null}
                {view === "agenda" ? <AgendaList events={filteredEvents} pinnedSourceKeys={pinnedSourceKeys} onTogglePin={handleTogglePin} pinPending={isPending} /> : null}

                {view === "month" ? (
                  <div className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
                    <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-border pb-3">
                      <div className="flex items-baseline gap-2">
                        <p className="text-xs font-semibold tracking-wider text-accent uppercase">
                          {selectedDate.toLocaleDateString("en-US", { weekday: "long" })}
                        </p>
                        <p className="font-serif text-lg font-semibold text-text">
                          {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                        </p>
                      </div>
                      {selectedDayWeatherPoint ? (
                        <DayWeatherBadge
                          latitude={selectedDayWeatherPoint.latitude}
                          longitude={selectedDayWeatherPoint.longitude}
                          timezone={selectedDayWeatherPoint.timezone}
                          date={dateKey(selectedDate)}
                          size={22}
                        />
                      ) : null}
                    </div>
                    <DayTimeline date={selectedDate} events={selectedDayEvents} pinnedSourceKeys={pinnedSourceKeys} onTogglePin={handleTogglePin} pinPending={isPending} compact />
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div>
            <PinnedEventsPanel pinned={pinnedDisplay} onUnpin={handleUnpin} isPending={isPending} />
          </div>
        </div>
      </div>
    </div>
  );
}
