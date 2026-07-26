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
  // Purchases Foundation phase — reserved the same way inventory_item/vendor
  // were: no live route or migration yet, added now so Notes/Timeline/
  // Search/Audit can type-check against it ahead of the UI/migration phases.
  "purchase",
  // Finance Repository Layer phase — needed so Core Audit Log's
  // recordAuditEvent() can type-check ownerType for Journal Entry and
  // Accounting Period mutations (Manual Adjustment, Reversal, period
  // create/close/lock). timeline_activities_owner_type_check already
  // widened to include "accounting_period" during the Posting Engine
  // phase; "journal_entry" needs no equivalent DB widening since nothing
  // writes a Timeline row owned by one yet, only Audit entries.
  "journal_entry",
  "accounting_period",
  // Services Foundation phase (Phase 2a) — "service" is the catalog/
  // blueprint identity (Notes/Timeline about the general offering);
  // "event_service" is one specific booking instance (Notes/Timeline about
  // this Service on this Event specifically) — same "parent gets its own
  // owner type, subordinate child rows don't" precedent as
  // purchase/purchase_item: every service_* template table and every
  // event_service_* instance-child table stays subordinate, never its own
  // EntityType.
  "service",
  "event_service",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
