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
import { TodaysPriorityCard } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import { TodaysTimelineCard } from "@/modules/dashboard/luxury/components/TodaysTimelineCard";
import { TodaysPulseCard } from "@/modules/dashboard/luxury/components/TodaysPulseCard";
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
 * Checkpoint 19, Step 6, then several visual-correction passes, then the
 * AF-Inspired "Today, at a Glance" Reconstruction — the Founder's personal
 * daily workspace, not a business-report landing page. "Today, at a
 * glance" now follows AF Digital Studio OS's own information architecture,
 * translated into Amoré Bloom's tokens rather than copied verbatim: World
 * Clock + Weather (unchanged, ~75/25) → Today's Priority (the single most
 * urgent open item from `data.priorities`, mirroring AF's own
 * `pickTodaysPriority` — never the full list rendered in one card anymore)
 * beside `LittleReminderCard` (unchanged, real unread-notification
 * derivation) → Upcoming Events (unchanged content, now sitting directly
 * below Priority/Reminder per the Founder's explicit ordering) → Today's
 * Timeline (today's own Events, a coarser workspace-wide equivalent of
 * Team's per-member schedule) beside Today's Pulse (Priorities/Today's
 * Events/Proposals Pending — real counts already computed elsewhere on
 * this page, reused rather than recomputed) → My Day (private Mood/Water)
 * → Revenue Overview/Recent Messages/Team Activity → AI Executive Brief.
 * The dashboard Calendar card that used to sit beside Weather remains
 * removed per an earlier Founder correction. Date/Notifications/Messages
 * live in the shell's persistent `LuxuryTopbar`.
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
          <TodaysPriorityCard priority={data.todaysPriority} viewAllHref="/events" viewAllLabel="View events" className="lg:col-span-2" />
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

        <div className="animate-fade-up stagger-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <TodaysTimelineCard items={data.todaysTimeline} className="lg:col-span-2" />
          <TodaysPulseCard metrics={data.todaysPulse} />
        </div>

        <section className="animate-fade-up stagger-6 rounded-luxury-lg border border-luxury-border bg-luxury-surface-tint p-5 shadow-luxury-sm sm:p-6">
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
