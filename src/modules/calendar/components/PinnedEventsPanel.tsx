"use client";

import Link from "next/link";
import { PinIcon } from "@/components/ui/icons";
import { CATEGORY_ICON, CATEGORY_TEXT_CLASS } from "@/modules/calendar/components/calendarEventVisuals";
import { formatEventTime } from "@/modules/calendar/components/calendarFormat";
import type { WorkspaceFavorite } from "@/types/smartWorkspace";
import type { CalendarEvent } from "@/types/calendarEvent";

export interface PinnedEventDisplay {
  favorite: WorkspaceFavorite;
  /** The matching CalendarEvent from whatever range is currently loaded, if any — a pure client-side join over data already in memory, never a new fetch. Only real, already-known fields render; nothing is fabricated when this is null. */
  event: CalendarEvent | null;
}

interface PinnedEventsPanelProps {
  pinned: PinnedEventDisplay[];
  onUnpin: (favoriteId: string) => void;
  isPending: boolean;
}

/**
 * Advanced Calendar phase — an operational shortcut (upcoming event,
 * critical deadline), never a social/favorites feature. Reuses the Smart
 * Workspace Platform's existing `WorkspaceFavorite` store verbatim
 * (`entity_type: "event" | "checklist_item"`) — no new persistence, no
 * migration. When the pinned item's date currently happens to be loaded
 * (its own calendar range), the real date/time renders alongside it —
 * never a fabricated one.
 */
export function PinnedEventsPanel({ pinned, onUnpin, isPending }: PinnedEventsPanelProps) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface-tint p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-100">
          <PinIcon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold tracking-wide text-text">Pinned Events</h2>
      </div>
      {pinned.length === 0 ? (
        <p className="text-xs text-text-muted">Pin an upcoming event from its calendar entry for a quick shortcut here.</p>
      ) : (
        <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
          {pinned.map(({ favorite, event }) => {
            const Icon = event ? CATEGORY_ICON[event.category] : PinIcon;
            return (
              <li key={favorite.id} className="group rounded-lg border border-border bg-surface p-2.5 transition-colors duration-150 hover:border-accent/40">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-100 ${event ? CATEGORY_TEXT_CLASS[event.category] : "text-accent"}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={favorite.href} className="block truncate text-sm font-semibold text-text hover:text-accent">
                      {favorite.label}
                    </Link>
                    {event ? <p className="mt-0.5 text-xs text-text-muted">{formatEventTime(event.start, event.allDay)}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUnpin(favorite.id)}
                    disabled={isPending}
                    className="shrink-0 text-[11px] font-medium text-text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-danger disabled:opacity-40"
                  >
                    Unpin
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
