"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getEvents } from "@/lib/data";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

export interface MediaKitEventOption {
  id: string;
  title: string;
  eventDate: string | null;
}

export type GetMediaKitEventOptionsDataResult = { success: true; data: MediaKitEventOption[] } | { success: false; error: string };

/**
 * The Portfolio editor's optional "link an existing Event" picker — a real
 * Event id only, never a fabricated one. Uses `getServerRepositoryContext()`
 * (the same server-authenticated-client pattern `calendarActions.ts`
 * already established) rather than calling `getEvents()` bare, which
 * otherwise resolves its session via the browser-only
 * `getClientWorkspaceSession()` and would read as unauthenticated here.
 */
export async function getMediaKitEventOptionsData(): Promise<GetMediaKitEventOptionsDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const context = getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;
  const events = await getEvents(undefined, context);
  return {
    success: true,
    data: events.map((event) => ({ id: event.id, title: event.title, eventDate: event.event_date })).sort((a, b) => a.title.localeCompare(b.title)),
  };
}
