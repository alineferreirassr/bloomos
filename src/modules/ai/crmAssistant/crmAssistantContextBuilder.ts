import { fetchCrmAssistantMaterials } from "@/modules/ai/crmAssistant/fetchCrmAssistantContext.server";
import { buildCrmAssistantContext } from "@/modules/ai/crmAssistant/contextBuilder";
import type { AIContextBuilder } from "@/core/ai/context/types";

/**
 * Wraps the workspace-wide CRM context pipeline
 * (`fetchCrmAssistantMaterials` + `buildCrmAssistantContext`) as a
 * registered Context Orchestrator section — the same "wrap the fetch
 * pipeline as one builder" shape `dailyBriefContextBuilder.ts` already
 * uses. Lives in `modules/ai/crmAssistant`, not `core/ai/context/builders`,
 * for the same reason `dailyBriefContextBuilder` does: it depends on
 * feature-specific modules `core/ai` must never import.
 */
export const crmAssistantContextBuilder: AIContextBuilder = {
  key: "crmAssistantContext",
  priority: 5,
  async build({ workspaceId }) {
    const materials = await fetchCrmAssistantMaterials(workspaceId);
    const context = buildCrmAssistantContext(materials);
    return { data: context, source: "fetchCrmAssistantMaterials+buildCrmAssistantContext" };
  },
};
