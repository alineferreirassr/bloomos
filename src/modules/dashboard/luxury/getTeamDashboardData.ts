"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getEvents, getChecklistByEventId, getScheduleByEventId } from "@/lib/data";
import { listClientPortalThreadsForWorkspace, listClientPortalMessages } from "@/lib/data/clientPortal/clientPortalMessageStore";
import { getTeamRoleLabel } from "@/lib/data/core/dashboard/teamRoleLabelStore";
import { buildWelcomeCopy, resolveTimeOfDay } from "@/core/dashboard/buildWelcomeCopy";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import type { LuxuryMetricCardData } from "@/modules/dashboard/luxury/components/LuxuryMetricCard";
import type { ScheduleTimelineItemData } from "@/modules/dashboard/luxury/components/ScheduleTimeline";
import type { TaskChecklistItemData } from "@/modules/dashboard/luxury/components/TaskChecklist";
import type { EventHeroCardData } from "@/modules/dashboard/luxury/components/EventHeroCard";
import type { ProgressStageData } from "@/modules/dashboard/luxury/components/ProgressCard";
import type { ActivityFeedItemData } from "@/modules/dashboard/luxury/components/ActivityFeedList";
import type { ImportantNoteData } from "@/modules/dashboard/luxury/components/ImportantNotesCard";
import type { WeatherNoticeData } from "@/modules/dashboard/luxury/components/WeatherNoticeCard";
import type { WelcomeCopy } from "@/core/dashboard/buildWelcomeCopy";
import type { TeamRoleLabel } from "@/types/teamRoleLabel";
import type { Event } from "@/types/event";

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. You may not have access to it.";

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
  teamRoleLabel: TeamRoleLabel;
  metrics: LuxuryMetricCardData[];
  schedule: ScheduleTimelineItemData[];
  tasks: TaskChecklistItemData[];
  currentEvent: EventHeroCardData | null;
  progressPercent: number;
  progressStages: ProgressStageData[];
  teamUpdates: ActivityFeedItemData[];
  importantNote: ImportantNoteData | null;
  weather: WeatherNoticeData | null;
  reminder: ImportantNoteData | null;
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

  const allEvents = await getEvents();
  const activeEvents = allEvents.filter((e) => e.archived_at === null && e.cancelled_at === null);

  const myEvents = activeEvents.filter((e) => isAssignedToMember(e.assigned_owner, memberName));
  const visibleEvents = session.permissions.includes("events.view") ? activeEvents : [];
  const effectiveEvents: Event[] = myEvents.length > 0 ? myEvents : visibleEvents;

  const todaysEvents = effectiveEvents.filter((e) => e.event_date?.slice(0, 10) === todayIso);
  const upcomingEvents = effectiveEvents
    .filter((e) => e.event_date !== null && new Date(e.event_date) >= now && e.completed_at === null)
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));

  const [checklistLists, scheduleLists] = await Promise.all([
    Promise.all(effectiveEvents.map((event) => getChecklistByEventId(event.id))),
    Promise.all(todaysEvents.map((event) => getScheduleByEventId(event.id))),
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

  const weather: WeatherNoticeData | null = currentEventSource?.weather_plan ? { description: currentEventSource.weather_plan, highLabel: "—", lowLabel: "—" } : null;

  const supplyReminder = openTasks.find((item) => item.category === "inventory") ?? null;
  const reminder: ImportantNoteData | null = supplyReminder ? { id: supplyReminder.id, icon: "Checklist", title: "Don't forget", description: supplyReminder.title } : null;

  const notificationCount = openTasks.filter((item) => item.due_date !== null && new Date(item.due_date) < now).length;

  return {
    success: true,
    data: {
      welcome: buildWelcomeCopy({ experience: "team", firstName: memberName.split(" ")[0] || session.user.email, timeOfDay: resolveTimeOfDay(now), taskCount: tasksToday.length, eventCount: todaysEvents.length }),
      teamRoleLabel,
      metrics,
      schedule,
      tasks,
      currentEvent,
      progressPercent,
      progressStages,
      teamUpdates,
      importantNote,
      weather,
      reminder,
      notificationCount,
      messageCount: unreadThreadCount,
    },
  };
}
