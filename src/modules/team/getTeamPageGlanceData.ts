"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getEvents, getChecklistByEventId } from "@/lib/data";
import { getCoreNotificationsService } from "@/core/notifications";
import { getOperationalLocationForecast } from "@/core/weather/operationalLocationWeather";
import { DEFAULT_OPERATIONAL_LOCATION } from "@/core/dashboard/operationalLocation";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import type { DailyForecast } from "@/types/weather";
import type { PriorityItemData } from "@/modules/dashboard/luxury/components/PriorityList";
import type { LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import type { TodaysPriorityData } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import type { ScheduleTimelineItemData } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import type { TodaysPulseMetric } from "@/modules/dashboard/luxury/components/TodaysPulseCard";
import type { EventPreviewCardData } from "@/modules/dashboard/luxury/components/EventPreviewCard";

const GENERIC_ACCESS_ERROR = "The Team page isn't available. You may not have access to it.";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface TeamPageGlanceData {
  /** Today's forecast for the shared Amoré Bloom operational location (`DEFAULT_OPERATIONAL_LOCATION`) — null only when the lookup itself fails, never fabricated. */
  operationalForecast: DailyForecast | null;
  /** The same real, workspace-wide high-priority checklist items `getOwnerDashboardData.ts`'s own "Today's Focus" shows — company-wide, matching the precedent already established for /team's Calendar/Weather (every role that can reach /team already sees this same data). Never fabricated; empty when nothing is open/urgent. */
  priorities: PriorityItemData[];
  /** From the CURRENT viewer's own real, workspace-sent notifications — safe per-viewer, same derivation as `getOwnerDashboardData.ts`/`getTeamDashboardData.ts`. */
  littleReminder: LittleReminderData | null;
  /** AF-Inspired "Today, at a Glance" Reconstruction — the single most urgent open item from `priorities`, never a separately-fabricated value. Null exactly when `priorities` is empty. */
  todaysPriority: TodaysPriorityData | null;
  /** The same workspace-wide upcoming `Event[]` every role reaching this page already sees (see this file's own "company-wide, all roles" precedent above) — never Founder-private or per-member-filtered data. */
  upcomingEvents: EventPreviewCardData[];
  /** Today's own Events only (`event_date` = today), workspace-wide — the same coarser equivalent `getOwnerDashboardData.ts` builds for Founder's Today's Timeline. */
  todaysTimeline: ScheduleTimelineItemData[];
  /** Metrics already computed elsewhere in this same file (priorities count, today's event count) — reused, not recomputed, and never padded to match AF's own row count. */
  todaysPulse: TodaysPulseMetric[];
}

export type GetTeamPageGlanceDataResult = { success: true; data: TeamPageGlanceData } | { success: false; error: string };

/**
 * Powers the Team page's ("/team", `TeamView.tsx`) "A little look at today ♡"
 * section — Clock+Weather, Today's Priority/Little Reminder, Upcoming
 * Events, Today's Timeline/Today's Pulse. Deliberately NOT gated to
 * `owner` like `getOwnerDashboardData` — `/team` itself is reachable by
 * every role holding `team.view` (owner/admin/manager/staff alike, per
 * `permissionMatrix.ts`), so this only requires an active session.
 * `priorities` reads the same workspace-wide Events/Checklist data
 * `getOwnerDashboardData.ts` already exposes company-wide — consistent
 * with this page's own already-established "company-wide, all roles"
 * precedent for Calendar/Weather. `littleReminder` stays per-viewer (each
 * role only ever sees their own notifications). The forecast is for a
 * fixed, non-event location (see `operationalLocationWeather.ts`), so no
 * event/RLS concern applies to it at all; no Founder-private data
 * (wellness, personal notes) is touched anywhere in this file.
 */
export async function getTeamPageGlanceData(): Promise<GetTeamPageGlanceDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const serverContext = getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;
  const now = new Date();

  const events = await getEvents(undefined, serverContext);
  const activeEvents = events.filter((e) => e.archived_at === null && e.cancelled_at === null);
  const checklistLists = await Promise.all(activeEvents.map((event) => getChecklistByEventId(event.id, serverContext)));
  const openPriorityItems = checklistLists
    .flat()
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

  const memberNotifications = await getCoreNotificationsService().getNotificationsForMember(session.workspace.id, session.membership.id);
  const latestUnreadNotification = memberNotifications
    .filter((n) => n.read_at === null && n.archived_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const littleReminder: LittleReminderData | null = latestUnreadNotification ? { title: latestUnreadNotification.title, body: latestUnreadNotification.body } : null;

  const operationalForecast = await getOperationalLocationForecast(DEFAULT_OPERATIONAL_LOCATION);

  // AF-Inspired "Today, at a Glance" Reconstruction — the single most urgent item, not the full list.
  const todaysPriority: TodaysPriorityData | null = priorities[0] ? { headline: priorities[0].title, meta: priorities[0].dueLabel } : null;

  const todayIso = now.toISOString().slice(0, 10);
  const upcoming = activeEvents
    .filter((e) => e.event_date !== null && new Date(e.event_date) >= now && e.completed_at === null)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
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

  const todaysEvents = activeEvents
    .filter((e) => e.event_date?.slice(0, 10) === todayIso)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const todaysTimeline: ScheduleTimelineItemData[] = todaysEvents.map((event) => ({
    id: event.id,
    timeLabel: event.start_time ? new Date(`1970-01-01T${event.start_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "All day",
    title: event.title,
    subtitle: EVENT_TYPE_LABELS[event.event_type] ?? event.event_type,
    icon: "Calendar",
  }));

  const todaysPulse: TodaysPulseMetric[] = [
    { label: "Priorities", value: String(priorities.length) },
    { label: "Today's Events", value: String(todaysEvents.length) },
  ];

  return { success: true, data: { operationalForecast, priorities, littleReminder, todaysPriority, upcomingEvents, todaysTimeline, todaysPulse } };
}
