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
import { WeatherNoticeCard } from "@/modules/dashboard/luxury/components/WeatherNoticeCard";
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
 * Checkpoint 19, Step 7/8 — the Team Dashboard, matching the approved
 * reference image's structure: welcome header + actions, 4 summary
 * cards, Today's Schedule / My Tasks / Current Event, Event Progress,
 * Team Updates, Important Notes / Weather / Reminder. The same shell
 * renders every `TeamRoleLabel` variant (Step 8) — `data.teamRoleLabel`
 * is shown as a badge only; the underlying cards are already filtered to
 * this member's own assignments by the aggregator, so no per-role branch
 * is needed here to satisfy "same foundation, role-aware composition."
 */
export function TeamDashboardView({ data, branding, profileName, profileRoleLabel, profileAvatarUrl }: TeamDashboardViewProps) {
  const router = useRouter();

  return (
    <LuxuryDashboardShell branding={branding} sidebarFooter={<ProfileMenu name={profileName} roleLabel={`${profileRoleLabel} · ${TEAM_ROLE_LABEL_NAMES[data.teamRoleLabel]}`} avatarUrl={profileAvatarUrl} />}>
      <div className="space-y-6">
        <PersonalizedWelcomeHeader
          copy={data.welcome}
          actions={
            <>
              <DashboardDateSelector />
              <NotificationButton count={data.notificationCount} onClick={() => router.push("/checklists")} />
              <MessageButton count={data.messageCount} onClick={() => router.push("/client-portal/accounts")} />
            </>
          }
        />

        <div className="animate-fade-up stagger-1 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {data.metrics.map((metric) => (
            <LuxuryMetricCard key={metric.id} data={metric} />
          ))}
        </div>

        <div className="animate-fade-up stagger-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
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

        <div className="animate-fade-up stagger-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LuxuryCard className="lg:col-span-2">
            <SectionHeader title="Event Progress" />
            <ProgressCard percent={data.progressPercent} stages={data.progressStages} />
          </LuxuryCard>
          <LuxuryCard>
            <SectionHeader title="Team Updates" action={<span className="text-luxury-small text-luxury-text-muted">View all</span>} />
            <TeamActivityCard items={data.teamUpdates} />
          </LuxuryCard>
        </div>

        <div className="animate-fade-up stagger-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {data.importantNote ? <ImportantNotesCard note={data.importantNote} /> : null}
          {data.weather ? <WeatherNoticeCard weather={data.weather} /> : null}
          {data.reminder ? <ImportantNotesCard note={data.reminder} /> : null}
        </div>
      </div>
    </LuxuryDashboardShell>
  );
}
