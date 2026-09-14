import type { AIGeneration, CreateAIGenerationInput, ListAIGenerationsFilters } from "@/types/aiGeneration";
import type { DataResult } from "@/lib/data/result";

/**
 * SOCIAL-09B — the production data-access layer for AI Content
 * Intelligence's own generation-record domain. A single-table repository
 * (mirrors Idea/Inspiration's own one-table shape, not Script's combined
 * three-table shape — `ai_generations` is genuinely one table with no
 * version-scoped children).
 *
 * There is no `updateAIGeneration` — `input`/`output`/provider metadata are
 * immutable once created (enforced additionally at the DB layer by the
 * migration's own `reject_ai_generation_content_mutation` trigger); the
 * only mutations this repository exposes are the human-review transition
 * (`approveAIGeneration`/`rejectAIGeneration`) and archive lifecycle
 * (`archiveAIGeneration`/`unarchiveAIGeneration`), matching exactly what
 * the migration's own CHECK constraints allow to change.
 *
 * Workspace ownership for any operation taking an existing `id` is verified
 * by the Action layer's own `loadOwned*` helpers before any of these are
 * called — the exact same trust boundary `loadOwnedScriptItem`/
 * `loadOwnedIdeaItem` already establish — so these methods take only an
 * `id`, never a redundant `workspaceId`, except where the input itself
 * already carries one (create/list calls).
 */
export interface AIGenerationRepository {
  createAIGeneration(input: CreateAIGenerationInput): Promise<DataResult<AIGeneration>>;
  /** Throws if no row with this id exists at all — mirrors `getScriptItemById`/`getIdeaItemById` exactly. Cross-workspace ownership is the caller's own responsibility. */
  getAIGenerationById(id: string): Promise<AIGeneration>;
  listAIGenerations(workspaceId: string, filters?: ListAIGenerationsFilters): Promise<AIGeneration[]>;
  /** Rejects with a controlled "already reviewed" error if `approval_status` isn't currently `"proposed"` — one reviewer decision per generation, never flip-flopped. */
  approveAIGeneration(id: string, reviewerId: string): Promise<DataResult<AIGeneration>>;
  rejectAIGeneration(id: string, reviewerId: string): Promise<DataResult<AIGeneration>>;
  /** Idempotent — archiving an already-archived generation returns it unchanged. Allowed regardless of `approval_status`. */
  archiveAIGeneration(id: string): Promise<DataResult<AIGeneration>>;
  /** Idempotent — unarchiving an already-active generation returns it unchanged. */
  unarchiveAIGeneration(id: string): Promise<DataResult<AIGeneration>>;
}
