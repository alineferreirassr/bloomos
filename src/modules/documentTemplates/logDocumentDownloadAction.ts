"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getLogger } from "@/core/observability/logger";

/** Step 17's own "Track: ...download" — a thin logging call the Document viewer's own Download button fires before the browser-side export runs. Never logs the document's own content, only its id. */
export async function logDocumentDownloadAction(documentId: string): Promise<void> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return;
  getLogger().info("Document downloaded", { documentId, workspaceId: session.workspace.id });
}
