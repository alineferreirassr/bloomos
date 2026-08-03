import { registerSuggestionProvider } from "@/core/ai/copilot/suggestionEngine";
import { crmSuggestionProvider } from "@/modules/ai/copilot/suggestions/crmSuggestions";
import { financeSuggestionProvider } from "@/modules/ai/copilot/suggestions/financeSuggestions";
import { inventorySuggestionProvider } from "@/modules/ai/copilot/suggestions/inventorySuggestions";
import { eventsSuggestionProvider } from "@/modules/ai/copilot/suggestions/eventsSuggestions";

let registered = false;

/** Idempotent, same guard shape `registerAutomationActions()`/`registerDefaultAIContextBuilders()` already use — safe to call from every server entry point that needs the Suggestion Engine populated. */
export function registerDefaultSuggestionProviders(): void {
  if (registered) return;
  registerSuggestionProvider(crmSuggestionProvider);
  registerSuggestionProvider(financeSuggestionProvider);
  registerSuggestionProvider(inventorySuggestionProvider);
  registerSuggestionProvider(eventsSuggestionProvider);
  registered = true;
}
