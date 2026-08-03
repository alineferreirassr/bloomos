import { TREND_WINDOW_KEYS, TREND_WINDOW_LABELS } from "@/types/analytics";
import type { TrendWindowKey } from "@/types/analytics";

/** Step 5's own Trend window control — Today/7 Days/30 Days/90 Days/Year, a real `<select>` so it's keyboard- and screen-reader-native without any custom ARIA. */
export function TrendWindowPicker({ value, onChange }: { value: TrendWindowKey; onChange: (next: TrendWindowKey) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="analytics-trend-window" className="text-xs font-medium text-text-muted">
        Trend window
      </label>
      <select
        id="analytics-trend-window"
        value={value}
        onChange={(event) => onChange(event.target.value as TrendWindowKey)}
        className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text focus-visible:border-accent focus-visible:outline-none"
      >
        {TREND_WINDOW_KEYS.map((key) => (
          <option key={key} value={key}>
            {TREND_WINDOW_LABELS[key]}
          </option>
        ))}
      </select>
    </div>
  );
}
