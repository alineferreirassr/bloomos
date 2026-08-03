import { getEvents, getChecklistByEventId, getClientById } from "@/lib/data";
import { getCoreNotificationsService } from "@/core/notifications";
import type { BriefLine, TeamBrief } from "@/modules/ai/copilot/briefs/types";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checkpoint 20, Step 5 — the Team Brief. Scoped to "my Events" (Events
 * where `assigned_owner` matches the current member's own display name —
 * the same string-match convention `DailyBriefTeamAssignment.assigneeName`
 * already established, since this codebase has no per-checklist-item
 * assignee picker UI yet; see `types/checklistItem.ts`'s own doc comment).
 * Deterministic, no LLM — same reasoning as `generateExecutiveBrief.ts`.
 */
export async function generateTeamBrief(workspaceId: string, memberId: string, firstName: string | null, fullName: string | null): Promise<TeamBrief> {
  const now = Date.now();
  const events = await getEvents({ includeArchived: false });
  const myEvents = fullName ? events.filter((event) => event.assigned_owner === fullName) : [];

  const myUpcomingEvents = myEvents.filter((event) => event.event_date && new Date(event.event_date).getTime() >= now);
  const myEventsSoon = myUpcomingEvents.filter((event) => new Date(event.event_date as string).getTime() - now <= ONE_WEEK_MS);

  const checklistResults = await Promise.all(myUpcomingEvents.map(async (event) => ({ event, checklist: await getChecklistByEventId(event.id) })));
  const allOpenItems = checklistResults.flatMap(({ checklist }) => checklist.filter((item) => item.status !== "completed"));
  const dueToday = allOpenItems.filter((item) => item.due_date && new Date(item.due_date).toDateString() === new Date().toDateString());
  const lateItems = allOpenItems.filter((item) => item.due_date && new Date(item.due_date).getTime() < now);
  const totalItems = checklistResults.reduce((sum, { checklist }) => sum + checklist.length, 0);
  const completedItems = totalItems - checklistResults.reduce((sum, { checklist }) => sum + checklist.filter((item) => item.status !== "completed").length, 0);

  const notifications = await getCoreNotificationsService().getNotificationsForMember(workspaceId, memberId);
  const unreadCount = notifications.filter((notification) => notification.read_at === null).length;

  const clientIds = [...new Set(myUpcomingEvents.map((event) => event.client_id))];
  const clients = await Promise.all(clientIds.map((id) => getClientById(id).catch(() => null)));
  const priorityClient = clients.find((client) => client?.is_vip) ?? null;

  const lines: BriefLine[] = [
    {
      id: "tasks-today",
      text:
        dueToday.length > 0
          ? `${dueToday.length} checklist item${dueToday.length === 1 ? "" : "s"} due today across your Events.`
          : "Nothing due today.",
      tone: dueToday.length > 0 ? "warning" : "success",
    },
    {
      id: "upcoming-events",
      text:
        myEventsSoon.length > 0
          ? `${myEventsSoon.length} of your Events happen in the next 7 days.`
          : "No Events assigned to you in the next 7 days.",
      tone: "info",
    },
    {
      id: "checklist-progress",
      text: totalItems > 0 ? `Checklist progress across your Events: ${completedItems}/${totalItems} complete.` : "No checklist items on your Events yet.",
      tone: "info",
    },
    {
      id: "messages",
      text: unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.` : "No unread notifications.",
      tone: unreadCount > 0 ? "info" : "success",
    },
    {
      id: "late-tasks",
      text:
        lateItems.length > 0
          ? `${lateItems.length} checklist item${lateItems.length === 1 ? "" : "s"} overdue on your Events.`
          : "No overdue checklist items.",
      tone: lateItems.length > 0 ? "warning" : "success",
    },
  ];

  if (priorityClient) {
    lines.push({
      id: "priority-client",
      text: `${priorityClient.first_name} ${priorityClient.last_name} is a VIP client on one of your upcoming Events.`,
      tone: "info",
    });
  }

  const greeting = firstName ? `Good morning, ${firstName}.` : "Good morning.";
  const summary = myEvents.length > 0 ? "Here's what's on your plate today." : "Nothing assigned to you yet — check back once an Event is assigned.";

  return { greeting, summary, lines, generatedAt: new Date().toISOString() };
}
