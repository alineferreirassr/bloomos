import type { AIGeneration, CreateAIGenerationInput, ListAIGenerationsFilters } from "@/types/aiGeneration";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapAIGenerationRow } from "@/lib/supabase/mappers";
import type { AIGenerationRepository } from "@/lib/data/aiGeneration/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

const AI_GENERATION_NOT_FOUND_ERROR = "This AI generation could not be found.";
const ALREADY_REVIEWED_ERROR = "This AI generation has already been reviewed.";
const UNIQUE_VIOLATION = "23505";
/** Mirrors the DB's own `ai_generations_source_use_case_number_unique` index — a race between two concurrent creates for the exact same (source entity, use case) pair. No retry loop: this checkpoint has no UI trigger for concurrent regeneration, so a controlled "try again" error is the minimal, honest response rather than added retry complexity with nothing yet exercising it. */
const GENERATION_NUMBER_CONFLICT_ERROR = "Another generation was just created for this item. Please try again.";

async function fetchAIGenerationRow(supabase: SupabaseClient, id: string): Promise<AIGeneration | null> {
  const { data, error } = await supabase.from("ai_generations").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapAIGenerationRow(data) : null;
}

/**
 * `generation_number` is computed here (current max + 1 for this
 * `(source_entity_type, source_entity_id, use_case_id)` triple) rather than
 * a DB sequence — mirrors `script_versions`' own app-computed
 * `version_number` convention exactly. The unique index is the concurrency
 * backstop; a genuine race surfaces as a controlled error above, never a
 * raw Postgres constraint violation.
 */
async function nextGenerationNumber(supabase: SupabaseClient, input: CreateAIGenerationInput): Promise<number> {
  const { data, error } = await supabase
    .from("ai_generations")
    .select("generation_number")
    .eq("source_entity_type", input.sourceEntityType)
    .eq("source_entity_id", input.sourceEntityId)
    .eq("use_case_id", input.useCaseId)
    .order("generation_number", { ascending: false })
    .limit(1);
  if (error) throw normalizeSupabaseError(error);
  const highest = data?.[0]?.generation_number ?? 0;
  return highest + 1;
}

async function createAIGeneration(input: CreateAIGenerationInput): Promise<DataResult<AIGeneration>> {
  const supabase = createSupabaseClient();
  const generationNumber = await nextGenerationNumber(supabase, input);

  const { data, error } = await supabase
    .from("ai_generations")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      source_entity_type: input.sourceEntityType,
      source_entity_id: input.sourceEntityId,
      use_case_id: input.useCaseId,
      skill_id: input.skillId,
      generation_number: generationNumber,
      input: input.input,
      output: input.output,
      provider_id: input.providerId,
      model: input.model,
      prompt_version: input.promptVersion,
      is_mock: input.isMock,
      latency_ms: input.latencyMs,
      confidence: input.confidence,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return fail(GENERATION_NUMBER_CONFLICT_ERROR);
    throw normalizeSupabaseError(error);
  }

  return ok(mapAIGenerationRow(data));
}

async function getAIGenerationById(id: string): Promise<AIGeneration> {
  const supabase = createSupabaseClient();
  const generation = await fetchAIGenerationRow(supabase, id);
  if (!generation) throw new Error(`AI generation ${id} was not found`);
  return generation;
}

async function listAIGenerations(workspaceId: string, filters: ListAIGenerationsFilters = {}): Promise<AIGeneration[]> {
  const { sourceEntityType, sourceEntityId, useCaseId, approvalStatus, archived = "active", limit = 50, offset = 0 } = filters;
  const supabase = createSupabaseClient();

  let query = supabase.from("ai_generations").select("*").eq("workspace_id", workspaceId);
  if (sourceEntityType) query = query.eq("source_entity_type", sourceEntityType);
  if (sourceEntityId) query = query.eq("source_entity_id", sourceEntityId);
  if (useCaseId) query = query.eq("use_case_id", useCaseId);
  if (approvalStatus) query = query.eq("approval_status", approvalStatus);
  if (archived === "active") query = query.is("archived_at", null);
  else if (archived === "archived") query = query.not("archived_at", "is", null);

  const { data, error } = await query.order("generation_number", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapAIGenerationRow);
}

async function approveAIGeneration(id: string, reviewerId: string): Promise<DataResult<AIGeneration>> {
  const supabase = createSupabaseClient();
  const existing = await fetchAIGenerationRow(supabase, id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.approval_status !== "proposed") return fail(ALREADY_REVIEWED_ERROR);

  const { data, error } = await supabase
    .from("ai_generations")
    .update({ approval_status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapAIGenerationRow(data));
}

async function rejectAIGeneration(id: string, reviewerId: string): Promise<DataResult<AIGeneration>> {
  const supabase = createSupabaseClient();
  const existing = await fetchAIGenerationRow(supabase, id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.approval_status !== "proposed") return fail(ALREADY_REVIEWED_ERROR);

  const { data, error } = await supabase
    .from("ai_generations")
    .update({ approval_status: "rejected", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapAIGenerationRow(data));
}

async function archiveAIGeneration(id: string): Promise<DataResult<AIGeneration>> {
  const supabase = createSupabaseClient();
  const existing = await fetchAIGenerationRow(supabase, id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.archived_at !== null) return ok(existing);

  const { data, error } = await supabase
    .from("ai_generations")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapAIGenerationRow(data));
}

async function unarchiveAIGeneration(id: string): Promise<DataResult<AIGeneration>> {
  const supabase = createSupabaseClient();
  const existing = await fetchAIGenerationRow(supabase, id);
  if (!existing) return fail(AI_GENERATION_NOT_FOUND_ERROR);
  if (existing.archived_at === null) return ok(existing);

  const { data, error } = await supabase.from("ai_generations").update({ archived_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);
  return ok(mapAIGenerationRow(data));
}

export const supabaseAIGenerationRepository: AIGenerationRepository = {
  createAIGeneration,
  getAIGenerationById,
  listAIGenerations,
  approveAIGeneration,
  rejectAIGeneration,
  archiveAIGeneration,
  unarchiveAIGeneration,
};
