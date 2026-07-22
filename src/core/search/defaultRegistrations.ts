import { registerSearchableEntity } from "@/core/search/registry";

/**
 * Registers every entity type the task asked Search to support — the seven
 * live modules with real routes, plus Inventory/Vendors reserved ahead of
 * those modules existing (see `core/enums/entityType.ts`'s "inventory_item"/
 * "vendor" values). Calling this is opt-in (see `core/index.ts`) rather
 * than a module-load side effect, so importing anything from `core/search`
 * never has a hidden effect on an unrelated import.
 */
export function registerDefaultSearchableEntities(): void {
  registerSearchableEntity({ entityType: "lead", label: "Lead", module: "CRM", route: (id) => `/leads/${id}` });
  registerSearchableEntity({ entityType: "client", label: "Client", module: "CRM", route: (id) => `/clients/${id}` });
  registerSearchableEntity({ entityType: "event", label: "Event", module: "Events", route: (id) => `/events/${id}` });
  registerSearchableEntity({ entityType: "document", label: "Document", module: "Documents", route: (id) => `/documents/${id}` });
  registerSearchableEntity({ entityType: "invoice", label: "Invoice", module: "Finance", route: (id) => `/finance/invoices/${id}` });
  registerSearchableEntity({ entityType: "payment", label: "Payment", module: "Finance", route: (id) => `/finance/payments/${id}` });
  registerSearchableEntity({ entityType: "expense", label: "Expense", module: "Finance", route: (id) => `/finance/expenses/${id}` });

  // Reserved — no route until these modules ship (see entityType.ts's comment on "inventory_item"/"vendor").
  registerSearchableEntity({ entityType: "inventory_item", label: "Inventory Item", module: "Inventory" });
  registerSearchableEntity({ entityType: "vendor", label: "Vendor", module: "Vendors" });
}
