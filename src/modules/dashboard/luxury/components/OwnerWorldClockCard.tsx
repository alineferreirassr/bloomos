"use client";

import { useEffect, useState } from "react";
import { AnalogClockFace } from "@/modules/dashboard/luxury/components/AnalogClockFace";
import { DayPeriodGlyph } from "@/modules/dashboard/luxury/components/DayPeriodGlyph";
import { WORLD_CLOCK_LOCATIONS, buildWorldClockDisplays, type WorldClockDisplay } from "@/modules/dashboard/luxury/worldClock";

const REFRESH_INTERVAL_MS = 30_000;
const CLOCK_FACE_SIZE = 60;

/**
 * VISUAL-01 Revision D — the Owner Home's own World Clock presentation.
 * `WorldClockCard.tsx` (still used unchanged by Team, see its own doc
 * comment) is shared, so its own padding/card sizing can't change without
 * affecting Team — same "Owner-only variant" precedent as
 * `OwnerHomeHeader`/`OwnerWeatherCard`. Reuses every piece of real logic
 * (`buildWorldClockDisplays`, `AnalogClockFace`, `DayPeriodGlyph`) — only
 * the layout/spacing/weight is different. No new clock/timezone behavior.
 *
 * Revision E — Revision D's `sm:grid-cols-3` on the city grid ignored how
 * much width this module actually has (it sits in ~70% of the Dashboard
 * content column, not the full viewport), so 3 cards could be forced
 * narrower than their content needed, wrapping the time and stretching
 * card height. Replaced with an `auto-fit`/`minmax` grid (see below) that
 * reflows off the container's real rendered width instead of a hardcoded
 * viewport breakpoint — the time is also `whitespace-nowrap` at a sized-
 * down (but still prominent) scale so it can never break across lines.
 *
 * GLOBAL-VISUAL-01 Round 4.3 Revision A — founder-flagged scale/density
 * correction: each city had grown into its own heavily bordered, generously
 * padded 28px-radius card (`CLOCK_FACE_SIZE` 84, `px-5 py-6`), materially
 * larger than the founder-approved `visual-system/round4/dashboard`
 * prototype's plain, unboxed columns. The auto-fit grid mechanism (kept,
 * not the thing that was wrong) now lays out lighter, borderless columns —
 * matching the prototype's density — instead of three separate boxes.
 * `AnalogClockFace` itself (the locked clock face) is untouched; only its
 * rendered `size` and the surrounding chrome shrank.
 *
 * GLOBAL-VISUAL-01 Round 4.4 addendum — founder correction: Revision A went
 * too far in removing the per-city surface entirely. The approved reference
 * nests each city in its own light card inside the outer World Clock panel
 * (outer panel → individual card → clock content), it never floats three
 * clocks directly on the outer panel's own tint. Restored at Round 4.4's
 * density (not Revision A's predecessor 28px/px-5 py-6 oversized card):
 * `bg-luxury-surface` (lighter/creamier than the outer panel's own
 * `bg-luxury-surface-tint`), a faint `/40` border, 10px radius, restrained
 * padding.
 */
function CityCard({ display }: { display: WorldClockDisplay }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-luxury-border/40 bg-luxury-surface px-3 py-3 text-center">
      <AnalogClockFace hour24={display.hour24} minute={display.minute} size={CLOCK_FACE_SIZE} />
      <p className="mt-2 font-luxury-display text-[1.0625rem] leading-tight font-semibold text-luxury-text">{display.city}</p>
      <p className="mt-0.5 flex items-center text-luxury-status font-medium tracking-[0.1em] text-luxury-text-muted uppercase">{display.region}</p>
      <p className="mt-1.5 font-luxury-display text-[1.375rem] leading-none font-semibold whitespace-nowrap text-luxury-text">{display.timeLabel}</p>
      <p className="mt-1 text-luxury-status text-luxury-text-muted">{display.dateLabel}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="flex items-center gap-1 text-luxury-status font-medium tracking-[0.1em] text-luxury-text-muted uppercase">
          <DayPeriodGlyph isNight={display.isNight} />
          {display.dayPeriod}
        </span>
        {display.isHome ? (
          <span className="rounded-luxury-full border border-luxury-rose/40 px-1.5 py-0.5 text-[0.5625rem] font-medium tracking-[0.08em] text-luxury-rose uppercase">Home</span>
        ) : display.hoursFromHome !== null ? (
          <span className="text-luxury-status font-medium tracking-[0.05em] text-luxury-text-muted">
            {display.hoursFromHome >= 0 ? "+" : ""}
            {display.hoursFromHome}h from Honolulu
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function OwnerWorldClockCard() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same hydration-safe "commit the real client-only value on mount" exception as WorldClockCard's own effect.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-[14px] border border-luxury-border/70 bg-luxury-surface-tint p-5">
      <p className="px-1 text-luxury-status font-medium tracking-[0.14em] text-luxury-text-muted uppercase">♡ World Clock</p>
      {now ? (
        <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          {buildWorldClockDisplays(now).map((display) => (
            <CityCard key={display.locationId} display={display} />
          ))}
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3" aria-hidden="true">
          {WORLD_CLOCK_LOCATIONS.map((location) => (
            <div key={location.id} className="h-[9.5rem] rounded-[10px] bg-luxury-surface" />
          ))}
        </div>
      )}
    </div>
  );
}
