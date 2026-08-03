export type { AIProvider, AIConversation, AIPrompt, AIContext, AICompletion, AICompletionRequest } from "@/core/ai/types";
export { registerAIProvider, getAIProvider, isAIConfigured } from "@/core/ai/registry";

export { AI_CAPABILITIES } from "@/core/ai/capabilities";
export type { AICapability } from "@/core/ai/capabilities";

export {
  registerAIProviderEntry,
  unregisterAIProviderEntry,
  getRegisteredAIProviderEntry,
  listRegisteredAIProviders,
  setDefaultAIProviderId,
  getDefaultAIProviderId,
  setAIProviderHealth,
  resetAIProviderRegistry,
  selectAIProviders,
} from "@/core/ai/providerRegistry";
export type {
  RegisteredAIProvider,
  RegisterAIProviderInput,
  AIProviderAvailability,
  AIProviderHealth,
  SelectAIProviderOptions,
} from "@/core/ai/providerRegistry";

export { AI_ERROR_CATEGORIES, isRetryableCategory } from "@/core/ai/errors";
export type { AIErrorCategory, AIError } from "@/core/ai/errors";

export { executeAIRequest } from "@/core/ai/runtime/runtime";
export { computeBackoffDelayMs } from "@/core/ai/runtime/retry";
export type { AIRuntimeRequest, AIRuntimeExecutionMetadata, AIRuntimeResult } from "@/core/ai/runtime/types";

export { estimateTokens, applyTokenBudget } from "@/core/ai/tokenBudget";
export type { TokenBudgetConfig, TokenBudgetSectionConfig, TruncationResult } from "@/core/ai/tokenBudget";

export { parseStructuredOutput, applySemanticValidation } from "@/core/ai/structuredOutput";
export type { StructuredOutputResult } from "@/core/ai/structuredOutput";

export { registerAIUseCase, getAIUseCase, listAIUseCases, resetAIUseCaseRegistry } from "@/core/ai/prompts/registry";
export { routeAIUseCase } from "@/core/ai/prompts/router";
export type { AIUseCaseDefinition, AIHumanApprovalPolicy } from "@/core/ai/prompts/types";
export type { RouteAIUseCaseResult } from "@/core/ai/prompts/router";

export { AI_CONTEXT_SECTION_KEYS } from "@/core/ai/context/types";
export type { AIContextSectionKey, AIContextBuilder, AIContextBuildParams, AIContextSectionResult } from "@/core/ai/context/types";
export { registerAIContextBuilder, getAIContextBuilder, listAIContextBuilders, resetAIContextRegistry } from "@/core/ai/context/registry";
export { assembleAIContext } from "@/core/ai/context/orchestrator";
export type { AIContextRequest, AIContextAssemblyResult } from "@/core/ai/context/orchestrator";

export { registerAITool, getAITool, listAITools, resetAIToolRegistry } from "@/core/ai/tools/registry";
export { executeAITool } from "@/core/ai/tools/executeTool";
export type { AIToolDefinition, AIToolApprovalPolicy, AIToolExecutionContext } from "@/core/ai/tools/types";
export type { AIToolExecutionResult } from "@/core/ai/tools/executeTool";

export { getCoreAIMemoryService, getMemoryManager, AI_MEMORY_CATEGORIES } from "@/core/ai/memory";
export type {
  AIMemoryVisibility,
  AIMemoryApprovalStatus,
  AIMemoryImportance,
  AIMemorySource,
  AIMemoryCategory,
  AIMemoryEntry,
  AIMemoryProposal,
  CreateAIMemoryInput,
  UpdateAIMemoryInput,
  AIMemoryFilter,
  AIMemorySummary,
  AIMemoryRepository,
  AIMemoryManager,
} from "@/core/ai/memory";

export { SKILL_CATEGORIES } from "@/core/ai/skills/types";
export type {
  SkillCategory,
  SkillDefinition,
  SkillMetadata,
  SkillExecuteFn,
  SkillExecuteParams,
  SkillExecutionResult,
  SkillExecutionMetadata,
  SkillExecutionError,
} from "@/core/ai/skills/types";
export { registerSkill, unregisterSkill, getSkill, listSkills, listSkillsByCategory, resetSkillRegistry } from "@/core/ai/skills/registry";
export { executeSkill, runSkillCompletion } from "@/core/ai/skills/resolver";
export type { ExecuteSkillParams, RunSkillCompletionParams } from "@/core/ai/skills/resolver";
export { listSkillsForWorkspace, getSkillMetadata } from "@/core/ai/skills/discovery";
export type { ListSkillsForWorkspaceParams } from "@/core/ai/skills/discovery";
export { registerSkillRunner, unregisterSkillRunner, getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
export { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
export type { SkillErrorMessages } from "@/core/ai/skills/errorMapping";
