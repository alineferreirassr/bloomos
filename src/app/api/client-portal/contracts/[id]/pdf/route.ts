import { NextResponse } from "next/server";
import { getCurrentClientAccountContext, getContract } from "@/lib/data";
import { buildContractSigningDocument } from "@/modules/contracts/buildContractSigningDocument";
import { renderDocumentToPdf } from "@/core/documents/pdfRenderer";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import { applyBrandingToDocument } from "@/core/branding/applyBrandingToDocument";

export const dynamic = "force-dynamic";

/**
 * CONTRACTS-02 — `GET /api/client-portal/contracts/:id/pdf`. The Client
 * Portal's own PDF download, replacing `ClientPortalContractDocumentSection`'s
 * disabled stub. Authorization mirrors `getClientPortalContract.ts`'s own
 * `resolveOwnedPublishedContract` ownership check (own contract only, same
 * workspace_id + client_id) — deliberately WITHOUT its Contract Platform
 * `builderState.status === "published"` gate, since this downloads the real
 * Contract's own signing document (the same one DocuSign sent), not the
 * separate Contract Platform draft. Renders through the identical
 * `buildContractSigningDocument` + Shared PDF Renderer the internal
 * download and the DocuSign signing request both use.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const context = await getCurrentClientAccountContext();
  if (!context) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const contract = await getContract(id).catch(() => null);
  if (!contract || contract.workspace_id !== context.account.workspace_id || contract.client_id !== context.account.client_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const branding = await getWorkspaceBranding(context.account.workspace_id);
  const brandTheme = applyBrandingToDocument(branding);
  const pdfBytes = await renderDocumentToPdf(buildContractSigningDocument(contract), {
    documentTitle: contract.title,
    brandTheme,
    mode: contract.signature_status === "signed" ? "print" : "preview",
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${contract.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "contract"}.pdf"`,
    },
  });
}
