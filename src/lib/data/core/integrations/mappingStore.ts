import { generateId, nowIso } from "@/lib/data/utils";
import type { IntegrationMapping } from "@/core/integrations/types";

/** v2 Checkpoint 43. Mock-only, same precedent as `credentialStore.ts`. */
let mappings: IntegrationMapping[] = [];

export function resetMappingStore(): void {
  mappings = [];
}

export function insertMapping(mapping: IntegrationMapping): IntegrationMapping {
  mappings = [...mappings, mapping];
  return mapping;
}

export function getMappingByExternalId(connectionId: string, externalId: string): IntegrationMapping | null {
  return mappings.find((mapping) => mapping.connection_id === connectionId && mapping.external_id === externalId) ?? null;
}

export function getMappingByInternalEntity(connectionId: string, internalEntityType: string, internalEntityId: string): IntegrationMapping | null {
  return mappings.find((mapping) => mapping.connection_id === connectionId && mapping.internal_entity_type === internalEntityType && mapping.internal_entity_id === internalEntityId) ?? null;
}

export function listMappingsForConnection(connectionId: string): IntegrationMapping[] {
  return mappings.filter((mapping) => mapping.connection_id === connectionId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function updateMappingSyncedAt(id: string, syncedAt: string = nowIso()): IntegrationMapping | null {
  const existing = mappings.find((mapping) => mapping.id === id);
  if (!existing) return null;
  const updated: IntegrationMapping = { ...existing, last_synced_at: syncedAt };
  mappings = mappings.map((mapping) => (mapping.id === id ? updated : mapping));
  return updated;
}

export function generateMappingId(): string {
  return generateId("integration-mapping");
}
