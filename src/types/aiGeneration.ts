/**
 * SOCIAL-09B — AI Content Intelligence's own durable generation-record
 * domain, deliberately separate from `AIMemoryEntry`
 * (`src/types/aiMemory.ts`): the Knowledge Store persists curated,
 * cross-cutting operational facts a Skill or human decided are worth
 * remembering; this table persists the actual generated output of one AI
 * use-case run, scoped to exactly the Idea/Inspiration/Script record that
 * asked for it. Every row is immutable once written (see the migration's
 * own `reject_ai_generation_content_mutation` trigger) — regeneration
 * always creates a new row, never edits a prior one. See SOCIAL-09A's own
 * Section D for why this shape was chosen over attaching AI state directly
 * to Idea/Inspiration/Script.
 */
export const AI_GENERATION_SOURCE_ENTITY_TYPES = ["idea_item", "inspiration_item", "script_item"] as const;
export type AIGenerationSourceEntityType = (typeof AI_GENERATION_SOURCE_ENTITY_TYPES)[number];

/**
 * Every generation is born `"proposed"` — mirrors `AIMemoryEntry`'s own
 * "model suggests, human decides" policy (never auto-approved) — but is its
 * own, narrower type rather than a re-export of `AIMemoryApprovalStatus`:
 * this domain uses a separate `archived_at` column for lifecycle
 * housekeeping (matching Idea/Inspiration/Script's own convention, since
 * this table sits directly alongside those three), so it has no need for
 * AIMemory's own conflated `"archived"`/`"expired"` approval states.
 */
export const AI_GENERATION_APPROVAL_STATUSES = ["proposed", "approved", "rejected"] as const;
export type AIGenerationApprovalStatus = (typeof AI_GENERATION_APPROVAL_STATUSES)[number];

export interface AIGeneration {
  id: string;
  workspace_id: string;
  /** Polymorphic reference, paired with `source_entity_id` — the same `owner_type`/`owner_id` pattern already established by `media_assets`/`notes`/`checklist_items`, scoped to just the three domains SOCIAL-09A's own data-signal audit identified. */
  source_entity_type: AIGenerationSourceEntityType;
  source_entity_id: string;
  /** Points into the AI Use Case Registry (`core/ai/prompts/registry.ts`) — a free-form id, not a DB FK, matching how Skills/use cases are registered in-memory rather than as rows. */
  use_case_id: string;
  /** Which Skill produced this, if any — `null` when a generation was persisted without going through the Skill wrapper. */
  skill_id: string | null;
  /** 1-based, unique per `(source_entity_type, source_entity_id, use_case_id)` — see the migration's own `ai_generations_source_use_case_number_unique` index. Regenerating always assigns the next number; a prior generation's own row is never edited. */
  generation_number: number;
  /**
   * Whatever shape this use case's own input contract defines. The existing
   * AI platform contract already treats this as untyped at exactly this
   * boundary (`AIUseCaseDefinition.buildMessages(context: unknown, input:
   * unknown)`, `SkillExecuteParams.input?: unknown`) — a single fixed set
   * of typed columns cannot safely express every future use case's own
   * input shape, so JSONB is the deliberate, narrowly-scoped exception
   * SOCIAL-09B was authorized to use here.
   */
  input: Record<string, unknown>;
  /** Same justification as `input` above — `AIUseCaseDefinition.outputSchema`/`SkillDefinition.outputSchema` is a per-use-case Zod schema, not one fixed shape. */
  output: Record<string, unknown>;
  provider_id: string;
  model: string;
  prompt_version: string;
  /** Always `true` today — SOCIAL-09A confirmed no live AI provider is configured anywhere in BloomOS; this checkpoint's own mock-only repository never persists `false`. Kept as a real column (not hardcoded) so a future checkpoint that plugs in a live provider needs no schema change. */
  is_mock: boolean;
  latency_ms: number;
  /** 0–100, matching `AIMemoryEntry.confidence`'s own convention exactly. `null` when this use case doesn't report one. */
  confidence: number | null;
  approval_status: AIGenerationApprovalStatus;
  /** Set together with `reviewed_at`, exactly once, the moment a human approves or rejects — enforced by the migration's own `ai_generations_review_fields_consistency_check`. */
  reviewed_by: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Input to `createAIGeneration` — the general-purpose write path. Never called with a real provider's output today (see `is_mock`'s own doc comment above); the persistence layer itself never calls any AI provider. */
export interface CreateAIGenerationInput {
  workspaceId: string;
  createdBy: string | null;
  sourceEntityType: AIGenerationSourceEntityType;
  sourceEntityId: string;
  useCaseId: string;
  skillId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  providerId: string;
  model: string;
  promptVersion: string;
  isMock: boolean;
  latencyMs: number;
  confidence: number | null;
}

export type AIGenerationArchivedFilter = "active" | "archived" | "all";

export interface ListAIGenerationsFilters {
  sourceEntityType?: AIGenerationSourceEntityType;
  sourceEntityId?: string;
  useCaseId?: string;
  approvalStatus?: AIGenerationApprovalStatus;
  /** Defaults to "active" — an archived generation never appears in a plain list unless explicitly asked for, matching Idea/Script's own `ScriptArchivedFilter` convention. */
  archived?: AIGenerationArchivedFilter;
  limit?: number;
  offset?: number;
}
