import { TREND_WINDOW_KEYS, TREND_WINDOW_LABELS } from "@/types/analytics";
import type { TrendWindowKey } from "@/types/analytics";
import { Select } from "@/components/ui/Select";

/** Step 5's own Trend window control — Today/7 Days/30 Days/90 Days/Year, a real `<select>` so it's keyboard- and screen-reader-native without any custom ARIA. */
export function TrendWindowPicker({ value, onChange }: { value: TrendWindowKey; onChange: (next: TrendWindowKey) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="analytics-trend-window" className="text-xs font-medium text-text-muted">
        Trend window
      </label>
      <Select
        id="analytics-trend-window"
        value={value}
        onChange={(event) => onChange(event.target.value as TrendWindowKey)}
        className="bg-transparent px-2.5 py-1.5"
      >
        {TREND_WINDOW_KEYS.map((key) => (
          <option key={key} value={key}>
            {TREND_WINDOW_LABELS[key]}
          </option>
        ))}
      </Select>
    </div>
  );
}
