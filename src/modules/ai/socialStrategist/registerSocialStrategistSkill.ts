import { registerSkill } from "@/core/ai/skills/registry";
import { runSkillCompletion } from "@/core/ai/skills/resolver";
import type { SkillDefinition } from "@/core/ai/skills/types";
import { createSocialStrategistMockProvider } from "@/modules/ai/socialStrategist/mockProvider";
import { socialStrategistModelOutputSchema } from "@/modules/ai/socialStrategist/schema";
import { SOCIAL_STRATEGIST_PROMPT_VERSION } from "@/modules/ai/socialStrategist/promptBuilder";
import { SOCIAL_STRATEGIST_USE_CASE_ID, registerSocialStrategistUseCase } from "@/modules/ai/socialStrategist/registerSocialStrategistUseCase";

export const SOCIAL_STRATEGIST_SKILL_ID = "social-strategist";

/**
 * SOCIAL-14C — Skill layer + structured output contract only. Deliberately
 * NOT surfaced in any existing UI discovery surface yet
 * (`commandPaletteVisible`/`sidebarVisible` both `false`) — this checkpoint
 * builds a fully real, registered, executable Skill (discoverable via
 * `getSkill()`, runnable via `executeSkill()`, exactly like every other
 * Skill), but no dedicated page exists for it to open into yet (that's a
 * later checkpoint's own scope), so it stays invisible to end-user
 * discovery surfaces to avoid a dangling entry with nowhere to go — the
 * same reasoning a "Coming Soon" Skill's own visibility flags follow,
 * except this one genuinely runs (has a real `execute`) once a caller
 * knows its id.
 *
 * `requiredPermissions: ["social.view"]` — the one permission that already
 * gates every Social-adjacent surface this Skill reads from (`/social`,
 * `/ideas`, `/scripts`, `/carousels`, `/inspiration`, per SOCIAL-14A's own
 * UX audit), the same "primary permission, not every underlying data
 * permission" precedent `crm-assistant`'s own `clients.view`-only choice
 * already established.
 */
const socialStrategistSkill: SkillDefinition = {
  id: SOCIAL_STRATEGIST_SKILL_ID,
  name: "Social Strategist",
  description: "An intelligent social strategist — reads this Workspace's own real Social posts, Instagram analytics, Ideas/Inspiration/Scripts/Carousels libraries, and Instagram-sourced Leads to surface content opportunities, pillars, next-content recommendations, and posting strategy notes.",
  category: "social",
  requiredPermissions: ["social.view"],
  requiredContext: ["socialStrategistContext"],
  useCaseId: SOCIAL_STRATEGIST_USE_CASE_ID,
  outputSchema: socialStrategistModelOutputSchema,
  supportedProviders: "any",
  requiredCapabilities: ["structured_output"],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: false,
  commandPaletteVisible: false,
  sidebarVisible: false,
  featureFlag: null,
  minimumRole: null,
  version: SOCIAL_STRATEGIST_PROMPT_VERSION,
  estimatedLatencyMs: 6000,
  contextFactsKey: "socialStrategistContext",
  createMockProvider: createSocialStrategistMockProvider,
  // Assigned below — see `registerCRMAssistantSkill.ts`'s identical doc
  // comment for why this can't be part of the object literal itself (the
  // function needs to close over `socialStrategistSkill` by reference).
};

socialStrategistSkill.execute = async (params) =>
  runSkillCompletion({
    skill: socialStrategistSkill,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    refs: params.refs,
    input: params.input,
  });

let registered = false;

/**
 * Registers the Social Strategist as a Bloom AI Skill — proving the Skill
 * Resolver's own claim of "no special execution path" once more: this
 * Skill's `execute` is the same one-line `runSkillCompletion` delegation
 * every other Skill uses, even though its own context spans Social posts,
 * analytics snapshots, four content libraries, and Instagram Leads at
 * once.
 */
export function registerSocialStrategistSkill(): void {
  if (registered) return;
  registerSocialStrategistUseCase();
  registerSkill(socialStrategistSkill);
  registered = true;
}
