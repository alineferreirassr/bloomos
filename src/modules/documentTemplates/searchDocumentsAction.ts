"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { searchDocuments, type DocumentSearchResult } from "@/core/documents/search";

/** Step 15's own Global Document Search, wrapped as a Server Action — scopes both Templates and Documents to the acting member's own Workspace before ranking, the same "no permission logic inside the pure search function itself" split `searchSettingsAction` already established. */
export async function searchDocumentsAction(query: string): Promise<DocumentSearchResult[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const manager = getDocumentsManager();
  const [templates, documents] = await Promise.all([manager.listTemplates(session.workspace.id), manager.listComposedDocuments(session.workspace.id)]);

  return searchDocuments(query, templates, documents);
}
