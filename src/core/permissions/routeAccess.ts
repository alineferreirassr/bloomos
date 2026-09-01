import type { Permission } from "@/core/enums/permission";

/**
 * The single source of truth for what a route requires — never scattered
 * per-component. `active-membership` means "any signed-in, active Workspace
 * member may enter" (no specific permission beyond that); `permission` means
 * the member's role must be granted that specific permission
 * (`role_permissions`, see docs/permissions.md).
 */
export type RouteAccessRequirement =
  | { kind: "active-membership" }
  | { kind: "permission"; permission: Permission };

export interface RouteAccessEntry {
  prefix: string;
  requirement: RouteAccessRequirement;
}

/**
 * Ordered by nothing in particular — `getRouteAccessRequirement` matches by
 * longest prefix, so entry order here doesn't affect resolution. `/settings`
 * has no real page yet (reserved for a future Workspace Settings screen);
 * it's modeled here now since section 4 of the Team Portal spec calls for it
 * in the canonical map, matching the same "reserve the shape ahead of the
 * feature" precedent as `core/permissions`/`core/guards` themselves.
 */
export const ROUTE_ACCESS_MAP: RouteAccessEntry[] = [
  // v2.0 Checkpoint 38 — Smart Workspace Platform. Same `active-membership`
  // requirement as `/dashboard` — the new unified home is for every
  // active member; `workspaceActions.ts` itself still checks
  // `workspace.view` per-action as defense in depth.
  { prefix: "/workspace", requirement: { kind: "active-membership" } },
  { prefix: "/dashboard", requirement: { kind: "active-membership" } },
  { prefix: "/account", requirement: { kind: "active-membership" } },
  // AF-inspired Relationships/CRM landing (Checkpoint "Relationships UX
  // Phase 01") — same gate as /clients since the landing surfaces both
  // lead and client data; a member without clients.view has no CRM
  // destination to land on anyway.
  { prefix: "/relationships", requirement: { kind: "permission", permission: "clients.view" } },
  { prefix: "/leads", requirement: { kind: "permission", permission: "leads.view" } },
  { prefix: "/pipeline/commercial", requirement: { kind: "permission", permission: "leads.view" } },
  { prefix: "/pipeline/operational", requirement: { kind: "permission", permission: "events.view" } },
  { prefix: "/clients", requirement: { kind: "permission", permission: "clients.view" } },
  { prefix: "/crm-assistant", requirement: { kind: "permission", permission: "clients.view" } },
  { prefix: "/events", requirement: { kind: "permission", permission: "events.view" } },
  // v2 Checkpoint 21 — the Operations Dashboard spans Events/Inventory/
  // Purchases/Vendors/Finance; gated on events.view (its primary lens),
  // consistent with the Event Command Center living on /events/[id] itself.
  { prefix: "/operations", requirement: { kind: "permission", permission: "events.view" } },
  { prefix: "/contracts", requirement: { kind: "permission", permission: "contracts.view" } },
  { prefix: "/finance", requirement: { kind: "permission", permission: "finance.view" } },
  { prefix: "/documents", requirement: { kind: "permission", permission: "documents.view" } },
  { prefix: "/document-templates", requirement: { kind: "permission", permission: "documents.view" } },
  { prefix: "/team", requirement: { kind: "permission", permission: "team.view" } },
  { prefix: "/client-portal", requirement: { kind: "permission", permission: "clients.portal_view" } },
  { prefix: "/settings", requirement: { kind: "permission", permission: "workspace.manage" } },
  { prefix: "/analytics", requirement: { kind: "permission", permission: "analytics.view" } },
  { prefix: "/developer", requirement: { kind: "permission", permission: "workspace.manage" } },
  { prefix: "/marketplace", requirement: { kind: "permission", permission: "workspace.manage" } },
  // v2 Checkpoint 22 — the Integration Dashboard is a read-only view of the
  // Enterprise Integration Platform; mutation lives on `/developer`'s own
  // Integrations tab, gated the same way.
  { prefix: "/integrations", requirement: { kind: "permission", permission: "workspace.manage" } },
  // v2 Checkpoint 24 — Notification Center, Unified Inbox, Activity Feed,
  // and Internal Messaging all live under one gate: every role down to
  // `staff` gets `communications.view` (see `permissionMatrix.ts`) since
  // the whole point of this checkpoint is that no one needs a side channel
  // to know what's happening.
  { prefix: "/communications", requirement: { kind: "permission", permission: "communications.view" } },
  { prefix: "/inbox", requirement: { kind: "permission", permission: "communications.view" } },
  // v2.0 Checkpoint 41 — Notification Center. A new, dedicated route tree
  // additive to `/communications`'s own `notifications` tab (which keeps
  // working unchanged) — gated by the new, more granular
  // `notifications.view` rather than reusing `communications.view`
  // directly, so a future workspace could grant one without the other.
  // Covers `/notifications`, `/notifications/[id]`, `/notifications/preferences`,
  // and `/notifications/templates` via prefix matching.
  { prefix: "/notifications", requirement: { kind: "permission", permission: "notifications.view" } },
  // v2 Checkpoint 25 — Asset Library, Asset Intelligence, and the Knowledge
  // Graph Explorer all live under `/assets`; per-mutation gating
  // (upload/approve/folder moves) checks `assets.manage` inside each Server
  // Action itself, the same "route view, action-level manage" split
  // `/client-portal` already uses.
  { prefix: "/assets", requirement: { kind: "permission", permission: "assets.view" } },
  // v2.0 Checkpoint 27 — Enterprise Scheduling Platform. Same minimal session-gate discipline `workforceActions.ts`/`capabilityActions.ts` use — `scheduling.manage` exists in `permissionMatrix.ts` for future UI-level gating of create/edit affordances, never checked inline in `schedulingActions.ts` itself.
  { prefix: "/calendar", requirement: { kind: "permission", permission: "scheduling.view" } },
  // v2.0 Checkpoint 27.1 — Resource Allocation Platform. Same discipline — `allocations.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline in `allocationActions.ts` itself. Covers `/allocations`, `/allocations/requests/[id]`, and `/allocations/bundles` via prefix matching.
  { prefix: "/allocations", requirement: { kind: "permission", permission: "allocations.view" } },
  // v2.0 Checkpoint 27.2 — Operational Planning Platform. Same discipline — `operational_planning.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline in `operationalPlanningActions.ts` itself. Named `/operational-planning`, not `/operations` — Checkpoint 21's Operations Dashboard already owns that prefix and is a distinct concept (live event execution vs. reusable execution plans). Covers `/operational-planning`, `/operational-planning/plans/[id]`, and `/operational-planning/templates` via prefix matching.
  { prefix: "/operational-planning", requirement: { kind: "permission", permission: "operational_planning.view" } },
  // v2.0 Checkpoint 27.3 — Execution Package Platform. Same discipline — `execution_packages.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline in `executionPackageActions.ts` itself. Covers `/execution-packages` and `/execution-packages/[id]` via prefix matching.
  { prefix: "/execution-packages", requirement: { kind: "permission", permission: "execution_packages.view" } },
  // v2.0 Checkpoint 28 — Dispatch Platform. Same discipline — `dispatch.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline in `dispatchActions.ts` itself. Covers `/dispatch` and `/dispatch/[id]` via prefix matching.
  { prefix: "/dispatch", requirement: { kind: "permission", permission: "dispatch.view" } },
  // v2.0 Checkpoint 29 — Field Operations Platform. Same discipline — `field_operations.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline in `fieldOperationsActions.ts` itself. Covers `/field-operations` and `/field-operations/[id]` via prefix matching.
  { prefix: "/field-operations", requirement: { kind: "permission", permission: "field_operations.view" } },
  // v2.0 Checkpoint 30 — Route Optimization Platform. Same discipline — `route_optimization.manage` exists in `permissionMatrix.ts` for future UI-level gating, never checked inline in `routeOptimizationActions.ts` itself. Covers `/route-optimization` and `/route-optimization/[id]` via prefix matching.
  { prefix: "/route-optimization", requirement: { kind: "permission", permission: "route_optimization.view" } },
  // v2.0 Checkpoint 31 — Real-Time Operations Center. Same discipline — `operations_center.manage`/`operations_alerts.acknowledge`/`operations_alerts.resolve`/`operations_incidents.manage`/`operations_sensitive_data.view` exist in `permissionMatrix.ts` for future UI-level gating, never checked inline in `operationsCenterActions.ts` itself. Covers `/operations-center`, `/operations-center/alerts/[id]`, and `/operations-center/incidents/[id]` via prefix matching.
  { prefix: "/operations-center", requirement: { kind: "permission", permission: "operations_center.view" } },
  // v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform. Same discipline — `client_journeys.manage`/`.assign`/`.transition`/`client_information_requests.manage`/`client_journey_sensitive_data.view` exist in `permissionMatrix.ts` for future UI-level gating, never checked inline in `clientJourneyActions.ts` itself. Covers `/client-journeys` and `/client-journeys/[id]` via prefix matching.
  { prefix: "/client-journeys", requirement: { kind: "permission", permission: "client_journeys.view" } },
  // v2.0 Checkpoint 33 — Proposal & Quote Platform. Same discipline — `proposal_templates.manage`/`proposal_builder.manage`/`proposal_versions.manage`/`proposal_pricing.manage`/`proposal_packages.manage`/`proposal_addons.manage` exist in `permissionMatrix.ts` for future UI-level gating, never checked inline in `proposalPlatformActions.ts` itself. Covers `/proposals` and `/proposals/[id]` via prefix matching.
  { prefix: "/proposals", requirement: { kind: "permission", permission: "proposal_builder.view" } },
  // v2.0 Checkpoint 34 — Contract Management Platform. No new route entry —
  // `/contracts` and `/contracts/[id]` already exist above, gated by the
  // real `contracts.view`. `contract_templates.view`/`.manage`,
  // `contract_builder.view`/`.manage`, `contract_versions.view`/`.manage`,
  // `contract_clauses.manage`, `contract_variables.manage` exist in
  // `permissionMatrix.ts` for UI-level gating of the new Document/Builder
  // section additive to that same page, never checked inline in
  // `contractPlatformActions.ts` itself — the same discipline every prior
  // checkpoint held to above.
  // v2.0 Checkpoint 35 — Invoice & Billing Platform. Unlike Contract, no
  // `/invoices` route existed before this checkpoint (the real Finance
  // module's own UI lives at `/finance/invoices`) — this is a genuinely new
  // top-level route, the same `/proposals` precedent above. Same
  // discipline — `invoice_templates.manage`/`invoice_builder.manage`/
  // `invoice_versions.manage`/`invoice_adjustments.manage`/
  // `invoice_billing.manage` exist in `permissionMatrix.ts` for future
  // UI-level gating, never checked inline in `invoicePlatformActions.ts`
  // itself. Covers `/invoices` and `/invoices/[id]` via prefix matching.
  { prefix: "/invoices", requirement: { kind: "permission", permission: "invoice_builder.view" } },
  // v2.0 Checkpoint 40 — Global Search & Universal Command Center. Same
  // `active-membership` requirement as `/workspace`/`/dashboard` — every
  // active member gets Search and the Command Center; `searchAction()`
  // itself still filters individual results via this same `canAccessRoute()`
  // ("hidden entities must never appear in search"), and `/search/analytics`
  // needs the more specific `workspace.manage` gate `getSearchAnalyticsAction()`
  // already checks, resolved via longest-prefix match over the general `/search` entry below.
  { prefix: "/command-center", requirement: { kind: "active-membership" } },
  { prefix: "/search/analytics", requirement: { kind: "permission", permission: "workspace.manage" } },
  { prefix: "/search", requirement: { kind: "active-membership" } },
  // v2.0 Checkpoint 42 — Reporting & Business Intelligence Platform. A
  // unified read/presentation layer over every other platform's own data
  // — `/reports/builder` and `/reports/snapshots` need their own narrower
  // gates (composing a report, generating a snapshot), resolved via the
  // same longest-prefix-match precedent `/search/analytics` already
  // established; every other `/reports*` route (library, detail,
  // templates) falls through to the general `reports.view` entry.
  { prefix: "/reports/builder", requirement: { kind: "permission", permission: "reports.build" } },
  { prefix: "/reports/snapshots", requirement: { kind: "permission", permission: "reports.snapshots" } },
  { prefix: "/reports", requirement: { kind: "permission", permission: "reports.view" } },
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Null for a route not listed here — callers treat that as "no specific requirement beyond authentication and active membership," never as "forbidden." */
export function getRouteAccessRequirement(pathname: string): RouteAccessRequirement | null {
  const matches = ROUTE_ACCESS_MAP.filter((entry) => matchesPrefix(pathname, entry.prefix));
  if (matches.length === 0) return null;
  const longest = matches.reduce((best, entry) => (entry.prefix.length > best.prefix.length ? entry : best));
  return longest.requirement;
}

/**
 * Convenience wrapper for anything that just needs a yes/no against a
 * target path and a `can()` predicate — e.g. filtering Dashboard metric
 * cards by the route each one links to (`DashboardMetric.href`), so a card
 * pointing at `/finance` is hidden for a member without `finance.view`
 * without duplicating the permission mapping anywhere else.
 */
export function canAccessRoute(pathname: string, can: (permission: Permission) => boolean): boolean {
  const requirement = getRouteAccessRequirement(pathname);
  if (!requirement || requirement.kind === "active-membership") return true;
  return can(requirement.permission);
}
