"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerSettingsSections } from "@/modules/settings/registerSettingsSections";
import { searchSettings, type SettingsSearchResult } from "@/core/settings/search";

registerSettingsSections();

/**
 * Step 14's own Global Settings Search, wrapped as a Server Action so the
 * Search box (mounted wherever a member is in the app, per "Typing should
 * immediately navigate to the correct section") never needs its own
 * permission/role resolution — the acting member's real session drives it,
 * the same way every other Settings Server Action in this module does.
 */
export async function searchSettingsAction(query: string): Promise<SettingsSearchResult[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  return searchSettings(query, { workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role });
}
