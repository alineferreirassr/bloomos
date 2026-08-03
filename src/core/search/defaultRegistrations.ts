import { registerSearchableEntity } from "@/core/search/registry";

/**
 * Registers every entity type the task asked Search to support, each with
 * a route to its detail page. Calling this is opt-in (see `core/index.ts`)
 * rather than a module-load side effect, so importing anything from
 * `core/search` never has a hidden effect on an unrelated import.
 */
export function registerDefaultSearchableEntities(): void {
  registerSearchableEntity({ entityType: "lead", label: "Lead", module: "CRM", route: (id) => `/leads/${id}` });
  registerSearchableEntity({ entityType: "client", label: "Client", module: "CRM", route: (id) => `/clients/${id}` });
  registerSearchableEntity({ entityType: "event", label: "Event", module: "Events", route: (id) => `/events/${id}` });
  registerSearchableEntity({ entityType: "document", label: "Document", module: "Documents", route: (id) => `/documents/${id}` });
  registerSearchableEntity({ entityType: "invoice", label: "Invoice", module: "Finance", route: (id) => `/finance/invoices/${id}` });
  registerSearchableEntity({ entityType: "payment", label: "Payment", module: "Finance", route: (id) => `/finance/payments/${id}` });
  registerSearchableEntity({ entityType: "expense", label: "Expense", module: "Finance", route: (id) => `/finance/expenses/${id}` });

  registerSearchableEntity({ entityType: "inventory_item", label: "Inventory Item", module: "Inventory", route: (id) => `/inventory/${id}` });
  registerSearchableEntity({ entityType: "vendor", label: "Vendor", module: "Vendors", route: (id) => `/vendors/${id}` });

  // Purchases UI Foundation phase — the module now has a live route.
  registerSearchableEntity({ entityType: "purchase", label: "Purchase", module: "Purchases", route: (id) => `/purchases/${id}` });

  // v2.0 Checkpoint 38 — Smart Workspace Platform. `contract` was never
  // registered despite `/contracts/[id]` existing since Checkpoint 34 —
  // the Workspace's own Global Search is the first caller to actually
  // execute a search (see `workspaceSearchProvider.ts`), which is what
  // surfaced the gap. `media_asset`/`team_member` are genuinely new
  // registrations this checkpoint adds alongside its own search provider.
  registerSearchableEntity({ entityType: "contract", label: "Contract", module: "CRM", route: (id) => `/contracts/${id}` });
  registerSearchableEntity({ entityType: "media_asset", label: "Asset", module: "Digital Assets", route: (id) => `/assets/${id}` });
  registerSearchableEntity({ entityType: "team_member", label: "Team Member", module: "Team", route: () => `/team` });

  // v2.0 Checkpoint 40 — Global Search & Universal Command Center. Every
  // entry below just filled `EntityType`'s own gap list (see
  // `core/enums/entityType.ts`'s own Checkpoint 40 comment) with a real
  // route — `decision`/`objective`/`resource_bundle` route to their real
  // dashboard rather than a per-item detail page, since none of the three
  // has one (confirmed against the route catalog before writing this),
  // the same "no fake link" precedent `team_member` above already set.
  registerSearchableEntity({ entityType: "proposal", label: "Proposal", module: "CRM", route: (id) => `/proposals/${id}` });
  registerSearchableEntity({ entityType: "workflow", label: "Workflow", module: "Automation", route: (id) => `/workflows/${id}` });
  registerSearchableEntity({ entityType: "decision", label: "Executive Decision", module: "Executive", route: () => `/assets/executive-decisions` });
  registerSearchableEntity({ entityType: "objective", label: "Objective", module: "Executive", route: () => `/assets/business-health` });
  registerSearchableEntity({ entityType: "dispatch_order", label: "Dispatch Order", module: "Operations", route: (id) => `/dispatch/${id}` });
  registerSearchableEntity({ entityType: "route_plan", label: "Route Plan", module: "Operations", route: (id) => `/route-optimization/${id}` });
  registerSearchableEntity({ entityType: "operational_plan", label: "Operational Plan", module: "Operations", route: (id) => `/operational-planning/plans/${id}` });
  registerSearchableEntity({ entityType: "execution_package", label: "Execution Package", module: "Operations", route: (id) => `/execution-packages/${id}` });
  registerSearchableEntity({ entityType: "resource_bundle", label: "Resource Bundle", module: "Operations", route: () => `/allocations/bundles` });

  // Checkpoint 45A — Worker/Team/Equipment/Vehicle have been real EntityTypes
  // and Knowledge Graph nodes since Checkpoint 26 but were never registered
  // here, an undisclosed gap the Checkpoint 45 Step 0 audit surfaced. Worker
  // has its own detail route (`/assets/workforce/workers/[id]`); Team/
  // Equipment/Vehicle have no per-item detail page, so they route to the
  // Workforce Dashboard — the same "no fake link" precedent `resource_bundle`/
  // `decision`/`objective` above already established.
  registerSearchableEntity({ entityType: "worker", label: "Worker", module: "Workforce", route: (id) => `/assets/workforce/workers/${id}` });
  registerSearchableEntity({ entityType: "team", label: "Team", module: "Workforce", route: () => `/assets/workforce` });
  registerSearchableEntity({ entityType: "equipment", label: "Equipment", module: "Workforce", route: () => `/assets/workforce` });
  registerSearchableEntity({ entityType: "vehicle", label: "Vehicle", module: "Workforce", route: () => `/assets/workforce` });
}
