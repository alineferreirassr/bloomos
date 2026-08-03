import type { AIMemoryRepository } from "@/lib/data/core/aiMemory/repository";
import { mockAIMemoryRepository } from "@/lib/data/core/aiMemory/mockRepository";

export {
  AI_MEMORY_CATEGORIES,
} from "@/types/aiMemory";
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
} from "@/types/aiMemory";
export type { AIMemoryRepository } from "@/lib/data/core/aiMemory/repository";
export { getMemoryManager } from "@/core/ai/memory/manager";
export type { AIMemoryManager, MemoryWriteOptions } from "@/core/ai/memory/manager";
export { shouldRemember, defaultApprovalStatusFor, computeDefaultExpiresAt } from "@/core/ai/memory/policies";

/**
 * The raw Knowledge Store accessor — mock-only this phase, same
 * "architecture before a consuming feature needs persistence" precedent as
 * `core/tags`/`core/comments`/`core/audit`/`core/featureFlags`. Prefer
 * `getMemoryManager()` for anything beyond a raw persistence call — it
 * applies Memory Policies and observability logging this accessor
 * deliberately does not.
 */
export function getCoreAIMemoryService(): AIMemoryRepository {
  return mockAIMemoryRepository;
}
