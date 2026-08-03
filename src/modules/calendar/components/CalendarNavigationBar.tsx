import { ChevronDownIcon } from "@/components/ui/icons";
import { CALENDAR_VIEWS, type CalendarView } from "@/core/calendar/types";
import { getRangeForView } from "@/core/calendar/navigation";

interface CalendarNavigationBarProps {
  anchorDate: Date;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

const VIEW_LABELS: Record<CalendarView, string> = { month: "Month", week: "Week", day: "Day" };

/**
 * The navigation shell every calendar surface will sit inside — prev/next/
 * today plus a month/week/day toggle and the current range's label. Owns
 * no event data and renders no grid; a later checkpoint composes an actual
 * date grid underneath this using `core/calendar`'s registered
 * `CalendarEventSource`s, once real scheduling logic is in scope.
 */
export function CalendarNavigationBar({ anchorDate, view, onViewChange, onPrevious, onNext, onToday }: CalendarNavigationBarProps) {
  const range = getRangeForView(anchorDate, view);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous"
          onClick={onPrevious}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
        >
          <ChevronDownIcon className="h-4 w-4 rotate-90" />
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={onNext}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
        >
          <ChevronDownIcon className="h-4 w-4 -rotate-90" />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text hover:border-accent/50"
        >
          Today
        </button>
        <h2 className="font-serif text-lg font-semibold text-text">{formatRangeLabel(range.start, view)}</h2>
      </div>
      <div role="group" aria-label="Calendar view" className="inline-flex overflow-hidden rounded-md border border-border">
        {CALENDAR_VIEWS.map((option) => {
          const active = option === view;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onViewChange(option)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active ? "bg-accent/12 text-accent" : "text-text-muted hover:bg-text/7 hover:text-text"
              }`}
            >
              {VIEW_LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatRangeLabel(start: Date, view: CalendarView): string {
  if (view === "month") return start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (view === "day") return start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return `Week of ${start.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
}
