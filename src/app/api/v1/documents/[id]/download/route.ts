import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getDocumentsManager } from "@/core/documents/manager";
import { blocksToPlainText } from "@/core/documents/exportPlainText";
import { renderDocumentToPdf } from "@/core/documents/pdfRenderer";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import { applyBrandingToDocument } from "@/core/branding/applyBrandingToDocument";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/**
 * Checkpoint 16, Step 6 — `GET /api/v1/documents/:id/download`. `documents.read` scope.
 * Default response stays the original plain-text JSON envelope (`blocksToPlainText()`,
 * unchanged). `?format=pdf` is v2 Checkpoint 44 Step 3's own first real consumer of the
 * Shared PDF Renderer (`core/documents/pdfRenderer.ts`) — it streams a real `application/pdf`
 * binary built from the same compiled `content`, branded via `getWorkspaceBranding()` +
 * `applyBrandingToDocument()` (Step 1). No second PDF code path exists anywhere else.
 */
export const GET = createApiHandler<{ id: string }>("documents.read", async (request, _auth, { id }): Promise<NextResponse> => {
  const document = await getDocumentsManager().getComposedDocumentById(id);
  if (!document) throw new ApiError("not_found", `No document with id "${id}" was found.`);

  const format = new URL(request.url).searchParams.get("format");
  if (format === "pdf") {
    const branding = await getWorkspaceBranding(document.workspaceId);
    const brandTheme = applyBrandingToDocument(branding);
    const pdfBytes = await renderDocumentToPdf(document.content, {
      documentTitle: document.metadata.title,
      brandTheme,
      mode: document.status === "published" ? "print" : "preview",
    });
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.metadata.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "document"}.pdf"`,
      },
    });
  }

  return apiSuccess({ id: document.id, title: document.metadata.title, text: blocksToPlainText(document.content) });
});
