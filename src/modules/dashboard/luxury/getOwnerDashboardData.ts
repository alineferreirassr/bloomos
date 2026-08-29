"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getEvents, getLeads, getClients, getContracts, getInvoices, getPayments, getExpenses, getChecklistByEventId, getClientAccountById, getClientById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { listClientPortalThreadsForWorkspace, listClientPortalMessages } from "@/lib/data/clientPortal/clientPortalMessageStore";
import { computeWorkspaceFinancialSummary } from "@/modules/finance/financialSummary";
import { getCoreNotificationsService } from "@/core/notifications";
import { formatMoney } from "@/lib/money";
import { buildWelcomeCopy, resolveTimeOfDay } from "@/core/dashboard/buildWelcomeCopy";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { getEventWeather } from "@/core/weather/eventWeatherEngine";
import { formatDateOnlyLabel } from "@/modules/dashboard/luxury/localDate";
import { getCalendarEventsAction } from "@/modules/calendar/calendarActions";
import type { EventWeatherForecast } from "@/types/weather";
import type { LuxuryMetricCardData } from "@/modules/dashboard/luxury/components/LuxuryMetricCard";
import type { LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import type { EventPreviewCardData } from "@/modules/dashboard/luxury/components/EventPreviewCard";
import type { PriorityItemData } from "@/modules/dashboard/luxury/components/PriorityList";
import type { ActivityFeedItemData } from "@/modules/dashboard/luxury/components/ActivityFeedList";
import type { RevenueTrendPoint } from "@/modules/dashboard/luxury/components/RevenueTrendChart";
import type { WelcomeCopy } from "@/core/dashboard/buildWelcomeCopy";
import type { CalendarEvent } from "@/types/calendarEvent";

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. You may not have access to it.";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The Founder Dashboard's weather card data — deliberately "next event
 * with weather available" rather than "next OUTDOOR event": `Event` has
 * no indoor/outdoor field anywhere in its schema (confirmed by direct
 * audit before building this), and inferring one from the event's title
 * or type would be exactly the kind of fabrication the founder's Weather
 * instructions explicitly forbid. This is a known, reported limitation,
 * not an oversight — see the Weather integration's certification report.
 */
export interface NextEventWeather {
  eventId: string;
  title: string;
  dateLabel: string;
  timeLabel: string | null;
  forecast: EventWeatherForecast;
}

export interface OwnerDashboardData {
  welcome: WelcomeCopy;
  /** The same first name already embedded in `welcome.greeting` (real `profile.full_name`, falling back to "there" if unset — never hardcoded) — surfaced separately so the client can re-greet with the visitor's own local time of day without re-deriving name resolution. */
  firstName: string;
  metrics: LuxuryMetricCardData[];
  upcomingEvents: EventPreviewCardData[];
  /** Null when no upcoming event carries real coordinates/date, or when the forecast lookup itself fails — never a fabricated forecast. */
  nextEventWeather: NextEventWeather | null;
  weekAgenda: { dayLabel: string; dateLabel: string; events: { id: string; title: string; timeLabel: string | null; href: string }[] }[];
  /** The current month's Events/Tasks, fetched through the same `getCalendarEventsAction` the Advanced Calendar itself uses — the Home Calendar widget's first paint before any client-side month navigation. */
  calendarWidget: { initialEvents: CalendarEvent[]; initialAnchorIso: string };
  priorities: PriorityItemData[];
  revenueSeries: RevenueTrendPoint[];
  recentMessages: ActivityFeedItemData[];
  teamActivity: ActivityFeedItemData[];
  /** From the caller's own real, workspace-sent notifications — never fabricated. Same derivation as `getTeamDashboardData.ts`'s own `littleReminder`. */
  littleReminder: LittleReminderData | null;
  notificationCount: number;
  messageCount: number;
}

export type GetOwnerDashboardDataResult = { success: true; data: OwnerDashboardData } | { success: false; error: string };

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

/**
 * Checkpoint 19, Step 6/16/17 — the Owner Dashboard's own data aggregator.
 * Composes existing Finance/Events/Leads/Proposals/Client-Portal-Messaging
 * services only — every number here is real, computed from this
 * Workspace's own data, never fabricated. Returns a plain, fully
 * serializable DTO (icon names as strings, pre-formatted display strings)
 * — see docs/luxury-design-system.md's own note on the Analytics
 * checkpoint's serialization bug this deliberately avoids. Server-side
 * permission enforcement (Step 17): only `owner`/`admin` ever resolve to
 * this data; every other role's request is rejected here, not just hidden
 * client-side.
 */
export async function getOwnerDashboardData(): Promise<GetOwnerDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (resolveDashboardExperience(session.membership.role) !== "owner") return { success: false, error: GENERIC_ACCESS_ERROR };

  const serverContext = getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;

  const [events, leads, , contracts, invoices, payments, expenses, proposals] = await Promise.all([
    getEvents(undefined, serverContext),
    getLeads(undefined, serverContext),
    getClients(undefined, serverContext),
    getContracts(undefined, serverContext),
    getInvoices(undefined, serverContext),
    getPayments(undefined, serverContext),
    getExpenses(undefined, serverContext),
    getProposalsRepository().getRecentProposals(session.workspace.id, 200),
  ]);

  const now = new Date();
  const financial = computeWorkspaceFinancialSummary(contracts, invoices, payments, expenses, now);

  const activeEvents = events.filter((e) => e.archived_at === null && e.cancelled_at === null);
  const upcoming = activeEvents
    .filter((e) => e.event_date !== null && new Date(e.event_date) >= now && e.completed_at === null)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));

  const todayIso = now.toISOString().slice(0, 10);
  const newLeadsToday = leads.filter((l) => l.created_at.slice(0, 10) === todayIso).length;
  const pendingProposals = proposals.filter((p) => p.status === "draft").length;

  const outstandingInvoiceCount = invoices.filter((i) => i.status !== "voided" && i.balance_minor > 0).length;

  const metrics: LuxuryMetricCardData[] = [
    { id: "revenue", label: "Revenue This Month", value: formatMoney(financial.revenue_this_month_minor, "USD"), icon: "Revenue", href: "/finance" },
    { id: "upcoming-events", label: "Upcoming Events", value: String(upcoming.length), helper: upcoming[0]?.event_date ? `Next: ${new Date(upcoming[0].event_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : null, icon: "Calendar", href: "/events" },
    { id: "new-leads", label: "New Leads", value: String(leads.filter((l) => l.status !== "lost" && l.status !== "converted").length), helper: `${newLeadsToday} today`, icon: "Users", href: "/leads" },
    { id: "proposals-pending", label: "Proposals Pending", value: String(pendingProposals), helper: "Awaiting your review", icon: "Task", href: "/bloom-ai" },
    { id: "outstanding-payments", label: "Outstanding Payments", value: formatMoney(financial.outstanding_receivables_minor, "USD"), helper: `${outstandingInvoiceCount} invoice${outstandingInvoiceCount === 1 ? "" : "s"}`, icon: "Payment", href: "/finance" },
  ];

  const upcomingEvents: EventPreviewCardData[] = upcoming.slice(0, 4).map((event) => {
    const date = event.event_date ? new Date(event.event_date) : null;
    return {
      id: event.id,
      title: event.title,
      dayLabel: date ? String(date.getDate()).padStart(2, "0") : "—",
      monthLabel: date ? MONTH_LABELS[date.getMonth()] : "",
      timeLabel: event.start_time,
      categoryLabel: EVENT_TYPE_LABELS[event.event_type] ?? event.event_type,
      imageUrl: null,
      href: `/events/${event.id}`,
    };
  });

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const weekAgenda = Array.from({ length: 7 }).map((_, offset) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + offset);
    const dayIso = day.toISOString().slice(0, 10);
    const dayEvents = activeEvents.filter((e) => e.event_date?.slice(0, 10) === dayIso);
    return {
      dayLabel: day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      dateLabel: String(day.getDate()),
      events: dayEvents.map((e) => ({ id: e.id, title: e.title, timeLabel: e.start_time, href: `/events/${e.id}` })),
    };
  });

  const checklistLists = await Promise.all(activeEvents.map((event) => getChecklistByEventId(event.id, serverContext)));
  const allChecklistItems = checklistLists.flat();
  const openPriorityItems = allChecklistItems
    .filter((item) => item.status !== "completed" && item.status !== "cancelled")
    .filter((item) => item.priority === "critical" || item.priority === "high")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 4);

  const priorities: PriorityItemData[] = openPriorityItems.map((item) => ({
    id: item.id,
    title: item.title,
    dueLabel: item.due_date ? `Due ${new Date(item.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date",
    completed: false,
    urgent: item.due_date !== null && new Date(item.due_date) <= now,
  }));

  const recentCompletions = allChecklistItems
    .filter((item) => item.completed_at !== null)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 4);
  const teamActivity: ActivityFeedItemData[] = recentCompletions.map((item) => ({
    id: item.id,
    actorName: item.assigned_name ?? "A team member",
    actorAvatarUrl: null,
    text: `completed "${item.title}"`,
    relativeTimeLabel: relativeTime(item.completed_at as string),
  }));

  const threads = listClientPortalThreadsForWorkspace(session.workspace.id).slice(0, 4);
  const recentMessages: ActivityFeedItemData[] = (
    await Promise.all(
      threads.map(async (thread): Promise<ActivityFeedItemData | null> => {
        const threadMessages = listClientPortalMessages(thread.id);
        const last = threadMessages[threadMessages.length - 1];
        if (!last) return null;
        let clientName = "A client";
        try {
          const account = await getClientAccountById(thread.client_account_id, serverContext);
          const client = await getClientById(account.client_id, serverContext);
          clientName = `${client.first_name} ${client.last_name}`.trim();
        } catch {
          // Falls back to the generic label above — never blocks the dashboard on a lookup failure.
        }
        return {
          id: thread.id,
          actorName: clientName,
          actorAvatarUrl: null,
          text: last.author_type === "client" ? `sent: "${last.body}"` : `you replied: "${last.body}"`,
          relativeTimeLabel: relativeTime(last.created_at),
          unread: last.author_type === "client",
        } satisfies ActivityFeedItemData;
      }),
    )
  ).filter((item): item is ActivityFeedItemData => item !== null);

  const revenueSeries: RevenueTrendPoint[] = Array.from({ length: 6 }).map((_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const monthInvoices = invoices.filter((invoice) => {
      if (invoice.status === "voided" || !invoice.issue_date) return false;
      const issued = new Date(invoice.issue_date);
      return issued.getFullYear() === monthDate.getFullYear() && issued.getMonth() === monthDate.getMonth();
    });
    return { label: MONTH_LABELS[monthDate.getMonth()], valueMinor: monthInvoices.reduce((sum, invoice) => sum + invoice.total_minor, 0) };
  });

  // v2 Checkpoint 24 — real unread count from the Notification Center, replacing the prior overdue-checklist proxy now that a real Notification system exists.
  const memberNotifications = await getCoreNotificationsService().getNotificationsForMember(session.workspace.id, session.membership.id);
  const notificationCount = memberNotifications.filter((n) => n.read_at === null && n.archived_at === null).length;
  const messageCount = recentMessages.filter((item) => item.unread).length;

  // "Little Reminder beside Today's Focus" addendum — the exact same derivation `getTeamDashboardData.ts` already uses (latest unread, real workspace-sent notification), reusing `memberNotifications` already fetched above rather than a second lookup. Never fabricated.
  const latestUnreadNotification = memberNotifications
    .filter((n) => n.read_at === null && n.archived_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const littleReminder: LittleReminderData | null = latestUnreadNotification ? { title: latestUnreadNotification.title, body: latestUnreadNotification.body } : null;

  const firstName = session.profile.full_name?.split(" ")[0] ?? "there";

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const calendarResult = await getCalendarEventsAction(monthStart.toISOString(), monthEnd.toISOString());
  const calendarWidget = { initialEvents: calendarResult.success ? calendarResult.data : [], initialAnchorIso: now.toISOString() };

  const weatherEligibleEvent = upcoming.find((e) => e.latitude !== null && e.longitude !== null && e.event_date !== null);
  let nextEventWeather: NextEventWeather | null = null;
  if (weatherEligibleEvent) {
    const weatherResult = await getEventWeather(weatherEligibleEvent);
    if (weatherResult.success) {
      nextEventWeather = {
        eventId: weatherEligibleEvent.id,
        title: weatherEligibleEvent.title,
        dateLabel: formatDateOnlyLabel(weatherEligibleEvent.event_date as string, { month: "short", day: "numeric" }),
        timeLabel: weatherEligibleEvent.start_time,
        forecast: weatherResult.data,
      };
    }
  }

  return {
    success: true,
    data: {
      welcome: buildWelcomeCopy({ experience: "owner", firstName, timeOfDay: resolveTimeOfDay(now), workspaceName: session.workspace.name }),
      firstName,
      metrics,
      upcomingEvents,
      nextEventWeather,
      weekAgenda,
      calendarWidget,
      priorities,
      revenueSeries,
      recentMessages,
      teamActivity,
      littleReminder,
      notificationCount,
      messageCount,
    },
  };
}
