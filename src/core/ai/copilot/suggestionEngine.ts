/**
 * Checkpoint 20, Step 7 — the Suggestion Engine. Generalizes the pattern
 * every list view already established with its own local `build*Insight()`
 * function (`buildLeadsInsight`, `buildEventsInsight`, etc. — see
 * `ModuleInsightCard`'s own doc comment) into one registry a module
 * registers into, so the Copilot Panel can render "what should I do next"
 * for whichever module the user is currently in without importing each
 * module's internals directly. Every provider computes suggestions
 * deterministically from data it already has — never an LLM call, matching
 * this checkpoint's own Step 4 "No LLM required" spirit applied to
 * suggestions too. `actionId`, when present, must name a real
 * `AutomationActionDefinition.id` or Skill id the Action Executor
 * (`core/ai/copilot/actionExecutor.ts`) can actually resolve — a suggestion
 * with no matching action is rendered as information-only, never a dead
 * button.
 */
export interface CopilotSuggestion {
  id: string;
  module: string;
  label: string;
  description: string;
  actionId: string | null;
  /** The exact `facts` bag the named Action's `execute()` expects — required whenever `actionId` is set to something other than `null`, since every Action reads its own inputs from `facts` rather than a positional argument. */
  actionFacts?: Record<string, string | number | boolean | null>;
  tone: "info" | "success" | "warning";
}

export interface SuggestionProviderParams {
  workspaceId: string;
}

export interface SuggestionProvider {
  module: string;
  compute: (params: SuggestionProviderParams) => Promise<CopilotSuggestion[]>;
}

const providers = new Map<string, SuggestionProvider>();

export function registerSuggestionProvider(provider: SuggestionProvider): void {
  providers.set(provider.module, provider);
}

export function unregisterSuggestionProvider(module: string): void {
  providers.delete(module);
}

export function getSuggestionProvider(module: string): SuggestionProvider | undefined {
  return providers.get(module);
}

export function listSuggestionModules(): string[] {
  return [...providers.keys()];
}

/** Test-only: restore the registry to empty between test cases. */
export function resetSuggestionProviderRegistry(): void {
  providers.clear();
}

/** Returns `[]` for a module with no registered provider — never throws, since not every module has suggestions yet. */
export async function computeSuggestionsForModule(module: string, params: SuggestionProviderParams): Promise<CopilotSuggestion[]> {
  const provider = providers.get(module);
  if (!provider) return [];
  return provider.compute(params);
}
