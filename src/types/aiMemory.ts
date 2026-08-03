import type { EntityType } from "@/core/enums/entityType";

/** `"workspace"` memories apply to every AI request in that Workspace; `"user"` memories are scoped to one specific member within it. */
export type AIMemoryVisibility = "workspace" | "user";

/**
 * A skill-proposed memory may only ever start as `"proposed"` — a human
 * reviewer's explicit `approveMemory`/`rejectMemory` call is the only path
 * to `"approved"`/`"rejected"`, matching `PRODUCT_PRINCIPLES.md` #4's
 * "assist, not replace": the model suggests what's worth remembering, it
 * never decides. A system-generated snapshot (e.g. a Daily Brief's own
 * historical record) may be created directly as `"approved"` — see
 * `AIMemorySource` — since nothing about it is a model's own free-text
 * suggestion needing review. `"archived"`/`"expired"` are terminal states
 * reached only through the Memory Manager's own `archiveMemory`/
 * `expireStaleMemories`, never a direct write.
 */
export type AIMemoryApprovalStatus = "proposed" | "approved" | "rejected" | "archived" | "expired";

/** How much this memory should weigh in a future lookup/summary — `low`-importance memories are the ones `expireStaleMemories` reclaims first (see `policies.ts`). */
export type AIMemoryImportance = "low" | "medium" | "high";

/**
 * Who created this memory — never inferred from `skill_id` alone, since a
 * human can also write one directly (e.g. approving a proposal via a
 * review UI). `"skill"` = a Skill's own `execute` proposed or wrote it
 * (`skill_id` is then non-null); `"system"` = a deterministic snapshot with
 * no model judgment involved (e.g. Daily Brief's own historical record);
 * `"human"` = a Workspace member wrote it directly, not through any Skill.
 */
export type AIMemorySource = "skill" | "system" | "human";

/**
 * The Knowledge Store's five categories (Step 4) — every memory belongs to
 * exactly one. `workspace_knowledge` = durable facts about how this
 * Workspace operates (preferences, policies a human recorded);
 * `operational_knowledge` = a specific operational decision or outcome
 * (e.g. "this Contract was expedited because..."); `ai_generated_knowledge`
 * = a model's own proposed insight, always born `"proposed"`;
 * `reference_knowledge` = a stable fact worth citing repeatedly (rarely
 * expires); `historical_knowledge` = a point-in-time snapshot a future
 * Skill run can diff against (e.g. a prior Daily Brief's own summary).
 */
export const AI_MEMORY_CATEGORIES = [
  "workspace_knowledge",
  "operational_knowledge",
  "ai_generated_knowledge",
  "reference_knowledge",
  "historical_knowledge",
] as const;
export type AIMemoryCategory = (typeof AI_MEMORY_CATEGORIES)[number];

/**
 * The shared, structured memory entity every Skill may optionally read or
 * write through the Memory Manager (`core/ai/memory/manager.ts`) — never a
 * raw prompt, never a raw provider response (see that file's own doc
 * comment for why). `entity_type`/`entity_id` name what real BloomOS record
 * this memory is *about* (the same "subject, not identity" pattern
 * `Notification.related_owner_type`/`related_owner_id` already uses) —
 * `null` for a Workspace-wide memory with no single subject.
 */
export interface AIMemoryEntry {
  id: string;
  workspace_id: string;
  /** Which Skill created this memory, if any — `null` for a human-authored entry. */
  skill_id: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  title: string;
  summary: string;
  category: AIMemoryCategory;
  importance: AIMemoryImportance;
  visibility: AIMemoryVisibility;
  /** The specific member this memory applies to when `visibility` is `"user"`; `null` for `"workspace"`-visible memories. */
  user_id: string | null;
  tags: string[];
  /** 0–100 — how confident the source is in this memory, never the model's own self-reported confidence for anything else (see `docs/memory.md`). */
  confidence: number;
  source: AIMemorySource;
  approval_status: AIMemoryApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** `null` means "never auto-expires" — reserved for `reference_knowledge`/high-importance entries. */
  expires_at: string | null;
}

/** Input to `proposeMemory` — a Skill's own suggestion, always born `approval_status: "proposed"`. Mirrors `AIMemoryEntry`'s field names, minus everything the Manager computes itself. */
export interface AIMemoryProposal {
  skillId: string;
  entityType?: EntityType | null;
  entityId?: string | null;
  title: string;
  summary: string;
  category?: AIMemoryCategory;
  visibility: AIMemoryVisibility;
  /** Required when `visibility` is `"user"`; ignored for `"workspace"`. */
  userId?: string | null;
  tags?: string[];
  confidence?: number;
}

/** Input to `createMemory` — the general-purpose write path, used for system/human-authored entries that may skip review entirely (see `AIMemoryApprovalStatus`'s own doc comment). */
export interface CreateAIMemoryInput {
  skillId: string | null;
  entityType?: EntityType | null;
  entityId?: string | null;
  title: string;
  summary: string;
  category: AIMemoryCategory;
  importance: AIMemoryImportance;
  visibility: AIMemoryVisibility;
  userId?: string | null;
  tags?: string[];
  confidence: number;
  source: AIMemorySource;
  /** Defaults to `"proposed"` — only a `"system"`-sourced entry should ever pass `"approved"` directly (see `policies.ts`'s `defaultApprovalStatusFor`). */
  approvalStatus?: AIMemoryApprovalStatus;
  expiresAt?: string | null;
}

/** Input to `updateMemory` — deliberately narrow: only the fields a human curating memory (or a policy re-scoring importance) should ever revise. Category, visibility, and workspace/skill/entity linkage are immutable once created. */
export interface UpdateAIMemoryInput {
  title?: string;
  summary?: string;
  importance?: AIMemoryImportance;
  tags?: string[];
  expiresAt?: string | null;
}

/** Every filter is AND-combined except `tags`, which is any-match. `includeExpired`/`includeArchived` default to `false` — a lookup that doesn't ask for stale memory shouldn't have to see it. */
export interface AIMemoryFilter {
  category?: AIMemoryCategory;
  entityType?: EntityType;
  entityId?: string;
  skillId?: string;
  importance?: AIMemoryImportance;
  tags?: string[];
  approvalStatus?: AIMemoryApprovalStatus;
  visibility?: AIMemoryVisibility;
  userId?: string;
  includeExpired?: boolean;
  includeArchived?: boolean;
}

/** The Dashboard's own "Knowledge Statistics" + "Memory Health" view — computed fresh by `summarizeMemories`, never persisted. */
export interface AIMemorySummary {
  totalCount: number;
  byCategory: Record<AIMemoryCategory, number>;
  byImportance: Record<AIMemoryImportance, number>;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  archivedCount: number;
  expiredCount: number;
}
