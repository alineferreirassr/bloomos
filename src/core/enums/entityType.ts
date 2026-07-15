export const ENTITY_TYPES = [
  "lead",
  "client",
  "event",
  "contract",
  "invoice",
  "payment",
  "expense",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
