"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OwnerDashboardData } from "@/modules/dashboard/luxury/getOwnerDashboardData";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";

interface OwnerDashboardViewProps {
  data: OwnerDashboardData;
  branding: LuxuryBranding;
  profileName: string;
  profileRoleLabel: string;
  profileAvatarUrl: string | null;
}

/** Checkpoint 19, Step 6 — the Owner Dashboard, matching the approved reference image's own structure: welcome header + actions, 5 metric cards, Upcoming Events / Calendar-this-week / Priorities, Revenue Overview + Recent Messages + Team Activity, AI Executive Brief. */
export function OwnerDashboardView({ data, branding, profileName, profileRoleLabel, profileAvatarUrl }: OwnerDashboardViewProps) {
  const router = useRouter();

  return (
    <LuxuryDashboardShell branding={branding} sidebarFooter={<ProfileMenu name={profileName} roleLabel={profileRoleLabel} avatarUrl={profileAvatarUrl} />}>
      <div className="space-y-6">
        <PersonalizedWelcomeHeader
          copy={data.welcome}
          actions={
            <>
              <DashboardDateSelector />
              <NotificationButton count={data.notificationCount} onClick={() => router.push("/communications")} />
              <MessageButton count={data.messageCount} onClick={() => router.push("/inbox")} />
            </>
          }
        />

        <div className="animate-fade-up stagger-1 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.metrics.map((metric) => (
            <LuxuryMetricCard key={metric.id} data={metric} />
          ))}
        </div>

        <div className="animate-fade-up stagger-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
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

          <LuxuryCard>
            <SectionHeader title="Calendar — This Week" action={<Link href="/events" className="text-luxury-small font-medium text-luxury-rose">View calendar</Link>} />
            <ol className="space-y-2">
              {data.weekAgenda.map((day) => (
                <li key={day.dateLabel + day.dayLabel} className="flex items-start gap-3 text-luxury-small">
                  <span className="w-10 shrink-0 text-luxury-text-muted">
                    {day.dayLabel} {day.dateLabel}
                  </span>
                  <span className="min-w-0 flex-1">
                    {day.events.length === 0 ? (
                      <span className="text-luxury-text-muted">—</span>
                    ) : (
                      day.events.map((event) => (
                        <Link key={event.id} href={event.href} className="block truncate text-luxury-text hover:text-luxury-rose">
                          {event.title}
                        </Link>
                      ))
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </LuxuryCard>

          <LuxuryCard>
            <SectionHeader title="My Priorities" action={<span className="text-luxury-small text-luxury-text-muted">{data.priorities.length} tasks</span>} />
            {data.priorities.length === 0 ? <EmptyState title="Nothing urgent" description="High-priority items appear here." /> : <PriorityList items={data.priorities} />}
          </LuxuryCard>
        </div>

        <div className="animate-fade-up stagger-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
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

        <LuxuryCard className="animate-fade-up stagger-4">
          <SectionHeader title="AI Executive Brief" />
          <OwnerAIBriefCard />
        </LuxuryCard>
      </div>
    </LuxuryDashboardShell>
  );
}
