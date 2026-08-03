import { randomUUID } from "node:crypto";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { routeAIUseCase } from "@/core/ai/prompts/router";
import { assembleAIContext } from "@/core/ai/context/orchestrator";
import { executeAIRequest } from "@/core/ai/runtime/runtime";
import { parseStructuredOutput, applySemanticValidation } from "@/core/ai/structuredOutput";
import { estimateTokens } from "@/core/ai/tokenBudget";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { getLogger } from "@/core/observability/logger";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { AIContextSectionKey } from "@/core/ai/context/types";
import { getSkill } from "@/core/ai/skills/registry";
import type { SkillDefinition, SkillExecutionResult } from "@/core/ai/skills/types";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface ExecuteSkillParams {
  skillId: string;
  workspaceId: string;
  workspaceName?: string;
  userId: string;
  userName?: string;
  permissions: Permission[];
  role?: WorkspaceMemberRole | null;
  refs: Record<string, string | undefined>;
  input?: unknown;
  approved?: boolean;
}

/**
 * The single seam every feature calls instead of the Runtime, the Prompt
 * Registry, or the Context Orchestrator directly — enforces, in this fixed
 * order, every gate a Skill can declare (existence → permission → role →
 * feature flag → approval) before a single token is spent, then hands off
 * to `runSkillCompletion` for the actual provider/prompt/context/output
 * pipeline. Mirrors `executeAITool`'s own enforcement-order precedent.
 */
export async function executeSkill(params: ExecuteSkillParams): Promise<SkillExecutionResult> {
  const skill = getSkill(params.skillId);
  if (!skill) {
    return { success: false, error: { category: "invalid_request", message: `No Skill is registered for "${params.skillId}".` } };
  }
  if (!skill.execute) {
    return { success: false, error: { category: "invalid_request", message: "This Skill isn't available yet." } };
  }
  if (skill.requiredPermissions.some((permission) => !params.permissions.includes(permission))) {
    getLogger().warn("Skill execution denied — missing permission", { skillId: skill.id });
    return { success: false, error: { category: "permission_denied", message: "You don't have permission to run this Skill." } };
  }
  if (skill.minimumRole && (!params.role || !roleMeetsMinimum(params.role, skill.minimumRole))) {
    getLogger().warn("Skill execution denied — role below minimum", { skillId: skill.id, minimumRole: skill.minimumRole });
    return { success: false, error: { category: "permission_denied", message: "Your role doesn't allow running this Skill." } };
  }
  if (skill.featureFlag) {
    const enabled = await evaluateFeatureFlag(params.workspaceId, skill.featureFlag);
    if (!enabled) {
      getLogger().warn("Skill execution denied — feature flag disabled", { skillId: skill.id, featureFlag: skill.featureFlag });
      return { success: false, error: { category: "invalid_request", message: "This Skill isn't enabled for this Workspace yet." } };
    }
  }
  if (skill.requiresApproval && !params.approved) {
    return { success: false, error: { category: "approval_required", message: "This Skill requires explicit approval before it can run." } };
  }

  getLogger().info("Skill execution requested", { skillId: skill.id, useCaseId: skill.useCaseId });
  const result = await skill.execute({
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName ?? null,
    userId: params.userId,
    userName: params.userName ?? null,
    refs: params.refs,
    input: params.input,
    approved: params.approved,
  });
  getLogger().info("Skill execution finished", {
    skillId: skill.id,
    success: result.success,
    ...(result.success
      ? { provider: result.metadata.provider, latencyMs: result.metadata.latencyMs, mock: result.metadata.mock }
      : { category: result.error.category }),
  });
  return result;
}

export interface RunSkillCompletionParams {
  skill: SkillDefinition;
  workspaceId: string;
  workspaceName: string | null;
  userId: string;
  userName: string | null;
  refs: Record<string, string | undefined>;
  input?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * The actual "Prompt Registry → Context Orchestrator → AI Runtime →
 * Provider → Structured Output" pipeline, existing exactly once — every
 * executable Skill's own `execute` calls this rather than reimplementing
 * any of it. The only per-Skill inputs are already-declarative fields
 * (`useCaseId`, `requiredContext`, `contextFactsKey`, `createMockProvider`)
 * plus whatever the linked `AIUseCaseDefinition.composeContext` does with
 * the assembled sections — never a feature-specific branch inside this
 * function itself.
 */
export async function runSkillCompletion(params: RunSkillCompletionParams): Promise<SkillExecutionResult> {
  const routed = routeAIUseCase(params.skill.useCaseId);
  if (!routed.success) {
    return { success: false, error: { category: "invalid_request", message: "Bloom AI couldn't process this request right now." } };
  }

  const sectionsToRequest = [
    ...new Set<AIContextSectionKey>(["workspace", "user", ...params.skill.requiredContext, ...(params.skill.optionalContext ?? [])]),
  ];
  let assembled;
  try {
    assembled = await assembleAIContext({
      workspaceId: params.workspaceId,
      sections: sectionsToRequest,
      refs: { ...params.refs, workspaceName: params.workspaceName ?? undefined, userId: params.userId, userName: params.userName ?? undefined },
    });
  } catch {
    return { success: false, error: { category: "provider_failure", message: "Bloom AI couldn't gather this request's context right now." } };
  }

  for (const key of params.skill.requiredContext) {
    if (assembled.sections[key] === undefined) {
      return {
        success: false,
        error: { category: "context_unavailable", message: "This item isn't available. It may not exist, or you may not have access to it." },
      };
    }
  }

  const context = routed.useCase.composeContext ? routed.useCase.composeContext(assembled.sections) : assembled.sections;
  const prompt = routed.useCase.buildMessages(context, params.input);
  const mock = !isAIConfigured();
  const provider = getAIProvider() ?? params.skill.createMockProvider?.();
  if (!provider) {
    return { success: false, error: { category: "unavailable_provider", message: "No AI provider is currently available for this Skill." } };
  }

  // Safe fields only — never the prompt text or context facts themselves (see runtime.ts's identical rule).
  const estimatedTokens = prompt.reduce((sum, message) => sum + estimateTokens(message.content), 0);
  getLogger().info("AI use case invoked", { useCaseId: params.skill.useCaseId, promptVersion: routed.useCase.promptVersion, estimatedTokens, mock });

  const now = new Date().toISOString();
  const conversation = {
    id: randomUUID(),
    workspaceId: params.workspaceId,
    context: {
      workspaceId: params.workspaceId,
      ownerType: "event" as const,
      ownerId: params.refs.eventId ?? params.workspaceId,
      facts: { [params.skill.contextFactsKey]: context },
    },
    messages: prompt,
    createdAt: now,
    updatedAt: now,
  };

  const runtimeResult = await executeAIRequest({
    provider,
    completionRequest: { conversation, prompt: prompt[prompt.length - 1] },
    timeoutMs: params.timeoutMs ?? 20_000,
    maxRetries: params.maxRetries ?? 0,
    useCaseId: params.skill.useCaseId,
  });
  if (!runtimeResult.success) {
    return { success: false, error: { category: runtimeResult.error.category, message: "Bloom AI couldn't complete this request right now." } };
  }

  const parsed = parseStructuredOutput(runtimeResult.completion.content, routed.useCase.outputSchema);
  if (!parsed.success) {
    getLogger().warn("AI use case output failed validation", { useCaseId: params.skill.useCaseId, category: parsed.error.category });
    return { success: false, error: parsed.error };
  }

  let validatedData: unknown = parsed.data;
  if (routed.useCase.semanticValidate) {
    const composeValidate = routed.useCase.semanticValidate;
    const validated = applySemanticValidation(parsed.data, (value) => composeValidate(value, context));
    if (!validated.success) {
      getLogger().warn("AI use case output failed validation", { useCaseId: params.skill.useCaseId, category: validated.error.category });
      return { success: false, error: validated.error };
    }
    validatedData = validated.data;
  }
  getLogger().info("AI use case output validated", { useCaseId: params.skill.useCaseId });

  return {
    success: true,
    data: validatedData,
    context,
    metadata: {
      skillId: params.skill.id,
      useCaseId: params.skill.useCaseId,
      provider: runtimeResult.metadata.providerId,
      model: runtimeResult.completion.model,
      promptVersion: routed.useCase.promptVersion,
      mock,
      latencyMs: runtimeResult.metadata.latencyMs,
      generatedAt: now,
    },
  };
}
