"use client";

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
import { TeamEventWeatherCard } from "@/modules/dashboard/luxury/components/TeamEventWeatherCard";
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
 * Calendar + Weather to the top" hierarchy correction — the same "organize
 * my workday, don't monitor me" philosophy as Founder's Home: greeting →
 * metrics → Calendar + Weather side by side (mirrors Owner Home's own
 * Calendar+Weather row, immediately after the metrics strip — previously
 * this sat below Today's Work, effectively invisible without scrolling) →
 * Today's Work (Schedule/Tasks/Current Event) → My Day (private Mood/Water/
 * Little Reminder + the intentionally-shared Note for Aline) →
 * de-emphasized Event Progress/Team Updates/Important Notes/Reminder last.
 * The Weather card merges the live event forecast (`TeamEventWeatherCard`)
 * with the event's manually-entered contingency note (`weather_plan`, when
 * present) into one card instead of two separately-titled "weather" cards —
 * they're genuinely different data (forecast vs. operator plan), so the
 * note is kept, just not as a competing duplicate widget.
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

        <div className="animate-fade-up stagger-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LuxuryCard className="lg:col-span-2">
            <SectionHeader title="Calendar" />
            <CalendarWidget initialEvents={data.calendarWidget.initialEvents} initialAnchorIso={data.calendarWidget.initialAnchorIso} currentMemberName={data.memberName} />
          </LuxuryCard>
          {data.weather || data.eventWeather ? (
            <LuxuryCard tone="tint">
              <SectionHeader title="Weather" />
              {data.eventWeather ? (
                <TeamEventWeatherCard forecast={data.eventWeather} />
              ) : (
                <p className="text-luxury-small text-luxury-text-muted">Weather unavailable</p>
              )}
              {data.weather ? (
                <p className="mt-3 border-t border-luxury-border pt-3 text-luxury-small text-luxury-text-muted">
                  <span className="font-medium text-luxury-text">Contingency plan:</span> {data.weather.description}
                </p>
              ) : null}
            </LuxuryCard>
          ) : null}
        </div>

        <div className="animate-fade-up stagger-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LuxuryCard>
            <SectionHeader title="Today's Schedule" action={<span className="text-luxury-small text-luxury-text-muted">View full day</span>} />
            {data.schedule.length === 0 ? <EmptyState title="Nothing scheduled today" description="Today's event schedule appears here." /> : <ScheduleTimeline items={data.schedule} />}
          </LuxuryCard>

          <LuxuryCard>
            <SectionHeader title="My Tasks" action={<span className="text-luxury-small text-luxury-text-muted">View all tasks</span>} />
            {data.tasks.length === 0 ? <EmptyState title="No tasks assigned" description="Your open tasks appear here." /> : <TaskChecklist items={data.tasks} />}
          </LuxuryCard>

          <div>
            <SectionHeader title="Current Event" action={<span className="text-luxury-small text-luxury-text-muted">View details</span>} />
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
