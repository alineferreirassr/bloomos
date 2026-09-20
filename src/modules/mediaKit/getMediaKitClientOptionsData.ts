"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getDataMode } from "@/lib/env";
import { getClients } from "@/lib/data";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

export interface MediaKitClientOption {
  id: string;
  name: string;
}

export type GetMediaKitClientOptionsDataResult = { success: true; data: MediaKitClientOption[] } | { success: false; error: string };

/**
 * The Partners editor's optional "link an existing Client" picker (and the
 * Testimonials editor's own Client picker) — a real Client id only, never a
 * fabricated one. Uses `getServerRepositoryContext()`, the same pattern
 * `getMediaKitEventOptionsData.ts` already established, since `getClients()`
 * bare would otherwise resolve its session via the browser-only
 * `getClientWorkspaceSession()` and read as unauthenticated here.
 */
export async function getMediaKitClientOptionsData(): Promise<GetMediaKitClientOptionsDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const context = getDataMode() === "supabase" ? await getServerRepositoryContext() : undefined;
  const clients = await getClients({}, context);
  return {
    success: true,
    data: clients
      .map((client) => ({ id: client.id, name: `${client.first_name} ${client.last_name}`.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
