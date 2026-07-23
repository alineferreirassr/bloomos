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
}
