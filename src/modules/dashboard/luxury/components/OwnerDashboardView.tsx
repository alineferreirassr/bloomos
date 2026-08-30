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
import { MyDaySection } from "@/modules/dashboard/luxury/components/MyDaySection";
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
 * AF-Inspired "Today, at a Glance" Reconstruction, then the "My Day ♡
 * Position + Team Wellness" correction, then the "Dashboard Compact
 * Composition Refinement" — the Founder's personal daily workspace, not a
 * business-report landing page. "A little look at today ♡" now follows:
 * World Clock + Weather (unchanged, ~75/25) → `MyDaySection` (the shared
 * Founder/Team My Day composition — compact pill-based Mood beside a
 * stacked Water Tracker + Little Reminder, exactly one instance, never
 * duplicated; see that component's own doc comment) → Today's Priority
 * (the single most urgent open item from `data.priorities`, mirroring
 * AF's own `pickTodaysPriority`) beside Upcoming Events (~40/60, no longer
 * a full-width row — Little Reminder moved out of this row into My Day) →
 * Today's Timeline (today's own Events, a coarser workspace-wide
 * equivalent of Team's per-member schedule) beside Today's Pulse
 * (Priorities/Today's Events/Proposals Pending — real counts already
 * computed elsewhere on this page, reused rather than recomputed) →
 * Revenue Overview/Recent Messages/Team Activity → AI Executive Brief. The
 * dashboard Calendar card that used to sit beside Weather remains removed
 * per an earlier Founder correction. Date/Notifications/Messages live in
 * the shell's persistent `LuxuryTopbar`.
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
          <h2 className="mt-1 font-luxury-display text-luxury-page font-semibold text-luxury-text">A little look at today ♡</h2>
        </div>

        <div className="animate-fade-up stagger-2 grid grid-cols-1 items-start gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <WorldClockCard />
          </div>
          <div className="lg:col-span-1">
            <NextEventWeatherCard data={data.nextEventWeather} fallback={data.homeWeatherFallback ? { locationLabel: "Honolulu", forecast: data.homeWeatherFallback } : null} />
          </div>
        </div>

        <div className="animate-fade-up stagger-3">
          <MyDaySection littleReminder={data.littleReminder} privacyDetail="Your mood and water tracker are personal to you and are never visible to your team." />
        </div>

        <div className="animate-fade-up stagger-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <TodaysPriorityCard priority={data.todaysPriority} viewAllHref="/events" viewAllLabel="View events" />
          </div>
          <div className="lg:col-span-3">
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
        </div>

        <div className="animate-fade-up stagger-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <TodaysTimelineCard items={data.todaysTimeline} className="lg:col-span-2" />
          <TodaysPulseCard metrics={data.todaysPulse} />
        </div>

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
