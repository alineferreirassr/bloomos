export const ENTITY_TYPES = ["lead", "client", "event"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
