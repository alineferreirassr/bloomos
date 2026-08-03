import { TREND_WINDOW_KEYS, type TrendWindowKey } from "@/types/analytics";
import { ApiError } from "@/core/api/errors";

const DEFAULT_WINDOW: TrendWindowKey = "30d";

/** Checkpoint 16, Step 8 — every Analytics API route reads `?window=` the same way, defaulting to `"30d"` to match the internal Analytics Dashboard's own default. */
export function parseTrendWindow(url: URL): TrendWindowKey {
  const raw = url.searchParams.get("window");
  if (!raw) return DEFAULT_WINDOW;
  if (!(TREND_WINDOW_KEYS as readonly string[]).includes(raw)) {
    throw new ApiError("invalid_request", `"${raw}" is not a valid ?window= value. Use one of: ${TREND_WINDOW_KEYS.join(", ")}.`);
  }
  return raw as TrendWindowKey;
}
