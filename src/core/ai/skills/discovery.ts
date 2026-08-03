import { getSkill, listSkills } from "@/core/ai/skills/registry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { getAIUseCase } from "@/core/ai/prompts/registry";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { SkillDefinition, SkillMetadata } from "@/core/ai/skills/types";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface ListSkillsForWorkspaceParams {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
}

/**
 * Every Skill this member may even be offered, sorted alphabetically by
 * name for a stable Dashboard/Skill Picker order. Permission and role are
 * filtered the same way `executeSkill` re-checks them at execution time
 * ("No UI-only restriction") — a Skill hidden here would also be rejected
 * server-side if invoked anyway; this only exists so a UI doesn't have to
 * duplicate that logic to decide what's worth *showing*. Feature flags are
 * a real per-Workspace lookup (`evaluateFeatureFlag` is async), so this is
 * too — capability/provider compatibility is intentionally not filtered
 * here, since an unavailable provider still leaves the Skill worth
 * *discovering* (its mock stand-in still runs); `executeSkill` is where
 * provider availability actually gates execution.
 */
export async function listSkillsForWorkspace(params: ListSkillsForWorkspaceParams): Promise<SkillDefinition[]> {
  const candidates = listSkills().filter((skill) => {
    if (skill.requiredPermissions.some((permission) => !params.permissions.includes(permission))) return false;
    if (skill.minimumRole && (!params.role || !roleMeetsMinimum(params.role, skill.minimumRole))) return false;
    return true;
  });

  const flagChecks = await Promise.all(
    candidates.map((skill) => (skill.featureFlag ? evaluateFeatureFlag(params.workspaceId, skill.featureFlag) : Promise.resolve(true))),
  );

  return candidates.filter((_, index) => flagChecks[index]).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The Step 7 "Skill Metadata" view for one Skill — combines its static
 * declaration with what's true about it right now (which provider would
 * actually answer a call). `null` when no Skill is registered for `id`.
 */
export function getSkillMetadata(id: string): SkillMetadata | null {
  const skill = getSkill(id);
  if (!skill) return null;

  const useCase = getAIUseCase(skill.useCaseId);
  const configured = isAIConfigured();
  const provider = !skill.execute ? null : configured ? (getAIProvider()?.name ?? null) : "mock";

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    status: skill.execute ? "active" : "coming_soon",
    version: skill.version,
    provider,
    promptVersion: useCase?.promptVersion ?? skill.version,
    capabilities: skill.requiredCapabilities,
    estimatedLatencyMs: skill.estimatedLatencyMs,
    requiresApproval: skill.requiresApproval,
    requiresReview: skill.requiresReview,
    availability: !skill.execute ? "unavailable" : configured ? "live" : "mock",
  };
}
