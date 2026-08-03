"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { generateCommunicationBrief } from "@/modules/ai/copilot/briefs/generateCommunicationBrief";
import type { CommunicationBrief } from "@/modules/ai/copilot/briefs/types";

const GENERIC_ACCESS_ERROR = "The Communication Brief isn't available. You may not have access to it.";

export async function getCommunicationBriefAction(): Promise<{ success: true; data: CommunicationBrief } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const firstName = session.profile.full_name?.split(" ")[0] ?? null;
  const brief = await generateCommunicationBrief(session.workspace.id, session.membership.id, firstName);
  return { success: true, data: brief };
}
