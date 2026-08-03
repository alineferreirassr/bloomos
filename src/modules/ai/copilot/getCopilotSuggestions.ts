import { computeSuggestionsForModule, type CopilotSuggestion } from "@/core/ai/copilot/suggestionEngine";
import { registerDefaultSuggestionProviders } from "@/modules/ai/copilot/suggestions/registerSuggestionProviders";

registerDefaultSuggestionProviders();

/**
 * Checkpoint 20, Step 7 — the one entry point the Copilot Panel calls for
 * "what should I do next" in whichever module the user's current page
 * belongs to. Deliberately a plain client-callable function, not a `"use
 * server"` Server Action: every suggestion provider reads through
 * `@/lib/data` (`getLeads`/`getInvoices`/`getEvents`/...), and those
 * repositories resolve to the *browser* Supabase client in "supabase" data
 * mode (the same constraint `fetchDailyOperationsBriefContext.server.ts`'s
 * own doc comment documents at length) — calling them from a real Server
 * Action would throw "Authentication is required." there. Every existing
 * list view (`LeadsListView`, `EventsListView`, ...) already calls these
 * same functions directly from a `"use client"` component for exactly this
 * reason; the Copilot Panel does the same rather than inventing a second,
 * broken code path. `workspaceId` is accepted from the caller (already
 * available via `useMemberSession()`) rather than resolved here, since
 * `resolveMemberSessionSnapshot()` is itself server-only.
 */
export async function getCopilotSuggestions(module: string | null, workspaceId: string): Promise<CopilotSuggestion[]> {
  if (!module) return [];
  return computeSuggestionsForModule(module, { workspaceId });
}
