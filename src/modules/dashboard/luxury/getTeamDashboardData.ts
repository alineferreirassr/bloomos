"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getEvents, getChecklistByEventId, getScheduleByEventId } from "@/lib/data";
import { listClientPortalThreadsForWorkspace, listClientPortalMessages } from "@/lib/data/clientPortal/clientPortalMessageStore";
import { getTeamRoleLabel } from "@/lib/data/core/dashboard/teamRoleLabelStore";
import { getCoreNotificationsService } from "@/core/notifications";
import { buildWelcomeCopy, resolveTimeOfDay } from "@/core/dashboard/buildWelcomeCopy";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import type { LuxuryMetricCardData } from "@/modules/dashboard/luxury/components/LuxuryMetricCard";
import type { ScheduleTimelineItemData } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import type { TaskChecklistItemData } from "@/modules/dashboard/luxury/components/TaskChecklist";
import type { EventHeroCardData } from "@/modules/dashboard/luxury/components/EventHeroCard";
import type { EventPreviewCardData } from "@/modules/dashboard/luxury/components/EventPreviewCard";
import type { ProgressStageData } from "@/modules/dashboard/luxury/components/ProgressCard";
import type { ActivityFeedItemData } from "@/modules/dashboard/luxury/components/ActivityFeedList";
import type { ImportantNoteData } from "@/modules/dashboard/luxury/components/ImportantNotesCard";
import type { WeatherNoticeData } from "@/modules/dashboard/luxury/components/WeatherNoticeCard";
import type { LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";
import type { TodaysPriorityData } from "@/modules/dashboard/luxury/components/TodaysPriorityCard";
import type { TodaysPulseMetric } from "@/modules/dashboard/luxury/components/TodaysPulseCard";
import type { WelcomeCopy } from "@/core/dashboard/buildWelcomeCopy";
import type { TeamRoleLabel } from "@/types/teamRoleLabel";
import type { Event } from "@/types/event";
import { getEventWeather } from "@/core/weather/eventWeatherEngine";
import { getCalendarEventsAction } from "@/modules/calendar/calendarActions";
import { formatDateOnlyLabel } from "@/modules/dashboard/luxury/localDate";
import type { NextEventWeather } from "@/modules/dashboard/luxury/getOwnerDashboardData";
import type { CalendarEvent } from "@/types/calendarEvent";

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. You may not have access to it.";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PROGRESS_STAGES: { id: string; label: string; icon: string; categories: ChecklistCategory[] }[] = [
  { id: "planning", label: "Planning", icon: "Checklist", categories: ["planning", "legal", "finance"] },
  { id: "design", label: "Design", icon: "Sparkles", categories: ["decor", "flowers"] },
  { id: "logistics", label: "Logistics", icon: "Task", categories: ["venue", "transportation", "inventory"] },
  { id: "setup", label: "Setup", icon: "Calendar", categories: ["setup"] },
  { id: "execution", label: "Execution", icon: "Heart", categories: ["client", "team", "photography", "video", "food_beverage", "weather", "other"] },
  { id: "cleanup", label: "Cleanup", icon: "Checklist", categories: ["cleanup", "post_event"] },
];

export interface TeamDashboardData {
  welcome: WelcomeCopy;
  /** This member's own `profile.full_name` — passed to `CalendarWidget` so it can highlight items assigned to them, matching the same free-text match `isAssignedToMember` already uses elsewhere in this file. */
  memberName: string;
  teamRoleLabel: TeamRoleLabel;
  metrics: LuxuryMetricCardData[];
  schedule: ScheduleTimelineItemData[];
  tasks: TaskChecklistItemData[];
  currentEvent: EventHeroCardData | null;
  /** True when `currentEvent` is actually happening today; false when there's nothing scheduled today and this is the next upcoming event shown instead — the "Current Event" card's own title switches on this so it never presents a future event as today's. */
  currentEventIsToday: boolean;
  /** The current month's events this member is authorized to see (same `getCalendarEventsAction` `/calendar` itself calls, ceiling unchanged) — the Home Calendar widget's first paint. */
  calendarWidget: { initialEvents: CalendarEvent[]; initialAnchorIso: string };
  progressPercent: number;
  progressStages: ProgressStageData[];
  teamUpdates: ActivityFeedItemData[];
  importantNote: ImportantNoteData | null;
  /** AF-Inspired "Today, at a Glance" Reconstruction — the same single most-urgent-open-item concept as `importantNote`, re-skinned into the shared `TodaysPriorityCard`. Not a separate computation; null exactly when `importantNote` is null. */
  todaysPriority: TodaysPriorityData | null;
  /** This member's own authorized, real `upcomingEvents` (Event[], already computed above for `currentEventSource`'s fallback), mapped the same way Founder's aggregator maps its `upcoming` list — never a broader or Founder-only event set. */
  upcomingEvents: EventPreviewCardData[];
  /** Metrics already computed elsewhere on this same page (today's events, tasks today, upcoming tasks) — reused, not recomputed. */
  todaysPulse: TodaysPulseMetric[];
  weather: WeatherNoticeData | null;
  /**
   * Shares the exact `NextEventWeather` shape `getOwnerDashboardData.ts`
   * uses, so both dashboards render through the same `NextEventWeatherCard`
   * component instead of a Team-only parallel implementation — built from
   * the team member's own assigned event (`currentEventSource`, never a
   * different event they aren't authorized to see), null when that event
   * has no coordinates/date or the lookup fails. Independent of `weather`,
   * which stays the founder's manual `weather_plan` text note passed to
   * the same card as `contingencyNote`.
   */
  nextEventWeather: NextEventWeather | null;
  reminder: ImportantNoteData | null;
  /** From the caller's own real, workspace-sent notifications — never fabricated. See `LittleReminderCard`'s own doc comment for why this is separate from the private wellness cards. */
  littleReminder: LittleReminderData | null;
  notificationCount: number;
  messageCount: number;
}

export type GetTeamDashboardDataResult = { success: true; data: TeamDashboardData } | { success: false; error: string };

function normalizeName(name: string | null): string {
  return (name ?? "").trim().toLowerCase();
}

/** Best-effort "assigned to me" match on the free-text `assigned_name`/`assigned_owner` fields — there is no real Team Member foreign key on either ChecklistItem or Event yet (see docs/team-dashboard.md's Known limitations). */
function isAssignedToMember(candidateName: string | null, memberName: string): boolean {
  if (!memberName) return false;
  return normalizeName(candidateName) === normalizeName(memberName);
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Checkpoint 19, Step 7/8/16/17 — the Team Dashboard's own data
 * aggregator. Every list is filtered to what this specific member is
 * assigned to (`isAssignedToMember`) before it's ever returned — never
 * workspace-wide revenue, all clients, or unassigned confidential events,
 * matching Step 17's own rule. Falls back to this member's own permission-
 * gated visible set only when nothing matches their name, so a genuinely
 * unassigned member still sees a working (not empty-by-accident) Schedule.
 */
export async function getTeamDashboardData(): Promise<GetTeamDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (resolveDashboardExperience(session.membership.role) !== "team") return { success: false, error: GENERIC_ACCESS_ERROR };

  const memberName = session.profile.full_name ?? "";
  const teamRoleLabel = getTeamRoleLabel(session.membership.id);
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const serverContext = getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;

  const allEvents = await getEvents(undefined, serverContext);
  const activeEvents = allEvents.filter((e) => e.archived_at === null && e.cancelled_at === null);

  const myEvents = activeEvents.filter((e) => isAssignedToMember(e.assigned_owner, memberName));
  const visibleEvents = session.permissions.includes("events.view") ? activeEvents : [];
  const effectiveEvents: Event[] = myEvents.length > 0 ? myEvents : visibleEvents;

  const todaysEvents = effectiveEvents.filter((e) => e.event_date?.slice(0, 10) === todayIso);
  const upcomingEvents = effectiveEvents
    .filter((e) => e.event_date !== null && new Date(e.event_date) >= now && e.completed_at === null)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));

  const [checklistLists, scheduleLists] = await Promise.all([
    Promise.all(effectiveEvents.map((event) => getChecklistByEventId(event.id, serverContext))),
    Promise.all(todaysEvents.map((event) => getScheduleByEventId(event.id, serverContext))),
  ]);
  const allChecklistItems = checklistLists.flat();
  const myChecklistItems = allChecklistItems.filter((item) => isAssignedToMember(item.assigned_name, memberName));
  const effectiveChecklistItems = myChecklistItems.length > 0 ? myChecklistItems : allChecklistItems;

  const openTasks = effectiveChecklistItems.filter((item) => item.status !== "completed" && item.status !== "cancelled");
  const tasksToday = openTasks.filter((item) => item.due_date?.slice(0, 10) === todayIso);
  const upcomingTasks = openTasks.filter((item) => item.due_date !== null && item.due_date.slice(0, 10) > todayIso);

  const threads = session.permissions.includes("clients.portal_view") ? listClientPortalThreadsForWorkspace(session.workspace.id) : [];
  const unreadThreadCount = threads.filter((thread) => {
    const threadMessages = listClientPortalMessages(thread.id);
    return threadMessages[threadMessages.length - 1]?.author_type === "client";
  }).length;

  const metrics: LuxuryMetricCardData[] = [
    { id: "today-events", label: "Today's Events", value: String(todaysEvents.length), icon: "Calendar" },
    { id: "tasks-today", label: "Tasks Today", value: String(tasksToday.length), helper: `${tasksToday.filter((t) => t.status === "completed").length} completed`, icon: "Task" },
    { id: "upcoming-tasks", label: "Upcoming Tasks", value: String(upcomingTasks.length), icon: "Checklist" },
    { id: "unread-messages", label: "Unread Messages", value: String(unreadThreadCount), icon: "Message" },
  ];

  const scheduleByEventId = new Map(todaysEvents.map((event, index) => [event.id, scheduleLists[index] ?? []]));
  const schedule: ScheduleTimelineItemData[] = todaysEvents
    .flatMap((event) => (scheduleByEventId.get(event.id) ?? []).map((item) => ({ item, event })))
    .sort((a, b) => (a.item.start_time ?? "").localeCompare(b.item.start_time ?? ""))
    .map(({ item, event }) => ({
      id: item.id,
      timeLabel: item.start_time ? new Date(`1970-01-01T${item.start_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "All day",
      title: item.title,
      subtitle: event.title,
      icon: item.category === "cleanup" ? "Checklist" : item.category === "photography" ? "Camera" : "Calendar",
      done: item.status === "completed",
    }));

  const tasks: TaskChecklistItemData[] = openTasks
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 6)
    .map((item) => ({ id: item.id, title: item.title, timeLabel: item.due_date ? `Today, ${new Date(item.due_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : null, completed: item.status === "completed" }));

  const currentEventSource = todaysEvents[0] ?? upcomingEvents[0] ?? null;
  const currentEventIsToday = todaysEvents.length > 0;
  const currentEvent: EventHeroCardData | null = currentEventSource
    ? {
        title: currentEventSource.title,
        imageUrl: null,
        statusLabel: currentEventSource.status === "confirmed" ? "Confirmed" : currentEventSource.status.replace(/_/g, " "),
        statusTone: currentEventSource.status === "confirmed" ? "success" : "pending",
        details: [
          { icon: "Calendar", label: "Date", value: currentEventSource.event_date ? new Date(currentEventSource.event_date).toLocaleDateString("en-US") : "TBD" },
          { icon: "Schedule", label: "Time", value: currentEventSource.start_time ?? "TBD" },
          { icon: "Location", label: "Location", value: currentEventSource.location_name ?? "TBD" },
          { icon: "Users", label: "Type", value: EVENT_TYPE_LABELS[currentEventSource.event_type] ?? currentEventSource.event_type },
        ],
      }
    : null;

  const currentEventChecklist = currentEventSource ? allChecklistItems.filter((item) => item.owner_id === currentEventSource.id) : [];
  const progressPercent = currentEventChecklist.length === 0 ? 0 : Math.round((currentEventChecklist.filter((i) => i.status === "completed").length / currentEventChecklist.length) * 100);
  const progressStages: ProgressStageData[] = PROGRESS_STAGES.map((stage) => {
    const stageItems = currentEventChecklist.filter((item) => stage.categories.includes(item.category));
    return { id: stage.id, label: stage.label, icon: stage.icon, complete: stageItems.length === 0 || stageItems.every((item) => item.status === "completed") };
  });

  const recentCompletions = effectiveChecklistItems
    .filter((item) => item.completed_at !== null)
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 4);
  const teamUpdates: ActivityFeedItemData[] = recentCompletions.map((item) => ({
    id: item.id,
    actorName: item.assigned_name ?? "A team member",
    actorAvatarUrl: null,
    text: `completed "${item.title}"`,
    relativeTimeLabel: relativeTime(item.completed_at as string),
  }));

  const highPriorityOpen = openTasks.filter((item) => item.priority === "critical" || item.priority === "high").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0] ?? null;
  const importantNote: ImportantNoteData | null = highPriorityOpen ? { id: highPriorityOpen.id, icon: "Checklist", title: highPriorityOpen.title, description: highPriorityOpen.due_date ? `Due ${new Date(highPriorityOpen.due_date).toLocaleDateString("en-US")}` : "No due date set." } : null;

  // AF-Inspired "Today, at a Glance" Reconstruction — re-skin the existing single most-urgent-item concept, no new computation.
  const todaysPriority: TodaysPriorityData | null = importantNote ? { headline: importantNote.title, meta: importantNote.description } : null;

  const upcomingEventsForPreview: EventPreviewCardData[] = upcomingEvents.slice(0, 4).map((event) => {
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

  const todaysPulse: TodaysPulseMetric[] = [
    { label: "Today's Events", value: String(todaysEvents.length) },
    { label: "Tasks Today", value: String(tasksToday.length) },
    { label: "Upcoming Tasks", value: String(upcomingTasks.length) },
  ];

  const weather: WeatherNoticeData | null = currentEventSource?.weather_plan ? { description: currentEventSource.weather_plan, highLabel: "—", lowLabel: "—" } : null;
  let nextEventWeather: NextEventWeather | null = null;
  if (currentEventSource && currentEventSource.latitude !== null && currentEventSource.longitude !== null && currentEventSource.event_date !== null) {
    const eventWeatherResult = await getEventWeather(currentEventSource);
    if (eventWeatherResult.success) {
      nextEventWeather = {
        eventId: currentEventSource.id,
        title: currentEventSource.title,
        dateLabel: formatDateOnlyLabel(currentEventSource.event_date, { month: "short", day: "numeric" }),
        timeLabel: currentEventSource.start_time,
        forecast: eventWeatherResult.data,
      };
    }
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const calendarResult = await getCalendarEventsAction(monthStart.toISOString(), monthEnd.toISOString());
  const calendarWidget = { initialEvents: calendarResult.success ? calendarResult.data : [], initialAnchorIso: now.toISOString() };

  const supplyReminder = openTasks.find((item) => item.category === "inventory") ?? null;
  const reminder: ImportantNoteData | null = supplyReminder ? { id: supplyReminder.id, icon: "Checklist", title: "Don't forget", description: supplyReminder.title } : null;

  const notificationCount = openTasks.filter((item) => item.due_date !== null && new Date(item.due_date) < now).length;

  const memberNotifications = await getCoreNotificationsService().getNotificationsForMember(session.workspace.id, session.membership.id);
  const latestUnread = memberNotifications
    .filter((n) => n.read_at === null && n.archived_at === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const littleReminder: LittleReminderData | null = latestUnread ? { title: latestUnread.title, body: latestUnread.body } : null;

  return {
    success: true,
    data: {
      welcome: buildWelcomeCopy({ experience: "team", firstName: memberName.split(" ")[0] || session.user.email, timeOfDay: resolveTimeOfDay(now), taskCount: tasksToday.length, eventCount: todaysEvents.length }),
      memberName,
      teamRoleLabel,
      metrics,
      schedule,
      tasks,
      currentEvent,
      currentEventIsToday,
      calendarWidget,
      progressPercent,
      progressStages,
      teamUpdates,
      importantNote,
      todaysPriority,
      upcomingEvents: upcomingEventsForPreview,
      todaysPulse,
      weather,
      nextEventWeather,
      reminder,
      littleReminder,
      notificationCount,
      messageCount: unreadThreadCount,
    },
  };
}
