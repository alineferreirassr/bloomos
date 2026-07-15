export const ENTITY_TYPES = ["lead", "client", "event", "contract"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
