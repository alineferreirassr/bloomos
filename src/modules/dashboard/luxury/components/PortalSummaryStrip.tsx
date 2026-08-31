import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { LuxuryMetricCard } from "@/modules/dashboard/luxury/components/LuxuryMetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LuxuryBellIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import type { PortalHomeSummaryData } from "@/modules/clientAccess/getClientDashboardData";

/**
 * Checkpoint 36, Step 1 — Portal Home's own summary strip. Every value here
 * is read from `PortalHomeSummaryData`, itself composed entirely of
 * already-existing Client Portal actions (see getClientDashboardData.ts's
 * own doc comment) — this component only renders, it never computes. Stat
 * tiles reuse `LuxuryMetricCard`, the same primitive the Owner/Team
 * Dashboards already use for their own top-row metrics, rather than a new
 * one-off tile.
 */
export function PortalSummaryStrip({ summary }: { summary: PortalHomeSummaryData }) {
  return (
    <div className="space-y-4">
      <div>
        <SectionHeader title="Portal Summary" />
        <div className="grid grid-cols-2 gap-1.5 sm:gap-3 sm:grid-cols-3">
          <LuxuryMetricCard data={{ id: "journey-stage", label: "Journey Stage", value: summary.journeyStageLabel ?? "Not started", helper: summary.journeyNextStepLabel, icon: "Checklist" }} compact />
          <LuxuryMetricCard data={{ id: "unread-messages", label: "Unread Messages", value: String(summary.unreadMessageCount), icon: "Message" }} compact />
          <LuxuryMetricCard data={{ id: "open-proposals", label: "Open Proposals", value: String(summary.openProposalsCount), icon: "Document" }} compact />
          <LuxuryMetricCard data={{ id: "open-contracts", label: "Open Contracts", value: String(summary.openContractsCount), icon: "Document" }} compact />
          <LuxuryMetricCard data={{ id: "outstanding-balance", label: "Outstanding Balance", value: summary.outstandingBalanceLabel, icon: "Payment" }} compact />
          <LuxuryMetricCard data={{ id: "latest-documents", label: "Latest Documents", value: String(summary.latestDocuments.length), icon: "Document" }} compact />
        </div>
      </div>

      <LuxuryCard>
        <SectionHeader title="Announcements" action={<LuxuryBellIcon className="h-4 w-4 text-luxury-text-muted" aria-hidden={true} />} />
        {summary.announcements.length === 0 ? (
          <EmptyState title="No announcements" description="Announcements from your planning team will appear here." />
        ) : (
          <ul role="list" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {summary.announcements.map((announcement) => (
              <li key={announcement.id} role="listitem" className="rounded-luxury-md bg-luxury-surface-tint p-3">
                <p className="text-luxury-small font-medium text-luxury-text">{announcement.title}</p>
                <p className="line-clamp-2 text-luxury-small text-luxury-text-muted">{announcement.body}</p>
              </li>
            ))}
          </ul>
        )}
      </LuxuryCard>
    </div>
  );
}
