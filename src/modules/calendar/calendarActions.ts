"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getCalendarEventSources } from "@/core/calendar/registry";
import { registerDefaultCalendarEventSources } from "@/core/calendar/defaultRegistrations";
import { readWorkspaceFavorites } from "@/lib/data/mock/workspaceFavoritesStore";
import { sortFavoritesByPinnedThenRecency } from "@/core/workspace/favoritesEngine";
import type { CalendarEvent } from "@/types/calendarEvent";
import type { WorkspaceFavorite } from "@/types/smartWorkspace";

/**
 * Advanced Calendar phase — the Calendar's own module actions layer.
 * Registers the real Events/Tasks sources once per module load, then
 * fans out to every registered `CalendarEventSource` for a given range —
 * the Calendar UI never imports `getEvents`/`getChecklistByEventId`
 * itself, only this action, matching the registry's own dependency-
 * inversion intent. Pinned Events reuses the Smart Workspace Platform's
 * existing `WorkspaceFavorite` store (`entity_type: "event"`) verbatim —
 * no new persistence, no migration.
 */
registerDefaultCalendarEventSources();

export type CalendarActionResult<T> = { success: true; data: T } | { success: false; error: string };

const GENERIC_ACCESS_ERROR = "The Calendar isn't available. You may not have access to it.";

export async function getCalendarEventsAction(rangeStartIso: string, rangeEndIso: string): Promise<CalendarActionResult<CalendarEvent[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("events.view")) return { success: true, data: [] };

  const workspaceId = session.workspace.id;
  const serverContext = getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;
  const range = { start: new Date(rangeStartIso), end: new Date(rangeEndIso) };

  const perSource = await Promise.all(
    getCalendarEventSources().map((source) => source.fetch(range, workspaceId, serverContext).catch(() => [] as CalendarEvent[])),
  );

  return { success: true, data: perSource.flat() };
}

/** The signed-in member's own pinned Events, newest-pinned first — a thin read over the same favorites store `toggleFavoriteAction`/`togglePinnedFavoriteAction` (`@/modules/workspace/workspaceActions`) already write to. */
export async function listPinnedCalendarEventsAction(): Promise<CalendarActionResult<WorkspaceFavorite[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const pinned = readWorkspaceFavorites().filter(
    (favorite) =>
      favorite.workspace_id === workspaceId &&
      favorite.member_id === memberId &&
      favorite.pinned &&
      (favorite.entity_type === "event" || favorite.entity_type === "checklist_item"),
  );

  return { success: true, data: sortFavoritesByPinnedThenRecency(pinned) };
}
