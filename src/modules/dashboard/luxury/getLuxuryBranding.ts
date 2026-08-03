"use server";

import { getSettingsManager } from "@/core/settings/manager";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

/**
 * Checkpoint 19, Step 10 — reads the existing Settings Registry's branding
 * entries (`modules/settings/sections/brandingSection.ts`) to theme the
 * Luxury Dashboard shell. Before this checkpoint, `branding.logo-url`/
 * `branding.brand-color` were only ever consumed by document merge fields
 * — no UI component actually themed itself from them; this is the first.
 * Falls back to this Workspace's own real `workspaceDisplayName` and each
 * setting's own registered default when unset — never a hardcoded
 * "Amoré Bloom" outside of that real fallback chain.
 *
 * v2 Checkpoint 44 — `logoUrl`/`tagline` now come from the unified
 * `getWorkspaceBranding()` read rather than this function's own separate
 * `getResolvedSettingValue()` calls (the Step 0 audit found this file was
 * one of two independent branding-settings consumers to consolidate). The
 * two inspirational-message settings stay a direct, local read — they're
 * Luxury-shell-specific copy, not part of the cross-surface
 * `WorkspaceBranding` shape.
 */
export async function getLuxuryBranding(experience: "owner" | "team" = "owner"): Promise<LuxuryBranding> {
  const session = await resolveMemberSessionSnapshot();
  const workspaceId = session.kind === "active" || session.kind === "inactive" ? session.workspace.id : null;
  const brandName = session.kind === "active" || session.kind === "inactive" ? session.workspaceDisplayName : "Amoré Bloom";

  if (!workspaceId) {
    return { logoUrl: null, brandName, tagline: "Luxury Proposal & Event Studio", inspirationalMessage: experience === "owner" ? "You're building unforgettable moments." : "We create the moments they'll never forget." };
  }

  const [branding, ownerMessage, teamMessage] = await Promise.all([
    getWorkspaceBranding(workspaceId),
    getSettingsManager().getResolvedSettingValue(workspaceId, "branding.owner-inspirational-message"),
    getSettingsManager().getResolvedSettingValue(workspaceId, "branding.team-inspirational-message"),
  ]);

  return {
    logoUrl: branding.logoUrl,
    brandName,
    tagline: branding.tagline || "Luxury Proposal & Event Studio",
    inspirationalMessage: experience === "owner" ? asString(ownerMessage, "You're building unforgettable moments.") : asString(teamMessage, "We create the moments they'll never forget."),
  };
}
