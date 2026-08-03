/**
 * The full set of context domains a future AI use case might need.
 * `workspace`/`user`/`event` got a real builder in Checkpoint 2; `client`
 * and `eventServiceAssignment` got theirs in Checkpoint 3 (the Proposal
 * Generator, see `modules/ai/contextBuilders/`) — `service`/`finance`/
 * `contract`/`blueprint` remain reserved so a use case can already declare
 * "I'll need `finance` context" ahead of that builder existing, without
 * every consuming type needing a later breaking change.
 *
 * `proposalContext` is the Proposal Generator's own composite section
 * (Event/Venue fields, Timeline Summary, Consultation Notes, existing
 * Contract payment terms) — it doesn't decompose cleanly into the six
 * generic domain keys above, the same way Checkpoint 2's `event` key
 * already holds a feature-specific shape (`EventOperationsBriefContext`)
 * rather than a generic "raw Event fields" utility. `dailyBriefContext`
 * (Checkpoint 5) is the same idea at workspace scope rather than
 * per-Event/per-Client — a single composite aggregate (today's/this week's
 * Events, late payments, unsigned contracts, checklist progress, team
 * assignments, high-priority clients, calendar summary, recent activity,
 * upcoming deadlines) that doesn't decompose into the generic keys either,
 * since no other use case needs a workspace-wide cross-entity rollup. A
 * future use case is free to add its own similarly-named composite key
 * rather than force a shape into a generic key it doesn't actually fit.
 *
 * `memory` (Checkpoint 6) is different in kind from every key above: it's
 * the one section every Skill may request *optionally* — see
 * `SkillDefinition.optionalContext` (`core/ai/skills/types.ts`) — backed by
 * the shared Memory Manager (`core/ai/memory/manager.ts`) rather than a
 * single feature's own data. A Skill that never lists it in either
 * `requiredContext` or `optionalContext` never triggers a memory lookup at
 * all — memory is additive, never a dependency the platform imposes.
 *
 * `crmAssistantContext` (Checkpoint 7) is `dailyBriefContext`'s same
 * "workspace-wide composite that doesn't decompose into the generic keys"
 * shape, scoped to Clients/Leads/Events/Contracts/Invoices/Proposals rather
 * than Daily Brief's own operational categories — see
 * `modules/ai/crmAssistant/contextBuilder.ts`. `financeAssistantContext`
 * (Checkpoint 8) is the same idea again, scoped to Invoices/Payments/
 * Contracts/Proposals/Events for revenue and cash-flow reporting — see
 * `modules/ai/financeAssistant/contextBuilder.ts`. This is also the first
 * checkpoint where one Skill's own composite section
 * (`crmAssistantContext`) is itself requested, optionally, by a *different*
 * Skill (Finance Assistant) — proving the Context Orchestrator's sections
 * compose across Skills, not just within one.
 */
export const AI_CONTEXT_SECTION_KEYS = [
  "workspace",
  "user",
  "event",
  "client",
  "service",
  "eventServiceAssignment",
  "finance",
  "contract",
  "blueprint",
  "proposalContext",
  "dailyBriefContext",
  "memory",
  "crmAssistantContext",
  "financeAssistantContext",
  "analyticsSummaryContext",
] as const;

export type AIContextSectionKey = (typeof AI_CONTEXT_SECTION_KEYS)[number];

export interface AIContextBuildParams {
  workspaceId: string;
  /**
   * A loose id/value bag each builder reads its own keys from (e.g.
   * `eventId`, `userName`). Sections vary too widely in what they need for a
   * single typed shape to fit all nine, and only three exist yet — a shared
   * `Record` keeps adding a tenth section from requiring a signature change
   * here.
   */
  refs: Record<string, string | undefined>;
}

export interface AIContextSectionResult {
  data: unknown;
  /** Where this section's facts came from (a function name, a repository call) — surfaced in `AIContextAssemblyResult.provenance` so a caller never has to guess. */
  source: string;
}

export interface AIContextBuilder {
  key: AIContextSectionKey;
  /** Passed straight through to `applyTokenBudget`'s section priority — lower survives truncation first. */
  priority: number;
  /** Returns `null` when the section has nothing to contribute (e.g. a ref id was omitted) or isn't visible to this workspace — never partially-populated data. */
  build: (params: AIContextBuildParams) => Promise<AIContextSectionResult | null>;
}
