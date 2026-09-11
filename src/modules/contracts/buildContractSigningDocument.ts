import type { Contract } from "@/types/contract";
import type { DocumentBlock } from "@/types/documentPlatform";

/**
 * CONTRACTS-02 — the one content mapping from a real Contract's own plain
 * fields (title/description/notes) to a `DocumentBlock[]` tree, shared by
 * every consumer of the Shared PDF Renderer (core/documents/pdfRenderer.ts)
 * that renders this Contract: the DocuSign signing request
 * (sendContractForSignatureAction) and both PDF-download endpoints
 * (internal Contract Detail, Client Portal). Never duplicate this mapping —
 * a second copy is exactly how the signed PDF and the downloaded PDF could
 * silently drift apart.
 */
export function buildContractSigningDocument(contract: Contract): DocumentBlock[] {
  const blocks: DocumentBlock[] = [{ id: "title", type: "heading", level: 1, runs: [{ text: contract.title }] }];
  if (contract.description) blocks.push({ id: "description", type: "paragraph", runs: [{ text: contract.description }] });
  if (contract.notes) blocks.push({ id: "notes", type: "paragraph", runs: [{ text: contract.notes }] });
  return blocks;
}
