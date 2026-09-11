import { NextResponse } from "next/server";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getContract } from "@/lib/data";
import { buildContractSigningDocument } from "@/modules/contracts/buildContractSigningDocument";
import { renderDocumentToPdf } from "@/core/documents/pdfRenderer";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import { applyBrandingToDocument } from "@/core/branding/applyBrandingToDocument";

export const dynamic = "force-dynamic";

/**
 * CONTRACTS-02 — `GET /api/contracts/:id/pdf`. Internal Contract Detail's
 * own PDF download, cookie-session-authenticated exactly like every other
 * server-side data access in this codebase (`resolveMemberSessionSnapshot`),
 * not the api-key-scoped `/api/v1` surface. Renders through the same
 * `buildContractSigningDocument` + Shared PDF Renderer the DocuSign signing
 * request itself uses — never a second content mapping, so this download
 * can never drift from what a client was asked to sign.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contracts.view")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const contract = await getContract(id).catch(() => null);
  if (!contract || contract.workspace_id !== session.workspace.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const branding = await getWorkspaceBranding(session.workspace.id);
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
