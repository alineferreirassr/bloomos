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
  "inventory",
  "vendor",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
