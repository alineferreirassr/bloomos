import { z } from "zod";
import { registerSkill } from "@/core/ai/skills/registry";
import type { SkillDefinition } from "@/core/ai/skills/types";

/**
 * Every field here is filled in honestly — real permissions, real
 * category, a real (if provisional) description — the same way every
 * other Skill is declared. The one field deliberately left `undefined` is
 * `execute`: its absence is the single, generic signal every discovery
 * surface (Bloom AI Dashboard, Skill Picker, `executeSkill` itself) already
 * treats as "Coming Soon" — no separate status flag to keep in sync. This
 * one isn't built this checkpoint (see the Checkpoint 4/8 stop conditions);
 * registering it now only makes the Dashboard's "Coming Soon" section
 * Skill-Registry-driven instead of a hardcoded array. "Daily Brief" was the
 * fourth placeholder here through Checkpoint 4 — it moved to a real
 * registration (`registerDailyOperationsBriefSkill.ts`) in Checkpoint 5.
 * "CRM Assistant" was the third through Checkpoint 6 — it moved to a real
 * registration (`registerCRMAssistantSkill.ts`) in Checkpoint 7. "Finance
 * Assistant" was the second through Checkpoint 7 — it moved to a real
 * registration (`registerFinanceAssistantSkill.ts`) in Checkpoint 8. Each
 * was removed from this list rather than left duplicated.
 */
const UPCOMING_SKILLS: SkillDefinition[] = [
  {
    id: "document-assistant",
    name: "Document Assistant",
    description: "Drafts and summarizes Documents from an Event or Client's own records.",
    category: "documents",
    requiredPermissions: [],
    requiredContext: [],
    useCaseId: "document-assistant",
    outputSchema: z.unknown(),
    supportedProviders: "any",
    requiredCapabilities: ["structured_output"],
    supportsStreaming: false,
    requiresApproval: false,
    requiresReview: false,
    commandPaletteVisible: false,
    sidebarVisible: true,
    featureFlag: null,
    minimumRole: null,
    version: "unreleased",
    estimatedLatencyMs: null,
    contextFactsKey: "documentAssistantContext",
  },
];

let registered = false;

export function registerUpcomingSkills(): void {
  if (registered) return;
  for (const skill of UPCOMING_SKILLS) registerSkill(skill);
  registered = true;
}
