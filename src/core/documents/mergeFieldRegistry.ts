import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * Step 4's own Merge Field Registry — the declarative half of the Merge
 * Engine. Mirrors `core/settings/registry.ts`'s own `Map<id, definition>`
 * shape exactly. Registering a `MergeFieldDefinition` here only describes
 * the field (key/label/domain/type); `core/documents/mergeEngine.ts` is the
 * separate place a resolver function actually produces its value — the
 * same "declaration separate from resolution" split `SettingDefinition`
 * established for Settings.
 */
const mergeFields = new Map<string, MergeFieldDefinition>();

export function registerMergeField(definition: MergeFieldDefinition): void {
  mergeFields.set(definition.key, definition);
}

export function unregisterMergeField(key: string): void {
  mergeFields.delete(key);
}

export function getMergeField(key: string): MergeFieldDefinition | undefined {
  return mergeFields.get(key);
}

export function listMergeFields(): MergeFieldDefinition[] {
  return [...mergeFields.values()];
}

export function listMergeFieldsByDomain(domain: MergeFieldDefinition["domain"]): MergeFieldDefinition[] {
  return listMergeFields().filter((field) => field.domain === domain);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetMergeFieldRegistry(): void {
  mergeFields.clear();
}
