import { LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { MoodCheckInCard } from "@/modules/dashboard/luxury/components/MoodCheckInCard";
import { WaterTrackerCard } from "@/modules/dashboard/luxury/components/WaterTrackerCard";
import { LittleReminderCard, type LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import { PrivateToYouNotice } from "@/modules/dashboard/luxury/components/PrivateToYouNotice";

/**
 * "Dashboard Compact Composition Refinement" checkpoint — the single, shared
 * My Day ♡ composition for Founder (`/dashboard`) and Team (`/team`),
 * extracted so both routes carry the exact same layout/business logic
 * rather than two copies that can drift (see the earlier "/team renders a
 * separate component tree from TeamDashboardView" incident this session —
 * the same duplication risk applies here). Left column: the compact
 * pill-based `MoodCheckInCard`. Right column: `WaterTrackerCard` stacked
 * above `LittleReminderCard` — Little Reminder now lives inside My Day
 * instead of beside Today's Priority, and renders here and only here.
 * `items-start` on the outer grid deliberately lets the two columns size
 * independently — Water no longer needs to stretch to match Mood's height,
 * which was the single biggest contributor to the old bloated card.
 *
 * All three inner cards render with `compact` — trimmed card padding
 * (`LuxuryCard`'s own `padding="compact"` variant) and, on Mood/Water,
 * their own `PrivateToYouNotice` suppressed in favor of ONE shared notice
 * rendered once at the bottom of this section, rather than the same
 * sentence appearing twice. `compact` is opt-in on every card (default
 * `false`), so `TeamDashboardView.tsx`'s own unrelated, unchanged
 * rendering of these same cards is byte-for-byte unaffected.
 */
export function MyDaySection({ littleReminder, privacyDetail }: { littleReminder: LittleReminderData | null; privacyDetail?: string }) {
  const detail = privacyDetail ?? "Your mood and water tracker are not shared with Aline, managers, or other team members.";
  return (
    <section className="rounded-luxury-lg border border-luxury-border bg-luxury-surface-tint p-3 shadow-luxury-sm sm:p-4">
      <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-center gap-2">
          <LuxuryHeartIcon className="h-4.5 w-4.5 text-luxury-rose" />
          <h2 className="font-luxury-display text-luxury-section font-semibold text-luxury-text">My Day</h2>
        </div>
        <p className="text-luxury-small text-luxury-text-muted">A few things just for you.</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[3fr_2fr]">
        <MoodCheckInCard privacyDetail={privacyDetail} compact />
        <div className="flex flex-col gap-2">
          <WaterTrackerCard privacyDetail={privacyDetail} compact />
          <LittleReminderCard reminder={littleReminder} compact />
        </div>
      </div>
      <PrivateToYouNotice detail={detail} compact />
    </section>
  );
}
