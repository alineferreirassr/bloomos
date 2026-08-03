"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { listApiKeysForWorkspace, seedDemoApiKey } from "@/lib/data/core/api/apiKeyStore";
import { summarizeApiUsage, type ApiUsageSummary } from "@/lib/data/core/api/apiUsageStore";
import type { ApiKey } from "@/types/apiKey";

const GENERIC_ACCESS_ERROR = "The Developer Console isn't available. You may not have access to it.";

export interface DeveloperConsoleData {
  apiKeys: ApiKey[];
  usage: ApiUsageSummary;
}

export type GetDeveloperConsoleDataResult = { success: true; data: DeveloperConsoleData } | { success: false; error: string };

/**
 * Checkpoint 16, Step 11 — the one aggregate the Developer Console reads
 * from, mirroring `getAutomationDashboardData.ts`/`getAnalyticsDashboardData.ts`'s
 * own "one aggregate, computed fresh" shape. `workspace.manage` — the same
 * elevated permission `/settings` requires — since issuing or revoking a
 * credential that reads live business data is at least as sensitive as
 * changing a Workspace setting.
 */
export async function getDeveloperConsoleData(): Promise<GetDeveloperConsoleDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  await seedDemoApiKey(session.workspace.id, session.membership.id);

  return {
    success: true,
    data: {
      apiKeys: listApiKeysForWorkspace(session.workspace.id),
      usage: summarizeApiUsage(session.workspace.id),
    },
  };
}
