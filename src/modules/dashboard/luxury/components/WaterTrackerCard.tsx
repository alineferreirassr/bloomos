"use client";

import { useEffect, useState, useTransition } from "react";
import { Droplet, Minus, Plus } from "lucide-react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { PrivateToYouNotice } from "@/modules/dashboard/luxury/components/PrivateToYouNotice";
import { todayLocalDate } from "@/modules/dashboard/luxury/localDate";
import { DAILY_WATER_GOAL_GLASSES } from "@/types/wellness";
import { getMyWaterLogAction, addWaterGlassAction, removeWaterGlassAction } from "@/modules/dashboard/wellnessActions";

/** Same self-only, browser-local-date, Server-Action-scoped shape as `MoodCheckInCard` — see its own doc comment. */
export function WaterTrackerCard({ privacyDetail }: { privacyDetail?: string } = {}) {
  const [date] = useState(todayLocalDate);
  const [glasses, setGlasses] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getMyWaterLogAction(date).then((log) => {
      if (cancelled) return;
      setGlasses(log?.glasses ?? 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function handleAdd() {
    setGlasses((g) => g + 1);
    startTransition(async () => {
      await addWaterGlassAction(date);
    });
  }

  function handleRemove() {
    setGlasses((g) => Math.max(0, g - 1));
    startTransition(async () => {
      await removeWaterGlassAction(date);
    });
  }

  return (
    <LuxuryCard>
      <SectionHeader
        title="Water Tracker"
        action={
          <span className="text-luxury-small font-medium text-luxury-text-muted">
            {glasses} of {DAILY_WATER_GOAL_GLASSES} glasses
          </span>
        }
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleRemove}
          disabled={loading || glasses === 0}
          aria-label="Remove a glass"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-luxury-full border border-luxury-rose/30 text-luxury-rose transition-colors duration-150 hover:border-luxury-rose hover:bg-luxury-rose hover:text-luxury-rose-foreground focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-30"
        >
          <Minus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
        </button>
        <div className="flex flex-1 flex-wrap justify-center gap-2" aria-hidden="true">
          {Array.from({ length: DAILY_WATER_GOAL_GLASSES }).map((_, index) => (
            <Droplet
              key={index}
              className={`h-6 w-6 transition-all duration-200 ${index < glasses ? "fill-luxury-rose text-luxury-rose" : "fill-transparent text-luxury-beige"}`}
              strokeWidth={1.75}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={loading}
          aria-label="Add a glass"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-luxury-full border border-luxury-rose/30 text-luxury-rose transition-colors duration-150 hover:border-luxury-rose hover:bg-luxury-rose hover:text-luxury-rose-foreground focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-30"
        >
          <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
        </button>
      </div>
      <PrivateToYouNotice detail={privacyDetail ?? "Your mood and water tracker are not shared with Aline, managers, or other team members."} />
    </LuxuryCard>
  );
}
