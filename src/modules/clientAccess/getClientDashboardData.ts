"use server";

import { getCurrentClientAccountContext, getClientPortalOverview, getClientPortalChecklist, getClientPortalTimeline, getClientPortalContracts, getClientPortalThread, getEvents, getWorkspaceMembers, updateClientLastAccess, logClientPortalActivityForCurrentSession } from "@/lib/data";
import { listEventServicesByEvent } from "@/lib/data";
import { publishPortalLoginWebhookEvent } from "@/modules/clientPortal/publishPortalLoginWebhookEvent";
import { listClientPortalProposalsAction } from "@/modules/clientPortal/getClientPortalProposal";
import { getClientPortalJourneySummaryAction } from "@/modules/clientPortal/getClientPortalJourneySummary";
import { getClientPortalAnnouncementsAction } from "@/modules/clientPortal/getClientPortalAnnouncements";
import { getClientPortalCommunicationSummaryAction } from "@/modules/clientPortal/getClientPortalCommunicationSummary";
import { getSettingsManager } from "@/core/settings/manager";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import { majorToMinor } from "@/lib/money";
import { buildWelcomeCopy } from "@/core/dashboard/buildWelcomeCopy";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import type { EventHeroCardData } from "@/modules/dashboard/luxury/components/EventHeroCard";
import type { TaskChecklistItemData } from "@/modules/dashboard/luxury/components/TaskChecklist";
import type { ScheduleTimelineItemData } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import type { IncludedServiceData } from "@/modules/dashboard/luxury/components/IncludedServicesGrid";
import type { PaymentSummaryRowData } from "@/modules/dashboard/luxury/components/PaymentSummaryCard";
import type { PlannerContactData } from "@/modules/dashboard/luxury/components/PlannerContactCard";
import type { ActivityFeedItemData } from "@/modules/dashboard/luxury/components/ActivityFeedList";
import type { WelcomeCopy } from "@/core/dashboard/buildWelcomeCopy";
import { formatMoney } from "@/lib/money";

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. Please sign in again.";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Checkpoint 36, Step 1 — Portal Home's own summary strip: every field composes an already-existing, already-tested accessor (Journey/Proposal/Message/Document/Contract/Invoice/Announcement); nothing here recomputes business logic. */
export interface PortalHomeSummaryData {
  journeyStageLabel: string | null;
  journeyProgressPercentage: number | null;
  journeyNextStepLabel: string | null;
  unreadMessageCount: number;
  openProposalsCount: number;
  openContractsCount: number;
  outstandingBalanceLabel: string;
  latestDocuments: { id: string; title: string; uploadedAt: string }[];
  announcements: { id: string; title: string; body: string; publishedAt: string }[];
}

export interface ClientDashboardData {
  welcome: WelcomeCopy;
  logoUrl: string | null;
  brandName: string;
  emotionalMessage: string;
  hero: EventHeroCardData | null;
  checklist: TaskChecklistItemData[];
  checklistCompleteCount: number;
  checklistTotalCount: number;
  timeline: ScheduleTimelineItemData[];
  includedServices: IncludedServiceData[];
  paymentTotalLabel: string;
  paymentRows: PaymentSummaryRowData[];
  planner: PlannerContactData;
  portalSummary: PortalHomeSummaryData;
  recentActivity: ActivityFeedItemData[];
}

export type GetClientDashboardDataResult = { success: true; data: ClientDashboardData } | { success: false; error: string };

/**
 * Checkpoint 19, Step 9/16/17 — the Client Dashboard's own aggregator.
 * Composes only client-safe reads that already existed
 * (`getClientPortalOverview`/`Checklist`/`Timeline`/`Contracts`) plus two
 * new, individually-reviewed projections resolved *server-side* from this
 * session's own `ClientAccountContext` — Planner Contact and What's
 * Included never call an internal, workspace-wide function (`getEvents`,
 * `getWorkspaceMembers`, `listEventServicesByEvent`) from the browser;
 * they're only ever read here, inside this Server Action, filtered down
 * to this one client's own event before anything is returned. See
 * docs/client-dashboard-experience.md's Security model section.
 *
 * Checkpoint 36, Step 1 — this is also "Portal Home": `portalSummary`
 * is purely additive and composes existing, already-tested actions
 * (`getClientPortalJourneySummaryAction`, `getClientPortalThread`,
 * `listClientPortalProposalsAction`, `getClientPortalAnnouncementsAction`,
 * plus fields `getClientPortalOverview` already computed) — no new
 * business logic, per the checkpoint's own orchestration-layer principle.
 *
 * Checkpoint 36, Step 13 — `recentActivity` reuses the exact same
 * "avatar + name/text + relative time" `ActivityFeedList` primitive the
 * Owner Dashboard's Recent Messages/Team Activity cards already share
 * (`ActivityFeedList.tsx`'s own doc comment: "one list component, two thin
 * named wrappers... never two near-duplicate implementations" — this adds
 * a third), fed from the Communication Center's own comments aggregator
 * (`getClientPortalCommunicationSummaryAction`, Step 7) rather than a new
 * feed or store.
 */
export async function getClientDashboardData(): Promise<GetClientDashboardDataResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  await updateClientLastAccess(context.account.id).catch(() => undefined);
  await logClientPortalActivityForCurrentSession("login").catch(() => undefined);
  publishPortalLoginWebhookEvent(context.account.workspace_id, context.account.id, context.account.client_id);

  const manager = getSettingsManager();
  const [overview, checklist, timeline, contracts, allEvents, teamMembers, branding, welcomeMessageValue, journeySummary, messageThread, proposalsResult, announcementsResult, communicationResult] = await Promise.all([
    getClientPortalOverview(),
    getClientPortalChecklist(),
    getClientPortalTimeline(),
    getClientPortalContracts(),
    getEvents(),
    getWorkspaceMembers(),
    getWorkspaceBranding(context.account.workspace_id),
    manager.getResolvedSettingValue(context.account.workspace_id, "branding.client-welcome-message"),
    getClientPortalJourneySummaryAction(),
    getClientPortalThread(),
    listClientPortalProposalsAction(),
    getClientPortalAnnouncementsAction(),
    getClientPortalCommunicationSummaryAction(),
  ]);
  const logoUrl = branding.logoUrl;
  const emotionalMessage = typeof welcomeMessageValue === "string" && welcomeMessageValue.trim().length > 0 ? welcomeMessageValue : "Every detail is planned with love, so you can live the moment.";

  const ownEvent = allEvents.find((event) => event.client_id === context.account.client_id && event.id === overview.upcomingEvent?.id) ?? allEvents.find((event) => event.client_id === context.account.client_id);

  const hero: EventHeroCardData | null = overview.upcomingEvent
    ? {
        title: overview.upcomingEvent.title,
        imageUrl: null,
        statusLabel: overview.upcomingEvent.status === "confirmed" ? "Confirmed" : overview.upcomingEvent.status.replace(/_/g, " "),
        statusTone: overview.upcomingEvent.status === "confirmed" ? "success" : "pending",
        details: [
          { icon: "Calendar", label: "Date", value: overview.upcomingEvent.event_date ? new Date(overview.upcomingEvent.event_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "TBD" },
          { icon: "Location", label: "Location", value: [overview.upcomingEvent.location_name, overview.upcomingEvent.city, overview.upcomingEvent.state].filter(Boolean).join(", ") || "TBD" },
          { icon: "Sparkles", label: "Theme", value: overview.upcomingEvent.theme ?? EVENT_TYPE_LABELS[overview.upcomingEvent.event_type] ?? overview.upcomingEvent.event_type },
          { icon: "Users", label: "Guests", value: overview.upcomingEvent.guest_count !== null ? `${overview.upcomingEvent.guest_count} People` : "TBD" },
        ],
      }
    : null;

  const checklistItems: TaskChecklistItemData[] = checklist.map((item) => ({ id: item.id, title: item.title, timeLabel: null, completed: item.status === "completed" }));

  const timelineItems: ScheduleTimelineItemData[] = timeline
    .slice()
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((entry) => ({ id: entry.id, timeLabel: new Date(entry.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }), title: entry.title, subtitle: entry.description, icon: entry.kind === "document_published" ? "Checklist" : "Calendar", done: true }));

  const includedServices: IncludedServiceData[] = ownEvent ? (await listEventServicesByEvent(ownEvent.id)).map((service) => ({ id: service.id, label: service.name, icon: "Checklist" })) : [];

  const relevantContract = contracts.find((contract) => contract.event_id === ownEvent?.id) ?? contracts[0] ?? null;
  const currency = overview.currency;
  const totalMinor = relevantContract?.total_value !== null && relevantContract?.total_value !== undefined ? majorToMinor(relevantContract.total_value) : 0;
  const depositMinor = relevantContract?.deposit_amount !== null && relevantContract?.deposit_amount !== undefined ? majorToMinor(relevantContract.deposit_amount) : 0;
  const remainingMinor = relevantContract?.remaining_balance !== null && relevantContract?.remaining_balance !== undefined ? majorToMinor(relevantContract.remaining_balance) : overview.totalOutstandingBalanceMinor;
  const depositPaid = totalMinor > 0 && remainingMinor < totalMinor;

  const paymentRows: PaymentSummaryRowData[] = relevantContract
    ? [
        { label: "Deposit", amountLabel: formatMoney(depositMinor, currency), statusLabel: depositPaid ? "Paid" : "Pending", statusTone: depositPaid ? "success" : "pending", helper: relevantContract.signed_at ? `Paid on ${new Date(relevantContract.signed_at).toLocaleDateString("en-US")}` : null },
        { label: "Final Payment", amountLabel: formatMoney(remainingMinor, currency), statusLabel: overview.nextPaymentDue ? "Upcoming" : "Paid", statusTone: overview.nextPaymentDue ? "pending" : "success", helper: overview.nextPaymentDue?.dueDate ? `Due on ${new Date(overview.nextPaymentDue.dueDate).toLocaleDateString("en-US")}` : null },
      ]
    : [];

  const plannerName = ownEvent?.assigned_owner ?? teamMembers.find((m) => m.role === "owner")?.full_name ?? context.workspaceName;
  const plannerMember = teamMembers.find((m) => (m.full_name ?? "").trim().toLowerCase() === plannerName.trim().toLowerCase());
  const planner: PlannerContactData = { name: plannerName, avatarUrl: plannerMember?.avatar_url ?? null, email: plannerMember?.email ?? null, phone: null };

  const portalSummary: PortalHomeSummaryData = {
    journeyStageLabel: journeySummary.success ? journeySummary.data.currentStageLabel : null,
    journeyProgressPercentage: journeySummary.success ? journeySummary.data.progressPercentage : null,
    journeyNextStepLabel: journeySummary.success ? journeySummary.data.nextStepLabel : null,
    unreadMessageCount: messageThread.unread_count,
    openProposalsCount: proposalsResult.success ? proposalsResult.data.length : 0,
    openContractsCount: overview.contractsInProgress,
    outstandingBalanceLabel: formatMoney(overview.totalOutstandingBalanceMinor, overview.currency),
    latestDocuments: overview.recentDocuments.slice(0, 5).map((doc) => ({ id: doc.id, title: doc.title, uploadedAt: doc.uploaded_at })),
    announcements: announcementsResult.success
      ? announcementsResult.data
          .slice()
          .sort((a, b) => b.publish_at.localeCompare(a.publish_at))
          .slice(0, 5)
          .map((a) => ({ id: a.id, title: a.title, body: a.body, publishedAt: a.publish_at }))
      : [],
  };

  const recentActivity: ActivityFeedItemData[] = communicationResult.success
    ? communicationResult.data.recentComments.slice(0, 5).map((comment) => ({
        id: comment.id,
        actorName: comment.author,
        actorAvatarUrl: null,
        text: `commented on ${comment.ownerLabel}: "${comment.body}"`,
        relativeTimeLabel: relativeTime(comment.createdAt),
      }))
    : [];

  return {
    success: true,
    data: {
      welcome: buildWelcomeCopy({ experience: "client", firstName: context.clientName.split(" ")[0] || context.clientName, subjectLabel: overview.upcomingEvent ? "proposal" : "event" }),
      logoUrl,
      brandName: context.workspaceName,
      emotionalMessage,
      hero,
      checklist: checklistItems,
      checklistCompleteCount: checklist.filter((i) => i.status === "completed").length,
      checklistTotalCount: checklist.length,
      timeline: timelineItems,
      includedServices,
      paymentTotalLabel: formatMoney(totalMinor, currency),
      paymentRows,
      planner,
      portalSummary,
      recentActivity,
    },
  };
}
