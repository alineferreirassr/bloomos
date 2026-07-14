export const ENTITY_TYPES = ["lead", "client"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
