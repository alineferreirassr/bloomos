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
import { ScheduleTimeline } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import { TaskChecklist } from "@/modules/dashboard/luxury/components/TaskChecklist";
import { EventHeroCard } from "@/modules/dashboard/luxury/components/EventHeroCard";
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
 * Checkpoint 19, Step 7/8, then the App Shell + Home redesign, then the
 * Dashboard Experience Restoration pass, then the Founder-requested "promote
 * Calendar + Weather to the top" hierarchy correction, then the "Team must
 * share the same dashboard system as Founder" pass — the same "organize my
 * workday, don't monitor me" philosophy as Founder's Home, now genuinely
 * sharing its composition rather than a parallel look-alike: greeting →
 * metrics → "Today, at a glance" (World Clock — the exact same
 * `WorldClockCard` Founder's Home renders, no Team-only fork — beside a
 * narrow right column of Weather + compact Calendar, mirroring Owner
 * Home's identical section) → Today's Work (Schedule/Tasks/Current Event)
 * → My Day (private Mood/Water/Little Reminder + the intentionally-shared
 * Note for Aline) → de-emphasized Event Progress/Team Updates/Important
 * Notes/Reminder last. Weather reuses the exact same `NextEventWeatherCard`
 * Founder's Home renders — Team's only addition is passing its
 * `contingencyNote` prop for the event's manually-entered `weather_plan`
 * text, which the shared component renders as an extra line rather than
 * Team needing its own separate weather-card implementation.
 * `data.teamRoleLabel` stays badge-only — the underlying cards are already
 * filtered to this member's own assignments by the aggregator, so no
 * per-role branch is needed here. Date/Notifications/Messages moved out of
 * this header into the shell's persistent `LuxuryTopbar`.
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
          <h2 className="mt-1 font-luxury-display text-luxury-page font-semibold text-luxury-text">Today, at a glance</h2>
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
          <LuxuryCard>
            <SectionHeader title="Today's Schedule" action={<span className="text-luxury-small text-luxury-text-muted">View full day</span>} />
            {data.schedule.length === 0 ? <EmptyState title="Nothing scheduled today" description="Today's event schedule appears here." /> : <ScheduleTimeline items={data.schedule} />}
          </LuxuryCard>

          <LuxuryCard>
            <SectionHeader title="My Tasks" action={<span className="text-luxury-small text-luxury-text-muted">View all tasks</span>} />
            {data.tasks.length === 0 ? <EmptyState title="No tasks assigned" description="Your open tasks appear here." /> : <TaskChecklist items={data.tasks} />}
          </LuxuryCard>

          <div>
            <SectionHeader title={data.currentEventIsToday ? "Current Event" : "Next Up"} action={<span className="text-luxury-small text-luxury-text-muted">View details</span>} />
            {data.currentEvent ? <EventHeroCard data={data.currentEvent} /> : <LuxuryCard><EmptyState title="No event today" description="Your next assigned event appears here." /></LuxuryCard>}
          </div>
        </div>

        <section className="animate-fade-up stagger-4 rounded-luxury-lg border border-luxury-border bg-luxury-surface-tint p-5 shadow-luxury-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div className="flex items-center gap-2">
              <LuxuryHeartIcon className="h-4.5 w-4.5 text-luxury-rose" />
              <h2 className="font-luxury-display text-luxury-section font-semibold text-luxury-text">My Day</h2>
            </div>
            <p className="text-luxury-small text-luxury-text-muted">A few things just for you.</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MoodCheckInCard />
              <WaterTrackerCard />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LittleReminderCard reminder={data.littleReminder} />
              <NoteForAlineCard />
            </div>
          </div>
        </section>

        <div className="animate-fade-up stagger-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LuxuryCard className="lg:col-span-2">
            <SectionHeader title="Event Progress" />
            <ProgressCard percent={data.progressPercent} stages={data.progressStages} />
          </LuxuryCard>
          <LuxuryCard>
            <SectionHeader title="Team Updates" action={<span className="text-luxury-small text-luxury-text-muted">View all</span>} />
            <TeamActivityCard items={data.teamUpdates} />
          </LuxuryCard>
        </div>

        {data.importantNote || data.reminder ? (
          <div className="animate-fade-up stagger-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.importantNote ? <ImportantNotesCard note={data.importantNote} /> : null}
            {data.reminder ? <ImportantNotesCard note={data.reminder} /> : null}
          </div>
        ) : null}
      </div>
    </LuxuryDashboardShell>
  );
}
