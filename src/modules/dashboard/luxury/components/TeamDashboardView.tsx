"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TeamDashboardData } from "@/modules/dashboard/luxury/getTeamDashboardData";
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
import { TaskChecklist } from "@/modules/dashboard/luxury/components/TaskChecklist";
import { EventHeroCard } from "@/modules/dashboard/luxury/components/EventHeroCard";
import { EventPreviewCard } from "@/modules/dashboard/luxury/components/EventPreviewCard";
import { TodaysPriorityCard } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import { TodaysTimelineCard } from "@/modules/dashboard/luxury/components/TodaysTimelineCard";
import { TodaysPulseCard } from "@/modules/dashboard/luxury/components/TodaysPulseCard";
import { ProgressCard } from "@/modules/dashboard/luxury/components/ProgressCard";
import { TeamActivityCard } from "@/modules/dashboard/luxury/components/TeamActivityCard";
import { ImportantNotesCard } from "@/modules/dashboard/luxury/components/ImportantNotesCard";
import { NextEventWeatherCard } from "@/modules/dashboard/luxury/components/NextEventWeatherCard";
import { WorldClockCard } from "@/modules/dashboard/luxury/components/WorldClockCard";
import { CalendarWidget } from "@/modules/dashboard/luxury/components/CalendarWidget";
import { MoodCheckInCard } from "@/modules/dashboard/luxury/components/MoodCheckInCard";
import { WaterTrackerCard } from "@/modules/dashboard/luxury/components/WaterTrackerCard";
import { LittleReminderCard } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import { NoteForAlineCard } from "@/modules/dashboard/luxury/components/NoteForAlineCard";
import { LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { TEAM_ROLE_LABEL_NAMES } from "@/types/teamRoleLabel";

interface TeamDashboardViewProps {
  data: TeamDashboardData;
  branding: LuxuryBranding;
  profileName: string;
  profileRoleLabel: string;
  profileAvatarUrl: string | null;
}

/**
 * Checkpoint 19, Step 7/8, several visual-correction passes, then the
 * AF-Inspired "Today, at a Glance" Reconstruction — the same "organize my
 * workday, don't monitor me" philosophy as Founder's Home, genuinely
 * sharing its composition rather than a parallel look-alike: greeting →
 * metrics → "A little look at today ♡" (World Clock beside Weather + compact
 * Calendar, unchanged) → Today's Priority (this member's own single
 * most-urgent open item, re-skinned from the existing `importantNote`
 * concept — never a separately-fabricated value) beside `LittleReminderCard`
 * → Upcoming Events (this member's own authorized `upcomingEvents`, already
 * computed for `currentEventSource`'s fallback, now surfaced directly below
 * Priority/Reminder per the Founder's explicit ordering) → Today's Timeline
 * (wrapping the existing `data.schedule` — the same real per-event schedule
 * "Today's Schedule" used to render standalone) beside Today's Pulse
 * (Today's Events/Tasks Today/Upcoming Tasks — real counts already computed
 * elsewhere on this page) → My Day (private Mood/Water + the
 * intentionally-shared Note for Aline) → My Tasks/Current Event (relocated,
 * preserved) → de-emphasized Event Progress/Team Updates/Reminder last.
 * The old `importantNote`-based `ImportantNotesCard` is dropped from the
 * bottom row — it's superseded by the new Today's Priority card above;
 * `data.reminder`'s own separate supply-reminder card is preserved as-is.
 * Weather reuses the exact same `NextEventWeatherCard` Founder's Home
 * renders — Team's only addition is passing its `contingencyNote` prop for
 * the event's manually-entered `weather_plan` text.
 * `data.teamRoleLabel` stays badge-only — the underlying cards are already
 * filtered to this member's own assignments by the aggregator, so no
 * per-role branch is needed here. Date/Notifications/Messages live in the
 * shell's persistent `LuxuryTopbar`.
 */
export function TeamDashboardView({ data, branding, profileName, profileRoleLabel, profileAvatarUrl }: TeamDashboardViewProps) {
  const router = useRouter();

  return (
    <LuxuryDashboardShell
      branding={branding}
      sidebarFooter={<ProfileMenu name={profileName} roleLabel={`${profileRoleLabel} · ${TEAM_ROLE_LABEL_NAMES[data.teamRoleLabel]}`} avatarUrl={profileAvatarUrl} />}
      topbarActions={
        <>
          <DashboardDateSelector />
          <NotificationButton count={data.notificationCount} onClick={() => router.push("/checklists")} />
          <MessageButton count={data.messageCount} onClick={() => router.push("/client-portal/accounts")} />
        </>
      }
    >
      <div className="space-y-6">
        <PersonalizedWelcomeHeader copy={data.welcome} />

        <div className="animate-fade-up stagger-1 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          <div className="space-y-4 lg:col-span-1">
            <NextEventWeatherCard data={data.nextEventWeather} contingencyNote={data.weather?.description} />
            <LuxuryCard>
              <SectionHeader title="Calendar" action={<Link href="/calendar" className="text-luxury-small font-medium text-luxury-rose">Open</Link>} />
              <CalendarWidget initialEvents={data.calendarWidget.initialEvents} initialAnchorIso={data.calendarWidget.initialAnchorIso} currentMemberName={data.memberName} compact />
            </LuxuryCard>
          </div>
        </div>

        <div className="animate-fade-up stagger-3 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <TodaysPriorityCard priority={data.todaysPriority} className="lg:col-span-2" />
          <LittleReminderCard reminder={data.littleReminder} />
        </div>

        <div className="animate-fade-up stagger-4">
          <LuxuryCard>
            <SectionHeader title="Upcoming Events" action={<Link href="/calendar" className="text-luxury-small font-medium text-luxury-rose">View all</Link>} />
            {data.upcomingEvents.length === 0 ? (
              <EmptyState title="No upcoming events" description="Events assigned to you appear here." />
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
          <TodaysTimelineCard items={data.schedule} className="lg:col-span-2" />
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MoodCheckInCard />
              <WaterTrackerCard />
              <NoteForAlineCard />
            </div>
          </div>
        </section>

        <div className="animate-fade-up stagger-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <LuxuryCard>
            <SectionHeader title="My Tasks" action={<span className="text-luxury-small text-luxury-text-muted">View all tasks</span>} />
            {data.tasks.length === 0 ? <EmptyState title="No tasks assigned" description="Your open tasks appear here." /> : <TaskChecklist items={data.tasks} />}
          </LuxuryCard>

          <div>
            <SectionHeader title={data.currentEventIsToday ? "Current Event" : "Next Up"} action={<span className="text-luxury-small text-luxury-text-muted">View details</span>} />
            {data.currentEvent ? <EventHeroCard data={data.currentEvent} /> : <LuxuryCard><EmptyState title="No event today" description="Your next assigned event appears here." /></LuxuryCard>}
          </div>
        </div>

        <div className="animate-fade-up stagger-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LuxuryCard className="lg:col-span-2">
            <SectionHeader title="Event Progress" />
            <ProgressCard percent={data.progressPercent} stages={data.progressStages} />
          </LuxuryCard>
          <LuxuryCard>
            <SectionHeader title="Team Updates" action={<span className="text-luxury-small text-luxury-text-muted">View all</span>} />
            <TeamActivityCard items={data.teamUpdates} />
          </LuxuryCard>
        </div>

        {data.reminder ? (
          <div className="animate-fade-up stagger-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImportantNotesCard note={data.reminder} />
          </div>
        ) : null}
      </div>
    </LuxuryDashboardShell>
  );
}
