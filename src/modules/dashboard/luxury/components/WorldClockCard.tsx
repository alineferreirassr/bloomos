"use client";

import { useEffect, useState } from "react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { AnalogClockFace } from "@/modules/dashboard/luxury/components/AnalogClockFace";
import { WORLD_CLOCK_LOCATIONS, buildWorldClockDisplays, type WorldClockDisplay } from "@/modules/dashboard/luxury/worldClock";

const REFRESH_INTERVAL_MS = 30_000;
const CLOCK_FACE_SIZE = 116;

function CityCard({ display }: { display: WorldClockDisplay }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-luxury-lg bg-luxury-surface-tint px-4 py-5 text-center shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md">
      <AnalogClockFace hour24={display.hour24} minute={display.minute} size={CLOCK_FACE_SIZE} />
      <p className="mt-4 font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">{display.city}</p>
      <p className="text-luxury-metadata font-medium tracking-[0.1em] text-luxury-text-muted uppercase">{display.region}</p>
      <p className="mt-3 font-luxury-display text-luxury-page leading-none font-semibold text-luxury-text">{display.timeLabel}</p>
      <p className="mt-2 text-luxury-small text-luxury-text-muted">{display.dateLabel}</p>
      <p className="mt-2 text-luxury-status font-semibold tracking-[0.1em] text-luxury-rose uppercase">
        {display.dayPeriod}
        {display.isHome ? " · Home" : display.hoursFromHome !== null ? ` · ${display.hoursFromHome >= 0 ? "+" : ""}${display.hoursFromHome}h from Honolulu` : ""}
      </p>
    </div>
  );
}

/**
 * The Founder Dashboard's World Clock — Honolulu (home reference), Huntington
 * Beach, and Sorocaba, per the Founder's own three named locations. Every
 * value is computed from a real `Date` through `Intl`'s IANA timezone data
 * (`worldClock.ts`) — no third-party API, no hard-coded time string. Time
 * is client-only: the server and the visitor's browser can legitimately
 * disagree by a few hundred milliseconds, so (matching this file's own
 * greeting-hydration precedent in `OwnerDashboardView.tsx`) the card renders
 * a neutral skeleton on the server/first paint and fills in real times only
 * after mount, then re-derives them every 30s so the card stays live without
 * re-rendering every second for a dashboard glance card.
 */
export function WorldClockCard() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same hydration-safe "commit the real client-only value on mount" exception as OwnerDashboardView's own greeting effect; `now` starts null specifically so there is nothing to synchronize until this runs.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <LuxuryCard>
      <SectionHeader title="World Clock" />
      {now ? (
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {buildWorldClockDisplays(now).map((display) => (
            <CityCard key={display.locationId} display={display} />
          ))}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-hidden="true">
          {WORLD_CLOCK_LOCATIONS.map((location) => (
            <div key={location.id} className="h-[13rem] rounded-luxury-lg bg-luxury-surface-tint" />
          ))}
        </div>
      )}
    </LuxuryCard>
  );
}
