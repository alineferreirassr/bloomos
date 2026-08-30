"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getEvents, getChecklistByEventId } from "@/lib/data";
import { getCoreNotificationsService } from "@/core/notifications";
import { getOperationalLocationForecast } from "@/core/weather/operationalLocationWeather";
import { DEFAULT_OPERATIONAL_LOCATION } from "@/core/dashboard/operationalLocation";
import type { DailyForecast } from "@/types/weather";
import type { PriorityItemData } from "@/modules/dashboard/luxury/components/PriorityList";
import type { LittleReminderData } from "@/modules/dashboard/luxury/components/LittleReminderCard";

const GENERIC_ACCESS_ERROR = "The Team page isn't available. You may not have access to it.";

export interface TeamPageGlanceData {
  /** Today's forecast for the shared Amoré Bloom operational location (`DEFAULT_OPERATIONAL_LOCATION`) — null only when the lookup itself fails, never fabricated. */
  operationalForecast: DailyForecast | null;
  /** The same real, workspace-wide high-priority checklist items `getOwnerDashboardData.ts`'s own "Today's Focus" shows — company-wide, matching the precedent already established for /team's Calendar/Weather (every role that can reach /team already sees this same data). Never fabricated; empty when nothing is open/urgent. */
  priorities: PriorityItemData[];
  /** From the CURRENT viewer's own real, workspace-sent notifications — safe per-viewer, same derivation as `getOwnerDashboardData.ts`/`getTeamDashboardData.ts`. */
  littleReminder: LittleReminderData | null;
}

export type GetTeamPageGlanceDataResult = { success: true; data: TeamPageGlanceData } | { success: false; error: string };

/**
 * Powers the Team page's ("/team", `TeamView.tsx`) "Today, at a glance" +
 * "Today's Focus/Little Reminder" sections. Deliberately NOT gated to
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

  return { success: true, data: { operationalForecast, priorities, littleReminder } };
}
