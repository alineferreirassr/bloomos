import type { ClientExtensionSummary } from "@/types/clientExtensions";

/**
 * Returns an empty summary today — every field is a real, typed shape (see
 * `types/clientExtensions.ts`) with nothing behind it yet, since Leads/
 * Events/Finance/Documents/Bloom AI integration is explicitly deferred.
 * Both `mockClientsRepository` and `supabaseClientsRepository` call this
 * exact function (identical behavior in both data modes, since there's no
 * data source to diverge on yet) — wiring in a real integration later means
 * changing this one function, never either repository's exported shape.
 */
export async function getClientExtensionSummary(_clientId: string): Promise<ClientExtensionSummary> {
  return {
    proposalHistory: [],
    eventHistory: null,
    paymentSummary: null,
    documentSummary: null,
    communicationHistory: [],
    aiProfileSummary: null,
  };
}
