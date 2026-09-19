"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OwnerDashboardData } from "@/modules/dashboard/luxury/getOwnerDashboardData";
import { buildTimeOfDayGreeting, resolveTimeOfDay, formatStudioDate, buildCalmContextualSentence } from "@/core/dashboard/buildWelcomeCopy";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { LuxuryDashboardShell } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { OwnerHomeHeader } from "@/modules/dashboard/luxury/components/OwnerHomeHeader";
import { DashboardDateSelector } from "@/modules/dashboard/luxury/components/DashboardDateSelector";
import { NotificationButton } from "@/modules/dashboard/luxury/components/NotificationButton";
import { MessageButton } from "@/modules/dashboard/luxury/components/MessageButton";
import { ProfileMenu } from "@/modules/dashboard/luxury/components/ProfileMenu";
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
import { OwnerWeatherCard } from "@/modules/dashboard/luxury/components/OwnerWeatherCard";
import { OwnerWorldClockCard } from "@/modules/dashboard/luxury/components/OwnerWorldClockCard";
import { MyDaySection } from "@/modules/dashboard/luxury/components/MyDaySection";
import { LuxuryMetricCard } from "@/modules/dashboard/luxury/components/LuxuryMetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

interface OwnerDashboardViewProps {
  data: OwnerDashboardData;
  branding: LuxuryBranding;
  profileName: string;
  profileRoleLabel: string;
  profileAvatarUrl: string | null;
  /** VISUAL-01 — the authenticated member's own real role, used only to gate the "Founder access" status item to a literal Owner, never merely anyone who reaches this Owner-experience view (Admin also does — see `resolveDashboardExperience`). */
  role: WorkspaceMemberRole;
  /** VISUAL-01 — true only when this request genuinely ran in Supabase data mode; never fabricated in mock mode. */
  isSupabaseConnected: boolean;
}

/**
 * Checkpoint 19, Step 6, then several visual-correction passes, then the
 * AF-Inspired "Today, at a Glance" Reconstruction, then the "My Day ♡
 * Position + Team Wellness" correction, then the "Dashboard Compact
 * Composition Refinement", then VISUAL-01, then GLOBAL-VISUAL-01 Round 4.3
 * (promoting the founder-approved isolated `visual-system/round4`
 * prototype into this real view) — the Founder's personal daily workspace,
 * not a business-report landing page.
 *
 * Round 4.3 order: `OwnerHomeHeader` (eyebrow date, greeting, truthful calm
 * sentence, quiet status row) → "Your Day" eyebrow → World Clock + blush
 * Weather (side-by-side from `md:`/768px up, never stacking before genuine
 * mobile — see the grid below; `.luxury-weather-blush` in globals.css for
 * the founder's soft-pink treatment, WeatherPin's own palette is founder-
 * locked, do not touch) → "Around Your Day" eyebrow over `MyDaySection`
 * (compact pill-based Mood beside a stacked Water Tracker + Little
 * Reminder — exactly one instance, never duplicated) and Today's Priority
 * beside Upcoming Events (~40/60) → "At a Glance" eyebrow + the real
 * five-metric KPI grid (`data.metrics` — revenue this month, upcoming
 * events, new leads, proposals pending, outstanding payments; fetched by
 * `getOwnerDashboardData.ts` all along, VISUAL-01 revision B only removed
 * this page's own *rendering* of it, reintroduced here per the founder's
 * explicit Round 4.3 correction "it was supposed to move lower, not
 * disappear") → Today's Timeline beside Today's Pulse → Revenue Overview/
 * Recent Messages/Team Activity → AI Executive Brief. The dashboard
 * Calendar card that used to sit beside Weather remains removed per an
 * earlier Founder correction. Date/Notifications/Messages live in the
 * shell's persistent `LuxuryTopbar`.
 */
export function OwnerDashboardView({ data, branding, profileName, profileRoleLabel, profileAvatarUrl, role, isSupabaseConnected }: OwnerDashboardViewProps) {
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
  // never hardcoded here. `studioDate` is corrected the same way, for the
  // same reason — the server's own clock can name the wrong calendar day
  // for the visitor's timezone near a day boundary.
  const [greeting, setGreeting] = useState(data.welcome.greeting);
  const [studioDate, setStudioDate] = useState(() => formatStudioDate());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(buildTimeOfDayGreeting(data.firstName, resolveTimeOfDay()));
    setStudioDate(formatStudioDate());
  }, [data.firstName]);

  const isFounder = role === "owner";
  const contextualSentence = buildCalmContextualSentence(data.priorities.length, data.notificationCount);

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
      <div className="luxury-home-light space-y-7">
        {/*
          VISUAL-01 — founder-locked top hierarchy: eyebrow date, greeting,
          truthful calm sentence, quiet status row. Replaces
          PersonalizedWelcomeHeader (still used, unchanged, by Team) with an
          Owner-only component — see OwnerHomeHeader.tsx's own doc comment
          for why this isn't a shared-component change.
        */}
        <OwnerHomeHeader studioDate={studioDate} greeting={greeting} contextualSentence={contextualSentence} isSupabaseConnected={isSupabaseConnected} isFounder={isFounder} />

        <div className="animate-fade-up stagger-1">
          <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-rose uppercase">Your Day</p>
          <h2 className="mt-1 font-luxury-display text-luxury-page font-semibold text-luxury-text">A little look at today ♡</h2>
        </div>

        {/*
          VISUAL-01 revision #2 — the founder-locked "first part of Home":
          World Clock + Weather return here, directly below the Your Day
          heading, ahead of My Day. Only the five business KPIs (moved to
          Workspace in Revision B) were ever meant to move lower —
          Clock/Weather's position is founder-locked to this spot.
          Revision D rebuilds both as Owner-only components
          (`OwnerWorldClockCard`/`OwnerWeatherCard` — see their own doc
          comments for why, given `WorldClockCard`/`NextEventWeatherCard`
          stay shared with Team).
          GLOBAL-VISUAL-01 Round 4.3 — founder correction: the prior `xl:`
          (1280px) breakpoint let Weather drop underneath World Clock as an
          oversized standalone block between 768-1280px, exactly the
          composition the founder rejected. Moved to `md:` (768px) — the
          same breakpoint the founder approved in the isolated
          `visual-system/round4` prototype — so the two stay side-by-side
          at every normal desktop/laptop width and only stack at genuine
          mobile widths. The 7/3 split and World Clock's own `auto-fit`
          inner city grid (OwnerWorldClockCard.tsx) are unchanged.
        */}
        <div className="animate-fade-up stagger-2 grid grid-cols-1 items-start gap-5 md:grid-cols-10">
          <div className="md:col-span-7">
            <OwnerWorldClockCard />
          </div>
          <div className="luxury-weather-blush md:col-span-3">
            <OwnerWeatherCard data={data.nextEventWeather} fallback={data.homeWeatherFallback ? { locationLabel: "Honolulu", forecast: data.homeWeatherFallback } : null} />
          </div>
        </div>

        {/*
          GLOBAL-VISUAL-01 Round 4.3 — "Around Your Day" eyebrow, promoted
          from the approved prototype. Purely an organizing label over the
          existing real personal-daily-context content below (MyDaySection,
          Today's Priority, Upcoming Events) — no data changed, nothing
          removed, nothing fabricated.
        */}
        <div className="animate-fade-up stagger-3">
          <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-rose uppercase">Around Your Day</p>
          <div className="mt-3">
            <MyDaySection littleReminder={data.littleReminder} privacyDetail="Your mood and water tracker are personal to you and are never visible to your team." />
          </div>
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

        {/*
          GLOBAL-VISUAL-01 Round 4.3 — "At a Glance" eyebrow + the real
          five-metric KPI grid (`data.metrics`), already computed by
          `getOwnerDashboardData.ts` (revenue this month, upcoming events,
          new leads, proposals pending, outstanding payments) but unrendered
          on Home since VISUAL-01 revision B moved its *rendering* to
          Workspace. Reintroduced here, lower on the page per the founder's
          explicit correction, using the exact same `LuxuryMetricCard` +
          grid pattern TeamDashboardView already renders its own metrics
          with — no second metrics system, no new calculation.
        */}
        <div className="animate-fade-up stagger-4">
          <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-rose uppercase">At a Glance</p>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {data.metrics.map((metric) => (
              <LuxuryMetricCard key={metric.id} data={metric} />
            ))}
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
