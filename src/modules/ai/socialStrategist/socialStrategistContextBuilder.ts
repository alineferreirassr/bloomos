import { fetchSocialStrategistMaterials } from "@/modules/ai/socialStrategist/fetchSocialStrategistContext.server";
import { buildSocialStrategistContext } from "@/modules/ai/socialStrategist/contextBuilder";
import type { AIContextBuilder } from "@/core/ai/context/types";

/**
 * SOCIAL-14C — wraps SOCIAL-14B's own workspace-wide Social context
 * pipeline (`fetchSocialStrategistMaterials` + `buildSocialStrategistContext`)
 * as a registered Context Orchestrator section — the same "wrap the fetch
 * pipeline as one builder" shape `crmAssistantContextBuilder.ts` already
 * uses. Lives in `modules/ai/socialStrategist`, not `core/ai/context/builders`,
 * for the same reason `crmAssistantContextBuilder`/`dailyBriefContextBuilder`
 * do: it depends on feature-specific modules `core/ai` must never import.
 *
 * `workspaceId` here is exactly the value `assembleAIContext` (called from
 * `runSkillCompletion`) resolves from the caller's own already-authenticated
 * session — this builder never reads a workspace id from `refs`/facts, and
 * neither does `fetchSocialStrategistMaterials` itself (see that file's own
 * doc comment). `build()` never returns `null`: an entirely empty
 * Workspace still produces a real, empty `SocialStrategistContext` (every
 * list `[]`, every count `0`, `accountMetrics: null`) rather than a missing
 * section — this Skill is meant to run, and say so honestly, even for a
 * brand-new Workspace with no Social activity yet.
 */
export const socialStrategistContextBuilder: AIContextBuilder = {
  key: "socialStrategistContext",
  priority: 5,
  async build({ workspaceId }) {
    const materials = await fetchSocialStrategistMaterials(workspaceId);
    const context = buildSocialStrategistContext(materials);
    return { data: context, source: "fetchSocialStrategistMaterials+buildSocialStrategistContext" };
  },
};
