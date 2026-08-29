"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getCalendarEventsAction } from "@/modules/calendar/calendarActions";
import { getOperationalLocationForecast } from "@/core/weather/operationalLocationWeather";
import { DEFAULT_OPERATIONAL_LOCATION } from "@/core/dashboard/operationalLocation";
import type { DailyForecast } from "@/types/weather";
import type { CalendarEvent } from "@/types/calendarEvent";

const GENERIC_ACCESS_ERROR = "The Team page isn't available. You may not have access to it.";

export interface TeamPageGlanceData {
  /** Today's forecast for the shared Amoré Bloom operational location (`DEFAULT_OPERATIONAL_LOCATION`) — null only when the lookup itself fails, never fabricated. */
  operationalForecast: DailyForecast | null;
  calendarWidget: { initialEvents: CalendarEvent[]; initialAnchorIso: string };
}

export type GetTeamPageGlanceDataResult = { success: true; data: TeamPageGlanceData } | { success: false; error: string };

/**
 * Powers the Team page's ("/team", `TeamView.tsx`) "Today" section: a
 * compact single-location Clock+Weather panel (per the "Team + Client
 * Compact Clock & Weather Variant" addendum) plus the same compact
 * Calendar every dashboard renders. Deliberately NOT gated to `owner` like
 * `getOwnerDashboardData` — `/team` itself is reachable by every role
 * holding `team.view` (owner/admin/manager/staff alike, per
 * `permissionMatrix.ts`), so this only requires an active session. The
 * calendar is built exclusively from `getCalendarEventsAction` — the exact
 * same `events.view`-checked Server Action `/calendar` and every
 * dashboard's own Calendar widget already call — never the raw Events
 * repository directly, so this can never show a viewer anything their own
 * role wasn't already allowed to see at `/calendar`. The forecast is for a
 * fixed, non-event location (see `operationalLocationWeather.ts`), so no
 * event/RLS concern applies to it at all; no Founder-private data
 * (wellness, personal notes) is touched anywhere in this file.
 */
export async function getTeamPageGlanceData(): Promise<GetTeamPageGlanceDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const calendarResult = await getCalendarEventsAction(monthStart.toISOString(), monthEnd.toISOString());
  const calendarWidget = { initialEvents: calendarResult.success ? calendarResult.data : [], initialAnchorIso: now.toISOString() };

  const operationalForecast = await getOperationalLocationForecast(DEFAULT_OPERATIONAL_LOCATION);

  return { success: true, data: { operationalForecast, calendarWidget } };
}
