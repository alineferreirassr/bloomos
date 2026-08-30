"use client";

import { useState } from "react";
import { completeClientPortalChecklistItem } from "@/lib/data";
import type { ClientDashboardData } from "@/modules/clientAccess/getClientDashboardData";
import { LuxuryClientDashboardShell } from "@/modules/dashboard/luxury/components/LuxuryClientDashboardShell";
import { PersonalizedWelcomeHeader } from "@/modules/dashboard/luxury/components/PersonalizedWelcomeHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { EventHeroCard } from "@/modules/dashboard/luxury/components/EventHeroCard";
import { TaskChecklist } from "@/modules/dashboard/luxury/components/TaskChecklist";
import { ScheduleTimeline } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import { TodaysPriorityCard } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import { TodaysTimelineCard } from "@/modules/dashboard/luxury/components/TodaysTimelineCard";
import { LittleReminderCard } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import { IncludedServicesGrid } from "@/modules/dashboard/luxury/components/IncludedServicesGrid";
import { PaymentSummaryCard } from "@/modules/dashboard/luxury/components/PaymentSummaryCard";
import { PlannerContactCard } from "@/modules/dashboard/luxury/components/PlannerContactCard";
import { LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClientPortalJourneyCard } from "@/modules/clientJourney/components/ClientPortalJourneyCard";
import { ClientPortalProposalCard } from "@/modules/proposalPlatform/components/ClientPortalProposalCard";
import { PortalSummaryStrip } from "@/modules/dashboard/luxury/components/PortalSummaryStrip";
import { ClientRecentActivityCard } from "@/modules/dashboard/luxury/components/ClientRecentActivityCard";
import { CompactClockWeatherPanel } from "@/modules/dashboard/luxury/components/CompactClockWeatherPanel";
import { DEFAULT_OPERATIONAL_LOCATION } from "@/core/dashboard/operationalLocation";
import Link from "next/link";

interface ClientDashboardViewProps {
  data: ClientDashboardData;
}

/**
 * Checkpoint 19, Step 9 — the Client Dashboard, matching the approved
 * reference image's structure: welcome header, Your Proposal hero, Planning
 * Checklist, Event Timeline, What's Included, Payments, Planner contact,
 * and the closing emotional message.
 *
 * Checkpoint 36, Step 1/18 — this is also "Portal Home," extended in place
 * (never a second dashboard) with a `PortalSummaryStrip` for the Journey
 * Stage/Unread Messages/Open Proposals/Open Contracts/Outstanding
 * Balance/Latest Documents/Announcements surfaces the spec's Step 1 names.
 *
 * Checkpoint 36, Step 13 — "Recent Activity" is the Dashboard Widgets step's
 * own reusable widget, `ClientRecentActivityCard`, sharing the exact same
 * `ActivityFeedList` primitive the Owner Dashboard's own widgets use.
 *
 * "Team + Client Compact Clock & Weather Variant" addendum — the same
 * compact single-location `CompactClockWeatherPanel` Team's page renders,
 * fixed to Amoré Bloom's shared operational location (Huntington Beach,
 * CA), never the Founder Dashboard's multi-city World Clock and never any
 * Founder-private or client-specific location.
 *
 * AF-Inspired "Today, at a Glance" Reconstruction — Today's Priority beside
 * Little Reminder, then a same-day Today's Timeline check, inserted between
 * Clock+Weather and Portal Summary. Upcoming Events and Today's Pulse are
 * intentionally absent here — out of scope and no-client-safe-equivalent,
 * respectively, per the Founder's own addenda; Client's information
 * architecture otherwise stays exactly as this checkpoint already
 * established it.
 */
export function ClientDashboardView({ data }: ClientDashboardViewProps) {
  const [checklist, setChecklist] = useState(data.checklist);
  const [completeCount, setCompleteCount] = useState(data.checklistCompleteCount);

  const toggleItem = async (id: string) => {
    const item = checklist.find((i) => i.id === id);
    if (!item || item.completed) return;
    const result = await completeClientPortalChecklistItem(id);
    if (!result.success) return;
    setChecklist((current) => current.map((i) => (i.id === id ? { ...i, completed: true } : i)));
    setCompleteCount((count) => count + 1);
  };

  return (
    <LuxuryClientDashboardShell logoUrl={data.logoUrl} brandName={data.brandName} sidebarFooter={<p className="text-luxury-small text-luxury-text-muted">Need help? Reach out anytime.</p>}>
      <div className="space-y-6">
        <PersonalizedWelcomeHeader copy={data.welcome} />

        {/* Team + Client Composition Correction — Clock + Weather moved ahead of the Portal Summary
            strip so it's part of the opening viewport instead of appearing after the (often tall,
            Announcements-including) summary strip pushes it below the fold. Portal Summary itself —
            Journey Stage, Unread Messages, Open Proposals, Open Contracts, Outstanding Balance,
            Latest Documents — keeps its own full prominence immediately after, unchanged and
            un-displaced relative to everything below it. */}
        <div className="animate-fade-up stagger-1">
          <CompactClockWeatherPanel location={DEFAULT_OPERATIONAL_LOCATION} forecast={data.operationalForecast} />
        </div>

        {/* AF-Inspired "Today, at a Glance" Reconstruction — Today's Priority (the
            real `nextRecommendedAction` signal, previously computed but never
            surfaced) beside Little Reminder (the shared component's own graceful
            fallback, no real per-client notification feed exists) and a same-day
            Timeline check. No Upcoming Events here — explicitly out of scope for
            Client per the Founder's own addendum. No Today's Pulse — no client-safe
            metric exists that wouldn't just duplicate Portal Summary below. */}
        <div className="animate-fade-up stagger-1 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <TodaysPriorityCard priority={data.todaysPriority ? { headline: data.todaysPriority } : null} className="lg:col-span-2" />
          <LittleReminderCard reminder={null} />
        </div>

        <div className="animate-fade-up stagger-1">
          <TodaysTimelineCard items={data.todaysTimeline} showFooterLinks={false} />
        </div>

        <div className="animate-fade-up stagger-1">
          <PortalSummaryStrip summary={data.portalSummary} />
        </div>

        <div className="animate-fade-up stagger-1 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionHeader title="Your Proposal" />
            {data.hero ? <EventHeroCard data={data.hero} /> : <LuxuryCard><EmptyState title="No event yet" description="Your event details will appear here once your proposal is confirmed." /></LuxuryCard>}
          </div>

          <LuxuryCard>
            <SectionHeader title="Planning Checklist" action={<span className="text-luxury-small text-luxury-text-muted">{completeCount} of {data.checklistTotalCount} completed</span>} />
            {checklist.length === 0 ? (
              <EmptyState title="No checklist items yet" description="Your planning checklist will appear here." />
            ) : (
              <TaskChecklist items={checklist.map((item) => ({ ...item, onToggle: item.completed ? undefined : () => toggleItem(item.id) }))} />
            )}
          </LuxuryCard>
        </div>

        <div className="animate-fade-up stagger-2">
          <ClientPortalJourneyCard />
        </div>

        <div className="animate-fade-up stagger-2">
          <ClientPortalProposalCard />
        </div>

        <div className="animate-fade-up stagger-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LuxuryCard>
            <SectionHeader title="Event Timeline" />
            {data.timeline.length === 0 ? <EmptyState title="No timeline entries yet" description="Milestones appear here as they happen." /> : <ScheduleTimeline items={data.timeline} />}
          </LuxuryCard>

          <LuxuryCard>
            <SectionHeader title="What's Included" />
            <IncludedServicesGrid services={data.includedServices} />
          </LuxuryCard>
        </div>

        <div className="animate-fade-up stagger-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LuxuryCard>
            <SectionHeader title="Payments" action={<span className="text-luxury-small text-luxury-text-muted">View all</span>} />
            {data.paymentRows.length === 0 ? <EmptyState title="No payments yet" description="Invoices and payments appear here." /> : <PaymentSummaryCard totalLabel={data.paymentTotalLabel} rows={data.paymentRows} />}
          </LuxuryCard>

          <LuxuryCard className="flex flex-col justify-center">
            <PlannerContactCard planner={data.planner} />
          </LuxuryCard>
        </div>

        <div className="animate-fade-up stagger-3">
          <LuxuryCard>
            <SectionHeader
              title="Recent Activity"
              action={
                <Link href="/client-access/communication" className="text-luxury-small text-luxury-text-muted hover:underline">
                  View all
                </Link>
              }
            />
            <ClientRecentActivityCard items={data.recentActivity} />
          </LuxuryCard>
        </div>

        <p className="animate-fade-up stagger-4 flex items-center justify-center gap-2 text-center font-luxury-display text-luxury-body text-luxury-rose italic">
          {data.emotionalMessage}
          <LuxuryHeartIcon className="h-4 w-4" aria-hidden="true" />
        </p>
      </div>
    </LuxuryClientDashboardShell>
  );
}
