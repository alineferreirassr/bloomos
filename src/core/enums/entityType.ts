export const ENTITY_TYPES = [
  "lead",
  "client",
  "event",
  "contract",
  "invoice",
  "payment",
  "expense",
  "document",
  "document_folder",
  "workspace",
  "team_kb_article",
  "client_kb_article",
  "notification",
  "automation",
  // Reserved ahead of the modules themselves — same precedent as
  // team_kb_article/client_kb_article/notification/automation above — so
  // Core's Search registry (src/core/search/defaultRegistrations.ts) can
  // register a placeholder entry for Inventory/Vendors now, without a
  // second enum edit once those modules actually ship.
  //
  // "inventory_item" (not "inventory") — every other value here names one
  // specific record an owner_id can point at ("client" = one Client row,
  // "document" = one Document row), never a module as a whole. An
  // InventoryItem row is the thing Notes/Timeline/Tags/Attachments actually
  // attach to, matching what docs/database.md's Documents section already
  // anticipated ("supplier/inventory_item/team_member" reserved owner
  // types) before the Inventory Foundation phase existed.
  "inventory_item",
  "vendor",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
