import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const skillsSection: SettingsSectionDefinition = {
  id: "skills",
  label: "Skills",
  description: "Which Bloom AI Skill opens first from the Ask Bloom picker.",
  icon: "Wand2",
  order: 40,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

/**
 * `options` names the six Skills registered as of this checkpoint
 * (`PROPOSAL_SKILL_ID`/`EVENT_OPERATIONS_BRIEF_SKILL_ID`/etc. — see
 * `modules/ai/*`). Kept as a static list rather than importing the real
 * Skill Registry here: `registerDefaultAIContextBuilders()`'s own
 * transitive chain reaches `server-only`-guarded modules the same way it
 * has for every other cross-module import this session, and this Setting
 * Definition must stay importable from a Client Component's own Node
 * Library-equivalent panel. A future checkpoint could resolve this list
 * from `listSkills()` server-side instead, the same `WorkflowNodeSummary`
 * pattern Checkpoint 10 already established.
 */
export const defaultSkillSetting: SettingDefinition = {
  id: "skills.default-skill",
  sectionId: "skills",
  category: null,
  label: "Default Skill",
  description: "The Skill highlighted first when a member opens Ask Bloom with no page-specific context.",
  keywords: ["default skill", "ask bloom"],
  type: "select",
  options: [
    { label: "Proposal Generator", value: "proposal.generate" },
    { label: "Event Operations Brief", value: "event-operations-brief" },
    { label: "Daily Operations Brief", value: "daily-operations-brief" },
    { label: "Browse AI Memory", value: "browse-ai-memory" },
    { label: "CRM Assistant", value: "crm-assistant" },
    { label: "Finance Assistant", value: "finance-assistant" },
  ],
  defaultValue: "daily-operations-brief",
  required: true,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

export const skillsSettings: SettingDefinition[] = [defaultSkillSetting];
