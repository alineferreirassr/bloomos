import { fetchFinanceAssistantMaterials } from "@/modules/ai/financeAssistant/fetchFinanceAssistantContext.server";
import { buildFinanceAssistantContext } from "@/modules/ai/financeAssistant/contextBuilder";
import type { AIContextBuilder } from "@/core/ai/context/types";

/**
 * Wraps the workspace-wide Finance context pipeline
 * (`fetchFinanceAssistantMaterials` + `buildFinanceAssistantContext`) as a
 * registered Context Orchestrator section — the same "wrap the fetch
 * pipeline as one builder" shape `crmAssistantContextBuilder.ts` already
 * uses. Lives in `modules/ai/financeAssistant`, not `core/ai/context/builders`,
 * for the same reason `crmAssistantContextBuilder`/`dailyBriefContextBuilder`
 * do: it depends on feature-specific modules `core/ai` must never import.
 */
export const financeAssistantContextBuilder: AIContextBuilder = {
  key: "financeAssistantContext",
  priority: 6,
  async build({ workspaceId }) {
    const materials = await fetchFinanceAssistantMaterials(workspaceId);
    const context = buildFinanceAssistantContext(materials);
    return { data: context, source: "fetchFinanceAssistantMaterials+buildFinanceAssistantContext" };
  },
};
