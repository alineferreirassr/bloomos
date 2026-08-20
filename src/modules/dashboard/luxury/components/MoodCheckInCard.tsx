"use client";

import { useEffect, useState, useTransition, type ComponentType, type SVGProps } from "react";
import { Smile, Wind, Target, Moon, BatteryLow, Zap, CloudRain, MinusCircle, Check } from "lucide-react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { PrivateToYouNotice } from "@/modules/dashboard/luxury/components/PrivateToYouNotice";
import { LuxurySparklesIcon, LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { todayLocalDate } from "@/modules/dashboard/luxury/localDate";
import { MOOD_VALUES, MOOD_LABELS, type MoodValue } from "@/types/wellness";
import { getMyWellnessCheckInAction, setMyMoodAction } from "@/modules/dashboard/wellnessActions";

/** One small icon per mood so the 10 choices scan as a matrix rather than a wall of same-shaped pills. Kept local to this card — same one-off-icon precedent as `WaterTrackerCard`'s `Droplet` import — since no other card needs a "calm"/"overwhelmed" icon. */
const MOOD_ICONS: Record<MoodValue, ComponentType<SVGProps<SVGSVGElement>>> = {
  great: LuxurySparklesIcon,
  good: Smile,
  calm: Wind,
  happy: LuxuryHeartIcon,
  focused: Target,
  tired: Moon,
  low_energy: BatteryLow,
  stressed: Zap,
  overwhelmed: CloudRain,
  prefer_not_to_say: MinusCircle,
};

/**
 * A light personal check-in, not an HR evaluation — no scoring, no history
 * chart, no comparison. `date` is computed once on mount from the
 * browser's own clock (`todayLocalDate()`), then read/written entirely
 * through Server Actions scoped to the caller's own `auth.uid()`
 * (`wellnessActions.ts`) — there is no path here, and none should ever be
 * added, that lets this card read or show anyone else's mood.
 */
export function MoodCheckInCard({ privacyDetail }: { privacyDetail?: string } = {}) {
  const [date] = useState(todayLocalDate);
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getMyWellnessCheckInAction(date).then((checkIn) => {
      if (cancelled) return;
      setMood(checkIn?.mood ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function handleSelect(value: MoodValue) {
    setMood(value);
    startTransition(async () => {
      await setMyMoodAction(date, value);
    });
  }

  return (
    <LuxuryCard>
      <SectionHeader title="How are you feeling today?" />
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Select your mood">
        {MOOD_VALUES.map((value) => {
          const Icon = MOOD_ICONS[value];
          const selected = mood === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              disabled={loading}
              aria-pressed={selected}
              className={`flex min-h-11 items-center gap-2 rounded-luxury-md border px-2.5 py-2 text-left text-luxury-small font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-50 ${
                selected ? "border-luxury-rose bg-luxury-blush text-luxury-blush-foreground" : "border-luxury-border bg-luxury-surface text-luxury-text-muted hover:border-luxury-rose/40 hover:text-luxury-text"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              <span className="min-w-0 flex-1">{MOOD_LABELS[value]}</span>
              {selected ? <Check className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={2.5} /> : null}
            </button>
          );
        })}
      </div>
      <PrivateToYouNotice detail={privacyDetail ?? "Your mood and water tracker are not shared with Aline, managers, or other team members."} />
    </LuxuryCard>
  );
}
