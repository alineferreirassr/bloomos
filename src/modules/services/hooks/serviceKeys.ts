import type { ServiceFilters } from "@/lib/data/services/repository";
import type { ServicesCatalogFilters } from "@/lib/queries/services/types";

/**
 * The one centralized key factory every Services hook must use — no hook
 * file is allowed to build its own key array inline, so there is exactly
 * one place that could disagree about what a given piece of cached data is
 * called.
 *
 * `assignmentWorkspace`/`eventService`/`eventServiceWorkspace` deliberately
 * root under `"events"`/`"eventServices"`, not `"services"` — they
 * represent Event-owned or Instance-layer data, not catalog data.
 * Invalidating every `serviceKeys.all`-prefixed key (a catalog-side
 * mutation) must never touch an already-assigned EventService's cached
 * workspace, and vice versa — see the invalidation matrix in the mutation
 * hooks for why that separation matters.
 *
 * Filter objects are never spread into a key as-is (an unstable object
 * reference, or one with a different subset of optional keys set, would
 * produce a different key for what should be the same cache entry).
 * `normalizeFilters` rebuilds a complete, defaulted, plain object every
 * call so the same logical filter always serializes to the same key
 * regardless of which optional fields the caller happened to pass.
 */
function normalizeFilters(filters: ServiceFilters = {}) {
  return {
    status: filters.status ?? "all",
    categoryId: filters.categoryId ?? "all",
    includeArchived: filters.includeArchived ?? false,
    search: filters.search?.trim() ?? "",
  } as const;
}

/** Extends `normalizeFilters` with the two query-layer-only dimensions (`usage`/`sortBy`) — catalog() and search() are the only keys that ever see these, since Health Dashboard has no usage/sort UI of its own. */
function normalizeCatalogFilters(filters: ServicesCatalogFilters = {}) {
  return {
    ...normalizeFilters(filters),
    usage: filters.usage ?? "all",
    sortBy: filters.sortBy ?? null,
  } as const;
}

export const serviceKeys = {
  all: ["services"] as const,

  lists: () => [...serviceKeys.all, "list"] as const,
  catalog: (filters: ServicesCatalogFilters = {}) => [...serviceKeys.lists(), "catalog", normalizeCatalogFilters(filters)] as const,
  search: (query: string, options: { limit?: number; usage?: ServicesCatalogFilters["usage"]; sortBy?: ServicesCatalogFilters["sortBy"] } = {}) =>
    [...serviceKeys.lists(), "search", query.trim(), options.limit ?? null, options.usage ?? "all", options.sortBy ?? null] as const,

  categories: () => [...serviceKeys.all, "categories"] as const,

  details: () => [...serviceKeys.all, "detail"] as const,
  detail: (serviceId: string) => [...serviceKeys.details(), serviceId] as const,
  editor: (serviceId: string) => [...serviceKeys.detail(serviceId), "editor"] as const,
  versions: (serviceId: string) => [...serviceKeys.detail(serviceId), "versions"] as const,
  publishPreview: (serviceId: string) => [...serviceKeys.detail(serviceId), "publishPreview"] as const,
  health: (serviceId: string) => [...serviceKeys.detail(serviceId), "health"] as const,
  assignments: (serviceId: string) => [...serviceKeys.detail(serviceId), "assignments"] as const,

  // `healthDashboards()` (no filters) is the broad family key a status/
  // category mutation invalidates; `healthDashboard(filters)` (exact) is
  // what the hook itself queries with.
  healthDashboards: () => [...serviceKeys.all, "healthDashboard"] as const,
  healthDashboard: (filters: ServiceFilters = {}) => [...serviceKeys.healthDashboards(), normalizeFilters(filters)] as const,

  // Rooted on the version id, not the service id — a Template Builder query
  // is inherently version-scoped (a draft and its predecessor published
  // version have entirely independent rows), so it can never be reached via
  // a `serviceKeys.detail(serviceId)` prefix invalidation alone.
  templates: (serviceVersionId: string) => [...serviceKeys.all, "templates", serviceVersionId] as const,

  assignmentWorkspace: (eventId: string) => ["events", eventId, "assignmentWorkspace"] as const,
  // Add-on selection order never changes the result, so it's sorted before
  // entering the key — picking the same two add-ons in a different order
  // must hit the same cache entry, not create a second one.
  assignmentPreview: (serviceId: string, selectedAddOnIds: string[]) => [...serviceKeys.all, "assignmentPreview", serviceId, [...selectedAddOnIds].sort()] as const,

  eventService: (eventServiceId: string) => ["eventServices", eventServiceId] as const,
  eventServiceWorkspace: (eventServiceId: string) => [...serviceKeys.eventService(eventServiceId), "workspace"] as const,
  // Kept separate from eventServiceWorkspace() rather than folded into it —
  // checking off one checklist item should only ever invalidate the small
  // checklist list, not force a refetch of team/inventory/questionnaire/
  // notes/timeline the rest of the Workspace already has cached.
  eventServiceChecklist: (eventServiceId: string) => [...serviceKeys.eventService(eventServiceId), "checklist"] as const,
};
