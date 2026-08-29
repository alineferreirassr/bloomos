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

const VIEW_LABELS: Record<CalendarView, string> = { month: "Month", week: "Week", day: "Day", agenda: "Agenda" };

/**
 * The navigation shell every calendar surface sits inside — prev/next/
 * today plus a month/week/day/agenda toggle and the current range's label,
 * styled as one coherent control bar (Advanced Calendar UX refinement
 * pass) rather than a loose row of controls.
 */
export function CalendarNavigationBar({ anchorDate, view, onViewChange, onPrevious, onNext, onToday }: CalendarNavigationBarProps) {
  const range = getRangeForView(anchorDate, view);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-md border border-border">
          <button
            type="button"
            aria-label="Previous"
            onClick={onPrevious}
            className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
          >
            <ChevronDownIcon className="h-4 w-4 rotate-90" />
          </button>
          <span className="h-5 w-px bg-border" />
          <button
            type="button"
            aria-label="Next"
            onClick={onNext}
            className="flex h-9 w-9 items-center justify-center text-text-muted transition-colors duration-150 hover:bg-text/7 hover:text-text"
          >
            <ChevronDownIcon className="h-4 w-4 -rotate-90" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors duration-150 hover:border-accent/50 hover:text-accent"
        >
          Today
        </button>
        <h2 className="font-serif text-xl font-semibold text-text">{formatRangeLabel(range.start, view)}</h2>
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
              className={`px-4 py-1.5 text-sm font-semibold transition-colors duration-150 ${
                active ? "bg-accent text-white" : "text-text-muted hover:bg-text/7 hover:text-text"
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
  if (view === "month") return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  if (view === "day") return start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (view === "agenda") return `Starting ${start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  return `Week of ${start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
}
