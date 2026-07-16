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
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
