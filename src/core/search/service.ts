import type { SearchProvider, SearchQuery, SearchResult } from "@/core/search/types";

/**
 * The default `SearchProvider` — satisfies the interface (so anything
 * calling `getActiveSearchProvider().search(...)` today gets a well-typed
 * empty result instead of a missing function) without indexing anything.
 * "Create the architecture, don't implement indexing yet" — this is the
 * literal embodiment of that instruction. Swapping in a real implementation
 * later is a call to `setActiveSearchProvider`, not a change to any caller.
 */
export const nullSearchProvider: SearchProvider = {
  async search(_query: SearchQuery): Promise<SearchResult[]> {
    return [];
  },
};

let activeProvider: SearchProvider = nullSearchProvider;

export function setActiveSearchProvider(provider: SearchProvider): void {
  activeProvider = provider;
}

export function getActiveSearchProvider(): SearchProvider {
  return activeProvider;
}
