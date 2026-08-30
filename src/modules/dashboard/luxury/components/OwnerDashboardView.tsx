"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OwnerDashboardData } from "@/modules/dashboard/luxury/getOwnerDashboardData";
import { buildTimeOfDayGreeting, resolveTimeOfDay } from "@/core/dashboard/buildWelcomeCopy";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { LuxuryDashboardShell } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { PersonalizedWelcomeHeader } from "@/modules/dashboard/luxury/components/PersonalizedWelcomeHeader";
import { DashboardDateSelector } from "@/modules/dashboard/luxury/components/DashboardDateSelector";
import { NotificationButton } from "@/modules/dashboard/luxury/components/NotificationButton";
import { MessageButton } from "@/modules/dashboard/luxury/components/MessageButton";
import { ProfileMenu } from "@/modules/dashboard/luxury/components/ProfileMenu";
import { LuxuryMetricCard } from "@/modules/dashboard/luxury/components/LuxuryMetricCard";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { EventPreviewCard } from "@/modules/dashboard/luxury/components/EventPreviewCard";
import { PriorityList } from "@/modules/dashboard/luxury/components/PriorityList";
import { RevenueTrendChart } from "@/modules/dashboard/luxury/components/RevenueTrendChart";
import { RecentMessagesCard } from "@/modules/dashboard/luxury/components/RecentMessagesCard";
import { TeamActivityCard } from "@/modules/dashboard/luxury/components/TeamActivityCard";
import { OwnerAIBriefCard } from "@/modules/dashboard/luxury/components/OwnerAIBriefCard";
import { NextEventWeatherCard } from "@/modules/dashboard/luxury/components/NextEventWeatherCard";
import { WorldClockCard } from "@/modules/dashboard/luxury/components/WorldClockCard";
import { MoodCheckInCard } from "@/modules/dashboard/luxury/components/MoodCheckInCard";
import { WaterTrackerCard } from "@/modules/dashboard/luxury/components/WaterTrackerCard";
import { LittleReminderCard } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import { LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";

interface OwnerDashboardViewProps {
  data: OwnerDashboardData;
  branding: LuxuryBranding;
  profileName: string;
  profileRoleLabel: string;
  profileAvatarUrl: string | null;
}

/**
 * Checkpoint 19, Step 6, then the App Shell + Home redesign, then the
 * Weather + AF-inspired polish pass, then the World Clock + AF-composition
 * pass, then the "remove the dashboard Calendar card + Today's Focus"
 * correction, then the "add Little Reminder beside Today's Focus"
 * correction — the Founder's personal daily workspace, not a
 * business-report landing page. Leads with "what's my day," "what needs my
 * attention," "what's next": greeting, metrics strip, "Today, at a glance"
 * (World Clock — Honolulu/Huntington Beach/Sorocaba, real IANA-timezone
 * math, no third-party API — beside Weather, ~75/25, matching the
 * Founder-approved AF Digital Studio reference density; Weather always
 * renders, with a graceful empty state, instead of silently vanishing on
 * days with no upcoming event carrying real coordinates), then, directly
 * below with nothing in between, "Today's Focus" (the existing My
 * Priorities card, relabeled and widened to ~2/3) beside `LittleReminderCard`
 * (~1/3) — the exact same shared, already-generic component Team's own
 * dashboard renders, fed here by `data.littleReminder` (the Founder's own
 * latest unread real workspace notification, same derivation as
 * `getTeamDashboardData.ts`'s own field, not a second data source). Upcoming
 * Events moves to its own full-width row directly below (no natural
 * existing 2-up partner for it once Little Reminder took its old seat — see
 * the "Little Reminder" checkpoint report for why nothing was invented to
 * fill that slot). My Day (private Mood/Water) follows. The dashboard
 * Calendar card that used to sit beside Weather has been REMOVED from this
 * composition entirely per the Founder's explicit correction — `/calendar`
 * itself, its data, and its permissions are completely untouched; this is a
 * layout-only removal.
 * Revenue Overview, Recent Messages, Team Activity, and the AI Executive
 * Brief are unchanged in content but pushed below that fold — de-emphasized,
 * never deleted. Date/Notifications/Messages moved out of this header into
 * the shell's own persistent `LuxuryTopbar` (see `LuxuryDashboardShell`'s
 * `topbarActions` prop) — `PersonalizedWelcomeHeader` now carries only the
 * greeting, matching the reference product's sparse "Good morning, {name}
 * ♡" pattern.
 */
export function OwnerDashboardView({ data, branding, profileName, profileRoleLabel, profileAvatarUrl }: OwnerDashboardViewProps) {
  const router = useRouter();

  // `data.welcome.greeting` was built server-side (Vercel/Node's own clock),
  // so its "Good {timeOfDay}," word can be wrong for the visitor's actual
  // local time. A lazy `useState` initializer can't read the browser's clock
  // during the SSR pass (no real local time there), so committing it
  // synchronously on the client's first render would diverge from the
  // server-rendered HTML and produce a hydration mismatch — same "sync
  // initial state from an external, request-independent source" exception
  // documented at ServicesCatalogPage.tsx's own readStoredViewMode() effect.
  // firstName is the real profile.full_name the server already resolved,
  // never hardcoded here.
  const [greeting, setGreeting] = useState(data.welcome.greeting);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(buildTimeOfDayGreeting(data.firstName, resolveTimeOfDay()));
  }, [data.firstName]);

  return (
    <LuxuryDashboardShell
      branding={branding}
      sidebarFooter={<ProfileMenu name={profileName} roleLabel={profileRoleLabel} avatarUrl={profileAvatarUrl} />}
      topbarActions={
        <>
          <DashboardDateSelector />
          <NotificationButton count={data.notificationCount} onClick={() => router.push("/communications")} />
          <MessageButton count={data.messageCount} onClick={() => router.push("/inbox")} />
        </>
      }
    >
      <div className="space-y-6">
        <PersonalizedWelcomeHeader copy={{ ...data.welcome, greeting }} />

        <div className="animate-fade-up stagger-1 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {data.metrics.map((metric) => (
            <LuxuryMetricCard key={metric.id} data={metric} />
          ))}
        </div>

        <div className="animate-fade-up stagger-2">
          <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-rose uppercase">Your Day</p>
          <h2 className="mt-1 font-luxury-display text-luxury-page font-semibold text-luxury-text">Today, at a glance</h2>
        </div>

        <div className="animate-fade-up stagger-2 grid grid-cols-1 items-start gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <WorldClockCard />
          </div>
          <div className="lg:col-span-1">
            <NextEventWeatherCard data={data.nextEventWeather} fallback={data.homeWeatherFallback ? { locationLabel: "Honolulu", forecast: data.homeWeatherFallback } : null} />
          </div>
        </div>

        <div className="animate-fade-up stagger-3 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <LuxuryCard className="lg:col-span-2">
            <SectionHeader title="Today's Focus" action={<span className="text-luxury-small text-luxury-text-muted">{data.priorities.length} tasks</span>} />
            {data.priorities.length === 0 ? <EmptyState title="Nothing needs your attention right now ♡" description="A little breathing room is a good thing." /> : <PriorityList items={data.priorities} />}
          </LuxuryCard>

          <LittleReminderCard reminder={data.littleReminder} />
        </div>

        <div className="animate-fade-up stagger-4">
          <LuxuryCard>
            <SectionHeader title="Upcoming Events" action={<Link href="/events" className="text-luxury-small font-medium text-luxury-rose">View all</Link>} />
            {data.upcomingEvents.length === 0 ? (
              <EmptyState title="No upcoming events" description="Booked events appear here." />
            ) : (
              <div className="space-y-1">
                {data.upcomingEvents.map((event) => (
                  <EventPreviewCard key={event.id} data={event} />
                ))}
              </div>
            )}
          </LuxuryCard>
        </div>

        <section className="animate-fade-up stagger-5 rounded-luxury-lg border border-luxury-border bg-luxury-surface-tint p-5 shadow-luxury-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div className="flex items-center gap-2">
              <LuxuryHeartIcon className="h-4.5 w-4.5 text-luxury-rose" />
              <h2 className="font-luxury-display text-luxury-section font-semibold text-luxury-text">My Day</h2>
            </div>
            <p className="text-luxury-small text-luxury-text-muted">A few things just for you.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MoodCheckInCard privacyDetail="Your mood and water tracker are personal to you and are never visible to your team." />
            <WaterTrackerCard privacyDetail="Your mood and water tracker are personal to you and are never visible to your team." />
          </div>
        </section>

        <div className="animate-fade-up stagger-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LuxuryCard className="lg:col-span-2">
            <SectionHeader title="Revenue Overview" action={<span className="text-luxury-small text-luxury-text-muted">This month</span>} />
            <p className="font-luxury-display text-luxury-display font-semibold text-luxury-text">{formatMoney(data.revenueSeries[data.revenueSeries.length - 1]?.valueMinor ?? 0, "USD")}</p>
            <div className="mt-3">
              <RevenueTrendChart points={data.revenueSeries} />
            </div>
          </LuxuryCard>

          <div className="space-y-4">
            <LuxuryCard>
              <SectionHeader title="Recent Messages" action={<Link href="/client-portal/accounts" className="text-luxury-small font-medium text-luxury-rose">View all</Link>} />
              <RecentMessagesCard items={data.recentMessages} />
            </LuxuryCard>
            <LuxuryCard>
              <SectionHeader title="Team Activity" />
              <TeamActivityCard items={data.teamActivity} />
            </LuxuryCard>
          </div>
        </div>

        <LuxuryCard className="animate-fade-up stagger-6">
          <SectionHeader title="AI Executive Brief" />
          <OwnerAIBriefCard />
        </LuxuryCard>
      </div>
    </LuxuryDashboardShell>
  );
}
