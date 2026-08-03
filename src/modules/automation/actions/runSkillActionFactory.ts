import { executeSkill } from "@/core/ai/skills/resolver";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail, AutomationCategory } from "@/types/automation";
import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

interface RunSkillActionSpec {
  id: string;
  name: string;
  description: string;
  skillId: string;
  category: AutomationCategory;
  requiredPermissions: Permission[];
  minimumRole: WorkspaceMemberRole | null;
}

/**
 * Checkpoint 13's own generic counterpart to `generateDocumentActionFactory.ts`
 * — closes over one `skillId` at *registration* time (see
 * `registerAutomationActions.ts`'s own "one fallback Action per Skill not
 * already covered by a bespoke Action" loop), the same reason 5 separate
 * "Generate X Document" Actions exist instead of one runtime-parameterized
 * Action: `AutomationActionParams` only ever exposes a trigger's own flat
 * `facts`, never a Workflow node's own static `data`. Calls `executeSkill()`
 * directly (rather than a Skill-specific wrapper like `generateProposalDraft()`)
 * since a *generic* fallback can't know which bespoke wrapper, if any, a
 * future Skill might have — this is the one path guaranteed to work for
 * any Skill the Registry holds, honoring every one of `executeSkill`'s own
 * permission/role/feature-flag gates exactly as any other caller would.
 */
export function makeRunSkillAction(spec: RunSkillActionSpec): AutomationActionDefinition {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    version: `automation-action-${spec.id}-v1`,
    requiredPermissions: spec.requiredPermissions,
    featureFlag: null,
    minimumRole: spec.minimumRole,
    async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
      const refs: Record<string, string | undefined> = {};
      for (const [key, factValue] of Object.entries(params.facts)) {
        refs[key] = factValue === null ? undefined : String(factValue);
      }

      const result = await executeSkill({
        skillId: spec.skillId,
        workspaceId: params.workspaceId,
        workspaceName: params.workspaceName ?? undefined,
        userId: params.userId ?? "system",
        userName: params.userName ?? undefined,
        permissions: params.permissions,
        role: params.role,
        refs,
      });

      if (!result.success) return { success: false, message: result.error.message };
      return { success: true, message: `${spec.name} completed.` };
    },
  };
}

/** The generic fallback Action id for a Skill with no bespoke, hand-written Action — see `registerAutomationActions.ts`. */
export function runSkillFallbackActionId(skillId: string): string {
  return `run-skill.${skillId}`;
}
