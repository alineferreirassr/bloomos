import type { ZodType } from "zod";
import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { AICapability } from "@/core/ai/capabilities";
import type { AIContextSectionKey } from "@/core/ai/context/types";
import type { AIProvider } from "@/core/ai/types";
import type { AIErrorCategory } from "@/core/ai/errors";

/**
 * Kept as a flat, curated list — the same "small closed set over a clever
 * structure" bias `AICapability` already uses. Extend this list rather than
 * letting a Skill declare an arbitrary string, so the Bloom AI Dashboard's
 * category grouping never has to handle an unbounded set of labels.
 */
export const SKILL_CATEGORIES = ["proposal", "operations", "crm", "finance", "documents", "briefing"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export interface SkillExecuteParams {
  workspaceId: string;
  workspaceName: string | null;
  userId: string;
  userName: string | null;
  /** Same loose id/value bag `AIContextBuildParams.refs` already uses — `eventId`, `clientId`, etc. */
  refs: Record<string, string | undefined>;
  input?: unknown;
  /** Only meaningful when the Skill declares `requiresApproval: true` — mirrors `AIToolExecutionContext.approved`. */
  approved?: boolean;
}

export interface SkillExecutionMetadata {
  skillId: string;
  useCaseId: string;
  provider: string;
  model: string;
  promptVersion: string;
  mock: boolean;
  latencyMs: number;
  generatedAt: string;
}

export interface SkillExecutionError {
  category: AIErrorCategory;
  message: string;
}

export type SkillExecutionResult<T = unknown> =
  | { success: true; data: T; context: unknown; metadata: SkillExecutionMetadata }
  | { success: false; error: SkillExecutionError };

export type SkillExecuteFn = (params: SkillExecuteParams) => Promise<SkillExecutionResult>;

/**
 * The typed contract every AI capability in BloomOS must declare — a
 * Proposal Generator, an Event Operations Brief, and a not-yet-built CRM
 * Assistant are all, structurally, just one of these. Nothing here
 * describes *how* to call a provider or build a prompt beyond a pointer
 * (`useCaseId`) into the Prompt Registry that already owns that — a Skill
 * is metadata plus, only for a genuinely executable one, one `execute`
 * function. See `docs/skills.md` for the full life cycle.
 *
 * `execute` is the one field that decides "Coming Soon" vs. runnable: a
 * placeholder Skill (CRM Assistant, Finance Assistant, Document Assistant,
 * Daily Brief) is registered with every other field filled in honestly but
 * `execute` left `undefined` — every discovery surface (Bloom AI Dashboard,
 * Skill Picker, `executeSkill` itself) treats its absence as the single
 * source of truth for availability, never a separate `status` flag that
 * could drift out of sync with what the Skill can actually do.
 */
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  requiredPermissions: Permission[];
  requiredContext: AIContextSectionKey[];
  /**
   * Checkpoint 6, Step 6: sections `runSkillCompletion` requests alongside
   * `requiredContext` but never hard-fails on — a Skill that declares
   * `["memory"]` here still runs perfectly well the first time a Workspace
   * has no memory at all (the section is simply absent from
   * `composeContext`'s input). `requiredContext` and `optionalContext`
   * share the same `AIContextSectionKey` space; the only difference is
   * which loop in `resolver.ts` checks for the section's presence.
   * Defaults to `[]` when omitted — no existing Skill needed to change to
   * adopt this field.
   */
  optionalContext?: AIContextSectionKey[];
  useCaseId: string;
  outputSchema: ZodType;
  supportedProviders: string[] | "any";
  requiredCapabilities: AICapability[];
  supportsStreaming: boolean;
  requiresApproval: boolean;
  requiresReview: boolean;
  commandPaletteVisible: boolean;
  sidebarVisible: boolean;
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  /** Defaults to the linked use case's own `promptVersion` when surfaced via `getSkillMetadata` — kept here too so a Skill's version can be read without a second Prompt Registry lookup. */
  version: string;
  estimatedLatencyMs: number | null;
  /**
   * Only ever read by `runSkillCompletion` (`core/ai/skills/resolver.ts`) to
   * key the `AICompletionRequest.conversation.context.facts` object — every
   * existing mock provider (`createMockAIProvider`, `createProposalMockAIProvider`)
   * already reads its own fixed key off that object and has its own
   * pre-existing test suite asserting that exact shape, so this stays a
   * per-Skill declared constant rather than a computed one.
   */
  contextFactsKey: string;
  /** Zero-arg factory for this Skill's deterministic development stand-in — called only when `isAIConfigured()` is false. `undefined` for a placeholder Skill (there's nothing to demo yet). */
  createMockProvider?: () => AIProvider;
  execute?: SkillExecuteFn;
}

/** The Step 7 "Skill Metadata" view — combines a Skill's own static declaration with what's true about it right now (its live provider, computed status). Never persisted; always computed fresh by `getSkillMetadata`. */
export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  status: "active" | "coming_soon";
  version: string;
  provider: string | null;
  promptVersion: string;
  capabilities: AICapability[];
  estimatedLatencyMs: number | null;
  requiresApproval: boolean;
  requiresReview: boolean;
  /** Whether a live (non-mock) provider is currently configured for this Skill — distinct from `status`, which only reflects whether the Skill has an `execute` function at all. */
  availability: "live" | "mock" | "unavailable";
}
