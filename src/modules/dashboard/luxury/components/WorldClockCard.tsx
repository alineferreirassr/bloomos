"use client";

import { useEffect, useState } from "react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { AnalogClockFace } from "@/modules/dashboard/luxury/components/AnalogClockFace";
import { DayPeriodGlyph } from "@/modules/dashboard/luxury/components/DayPeriodGlyph";
import { WORLD_CLOCK_LOCATIONS, buildWorldClockDisplays, type WorldClockDisplay } from "@/modules/dashboard/luxury/worldClock";

const REFRESH_INTERVAL_MS = 30_000;
const CLOCK_FACE_SIZE = 84;

/**
 * AF → BloomOS Clock + Weather Visual Parity Checkpoint — mechanically
 * reconstructed from AF Digital Studio OS's own `WorldClockCard`
 * (`app/(app)/app/aline/_components/world-clock.tsx`, "compact" layout).
 * AF's own city cards use the exact same background as the page body
 * (`bg-ivory`), not a separate "surface" fill — only the outer World Clock
 * panel carries a visible tint (`bg-cream/50`). BloomOS's own
 * `--luxury-background` (page canvas) is already the right, honest
 * equivalent of that "recedes into the page" surface, so city cards use it
 * directly here instead of any `surface`/`surface-tint` token — definition
 * comes from the border + soft shadow, per the reference, not a fill-color
 * gap. Radius (24px) and city/time typography sizes are pulled straight
 * from AF's own `rounded-3xl`/`text-xl`/`text-3xl` classes.
 */
function CityCard({ display }: { display: WorldClockDisplay }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-[24px] border border-luxury-border bg-luxury-background px-4 py-5 text-center shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md">
      <AnalogClockFace hour24={display.hour24} minute={display.minute} size={CLOCK_FACE_SIZE} />
      <p className="mt-3 font-luxury-display text-xl leading-tight font-semibold text-luxury-text">{display.city}</p>
      <p className="mt-0.5 flex min-h-[14px] items-center text-luxury-metadata font-medium tracking-[0.14em] text-luxury-text-muted uppercase">{display.region}</p>
      <p className="mt-2.5 font-luxury-display text-3xl leading-none font-semibold text-luxury-text">{display.timeLabel}</p>
      <p className="mt-2 text-luxury-small text-luxury-text-muted">{display.dateLabel}</p>
      <div className="mt-auto flex items-center gap-2 pt-2.5">
        <span className="flex items-center gap-1 text-luxury-status font-semibold tracking-[0.1em] text-luxury-rose uppercase">
          <DayPeriodGlyph isNight={display.isNight} />
          {display.dayPeriod}
        </span>
        {display.isHome ? (
          <span className="rounded-luxury-full bg-luxury-rose px-2 py-0.5 text-luxury-status font-semibold tracking-[0.1em] text-luxury-rose-foreground uppercase">Home</span>
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
 *
 * Outer panel uses `tone="tint"` (not the default near-white `surface`) —
 * AF's own outer World Clock container is a translucent tint *deeper* than
 * the page, specifically so it "does not visually compete with the three
 * city cards" (the Founder's own words); `surface-tint` is BloomOS's
 * closest existing equivalent to that relationship. No location-management
 * ("Manage") affordance is rendered — BloomOS has no per-user configurable
 * clock list (`WORLD_CLOCK_LOCATIONS` is a fixed constant, not data), so a
 * Manage link here would be non-functional chrome, not a real feature.
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
    <LuxuryCard tone="tint">
      <SectionHeader title="♡ World Clock" />
      {now ? (
        <div className="mt-1 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {buildWorldClockDisplays(now).map((display) => (
            <CityCard key={display.locationId} display={display} />
          ))}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5" aria-hidden="true">
          {WORLD_CLOCK_LOCATIONS.map((location) => (
            <div key={location.id} className="h-[13rem] rounded-[24px] border border-luxury-border bg-luxury-background" />
          ))}
        </div>
      )}
    </LuxuryCard>
  );
}
