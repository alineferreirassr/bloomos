"use client";

import { useEffect, useState } from "react";
import { AnalogClockFace } from "@/modules/dashboard/luxury/components/AnalogClockFace";
import { DayPeriodGlyph } from "@/modules/dashboard/luxury/components/DayPeriodGlyph";
import { WORLD_CLOCK_LOCATIONS, buildWorldClockDisplays, type WorldClockDisplay } from "@/modules/dashboard/luxury/worldClock";

const REFRESH_INTERVAL_MS = 30_000;
const CLOCK_FACE_SIZE = 100;

/**
 * VISUAL-01 Revision D — the Owner Home's own spacious World Clock
 * presentation. `WorldClockCard.tsx` (still used unchanged by Team, see
 * its own doc comment) is shared, so its own padding/card sizing can't
 * change without affecting Team — same "Owner-only variant" precedent as
 * `OwnerHomeHeader`/`OwnerWeatherCard`. Reuses every piece of real logic
 * (`buildWorldClockDisplays`, `AnalogClockFace`, `DayPeriodGlyph`) — only
 * the layout/spacing/weight is different. No new clock/timezone behavior.
 */
function CityCard({ display }: { display: WorldClockDisplay }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-[28px] border border-luxury-border bg-luxury-surface px-6 py-8 text-center">
      <AnalogClockFace hour24={display.hour24} minute={display.minute} size={CLOCK_FACE_SIZE} />
      <p className="mt-4 font-luxury-display text-xl leading-tight font-semibold text-luxury-text">{display.city}</p>
      <p className="mt-1 flex min-h-[14px] items-center text-luxury-metadata font-medium tracking-[0.16em] text-luxury-text-muted uppercase">{display.region}</p>
      <p className="mt-3 font-luxury-display text-3xl leading-none font-semibold text-luxury-text">{display.timeLabel}</p>
      <p className="mt-2 text-luxury-small text-luxury-text-muted">{display.dateLabel}</p>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <span className="flex items-center gap-1 text-luxury-status font-medium tracking-[0.1em] text-luxury-text-muted uppercase">
          <DayPeriodGlyph isNight={display.isNight} />
          {display.dayPeriod}
        </span>
        {display.isHome ? (
          <span className="rounded-luxury-full border border-luxury-rose/40 px-2 py-0.5 text-luxury-status font-medium tracking-[0.1em] text-luxury-rose uppercase">Home</span>
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
    <div className="rounded-[32px] border border-luxury-border/70 bg-luxury-surface-tint p-6">
      <p className="px-1 text-luxury-metadata font-medium tracking-[0.14em] text-luxury-text-muted uppercase">♡ World Clock</p>
      {now ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {buildWorldClockDisplays(now).map((display) => (
            <CityCard key={display.locationId} display={display} />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden="true">
          {WORLD_CLOCK_LOCATIONS.map((location) => (
            <div key={location.id} className="h-[15rem] rounded-[28px] border border-luxury-border bg-luxury-surface" />
          ))}
        </div>
      )}
    </div>
  );
}
