import { getMemoryManager } from "@/core/ai/memory";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";
import type { AIMemoryCategory, AIMemoryImportance } from "@/types/aiMemory";

export const CREATE_MEMORY_ACTION_ID = "create-memory";

/**
 * A genuine, working action — reuses `getMemoryManager()` (Checkpoint 6)
 * directly. `source: "system"` (auto-approved, no model judgment involved
 * — the same rule Daily Brief's own memory-writing loop already
 * established), so this never needs a human review step of its own.
 */
const createMemoryAction: AutomationActionDefinition = {
  id: CREATE_MEMORY_ACTION_ID,
  name: "Create Memory",
  description: "Records a structured operational memory entry via the shared Memory Layer.",
  category: "memory",
  version: "automation-action-create-memory-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const title = params.facts.title;
    const summary = params.facts.summary;
    if (typeof title !== "string" || typeof summary !== "string") {
      return { success: false, message: "Missing title or summary in the trigger's own facts." };
    }

    const category: AIMemoryCategory = typeof params.facts.category === "string" ? (params.facts.category as AIMemoryCategory) : "operational_knowledge";
    const importance: AIMemoryImportance = typeof params.facts.importance === "string" ? (params.facts.importance as AIMemoryImportance) : "low";

    const result = await getMemoryManager().createMemory(params.workspaceId, {
      skillId: null,
      title,
      summary,
      category,
      importance,
      visibility: "workspace",
      confidence: 100,
      source: "system",
    });

    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Memory "${title}" recorded.` };
  },
};

export default createMemoryAction;
