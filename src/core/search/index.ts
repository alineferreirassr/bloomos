export type { SearchableEntityConfig, SearchResult, SearchQuery, SearchProvider } from "@/core/search/types";
export { registerSearchableEntity, getSearchableEntities, getSearchableEntityConfig, isEntitySearchable } from "@/core/search/registry";
export { registerDefaultSearchableEntities } from "@/core/search/defaultRegistrations";
export { nullSearchProvider, getActiveSearchProvider, setActiveSearchProvider } from "@/core/search/service";
export { rankSearchResults, runSearch } from "@/core/search/pipeline";
