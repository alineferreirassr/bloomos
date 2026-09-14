import type { AIGeneration } from "@/types/aiGeneration";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readAIGenerations, writeAIGenerations } from "@/lib/data/mock/aiGenerationsStore";
import type { AIGenerationRepository } from "@/lib/data/aiGeneration/repository";
import type { CreateAIGenerationInput, ListAIGenerationsFilters } from "@/types/aiGeneration";

const AI_GENERATION_NOT_FOUND_ERROR = "This AI generation could not be found.";
const ALREADY_REVIEWED_ERROR = "This AI generation has already been reviewed.";

/** Mirrors `listScriptVersions`' own deterministic-tie-break shape, but newest-first by `generation_number` — strictly increasing with creation order, so no `created_at` tie-break is needed. */
function sortNewestFirst(items: AIGeneration[]): AIGeneration[] {
  return [...items].sort((a, b) => b.generation_number - a.generation_number);
}

async function createAIGeneration(input: CreateAIGenerationInput): Promise<DataResult<AIGeneration>> {
  const items = readAIGenerations();
  const priorForSameUseCase = items.filter(
    (g) => g.source_entity_type === input.sourceEntityType && g.source_entity_id === input.sourceEntityId && g.use_case_id === input.useCaseId,
  );
  const nextGenerationNumber = priorForSameUseCase.length > 0 ? Math.max(...priorForSameUseCase.map((g) => g.generation_number)) + 1 : 1;

  const timestamp = nowIso();
  const generation: AIGeneration = {
    id: generateId("ai_generation"),
    workspace_id: input.workspaceId,
    source_entity_type: input.sourceEntityType,
    source_entity_id: input.sourceEntityId,
    use_case_id: input.useCaseId,
    skill_id: input.skillId,
    generation_number: nextGenerationNumber,
    input: input.input,
    output: input.output,
    provider_id: input.providerId,
    model: input.model,
    prompt_version: input.promptVersion,
    is_mock: input.isMock,
    latency_ms: input.latencyMs,
    confidence: input.confidence,
    approval_status: "proposed",
    reviewed_by: null,
    reviewed_at: null,
    archived_at: null,
    created_by: input.createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeAIGenerations([...items, generation]);
  return ok(generation);
}

async function getAIGenerationById(id: string): Promise<AIGeneration> {
  const generation = readAIGenerations().find((g) => g.id === id);
  if (!generation) throw new Error(AI_GENERATION_NOT_FOUND_ERROR);
  return generation;
}

async function listAIGenerations(workspaceId: string, filters: ListAIGenerationsFilters = {}): Promise<AIGeneration[]> {
  const { sourceEntityType, sourceEntityId, useCaseId, approvalStatus, archived = "active", limit = 50, offset = 0 } = filters;

  const filtered = readAIGenerations().filter((g) => {
    if (g.workspace_id !== workspaceId) return false;
    if (sourceEntityType && g.source_entity_type !== sourceEntityType) return false;
    if (sourceEntityId && g.source_entity_id !== sourceEntityId) return false;
    if (useCaseId && g.use_case_id !== useCaseId) return false;
    if (approvalStatus && g.approval_status !== approvalStatus) return false;
    if (archived === "active" && g.archived_at !== null) return false;
    if (archived === "archived" && g.archived_at === null) return false;
    return true;
  });

  return sortNewestFirst(filtered).slice(offset, offset + limit);
}

async function approveAIGeneration(id: string, reviewerId: string): Promise<DataResult<AIGeneration>> {
  const items = readAIGenerations();
  const existing = items.find((g) => g.id === id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.approval_status !== "proposed") return fail(ALREADY_REVIEWED_ERROR);

  const timestamp = nowIso();
  const updated: AIGeneration = { ...existing, approval_status: "approved", reviewed_by: reviewerId, reviewed_at: timestamp, updated_at: timestamp };
  writeAIGenerations(items.map((g) => (g.id === id ? updated : g)));
  return ok(updated);
}

async function rejectAIGeneration(id: string, reviewerId: string): Promise<DataResult<AIGeneration>> {
  const items = readAIGenerations();
  const existing = items.find((g) => g.id === id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.approval_status !== "proposed") return fail(ALREADY_REVIEWED_ERROR);

  const timestamp = nowIso();
  const updated: AIGeneration = { ...existing, approval_status: "rejected", reviewed_by: reviewerId, reviewed_at: timestamp, updated_at: timestamp };
  writeAIGenerations(items.map((g) => (g.id === id ? updated : g)));
  return ok(updated);
}

async function archiveAIGeneration(id: string): Promise<DataResult<AIGeneration>> {
  const items = readAIGenerations();
  const existing = items.find((g) => g.id === id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.archived_at !== null) return ok(existing);

  const updated: AIGeneration = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  writeAIGenerations(items.map((g) => (g.id === id ? updated : g)));
  return ok(updated);
}

async function unarchiveAIGeneration(id: string): Promise<DataResult<AIGeneration>> {
  const items = readAIGenerations();
  const existing = items.find((g) => g.id === id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.archived_at === null) return ok(existing);

  const updated: AIGeneration = { ...existing, archived_at: null, updated_at: nowIso() };
  writeAIGenerations(items.map((g) => (g.id === id ? updated : g)));
  return ok(updated);
}

export const mockAIGenerationRepository: AIGenerationRepository = {
  createAIGeneration,
  getAIGenerationById,
  listAIGenerations,
  approveAIGeneration,
  rejectAIGeneration,
  archiveAIGeneration,
  unarchiveAIGeneration,
};
