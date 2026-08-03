import type { DocumentTypeDefinition } from "@/types/documentPlatform";

/**
 * Step 2's own Template Registry — "every document type registers itself,"
 * "future document types register automatically." The same open,
 * `Map<id, definition>` shape every registry in this codebase already uses
 * (`core/settings/sectionRegistry.ts`, `core/workflow/nodeRegistry.ts`). A
 * "document type" here is the organizational category (`"contract"`,
 * `"proposal"`, …) — never a specific authored `Template`, which is
 * persisted data (`core/documents/manager.ts`), not a code registration.
 */
const documentTypes = new Map<string, DocumentTypeDefinition>();

export function registerDocumentType(definition: DocumentTypeDefinition): void {
  documentTypes.set(definition.id, definition);
}

export function unregisterDocumentType(id: string): void {
  documentTypes.delete(id);
}

export function getDocumentType(id: string): DocumentTypeDefinition | undefined {
  return documentTypes.get(id);
}

/** Every registered document type, sorted alphabetically by label — the one stable ordering the Template Library's own type filter uses. */
export function listDocumentTypes(): DocumentTypeDefinition[] {
  return [...documentTypes.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Test-only: restore the registry to empty between test cases. */
export function resetDocumentTypeRegistry(): void {
  documentTypes.clear();
}
