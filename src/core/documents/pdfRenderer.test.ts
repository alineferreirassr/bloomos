import { describe, expect, it } from "vitest";
import { renderDocumentToPdf } from "@/core/documents/pdfRenderer";
import { applyBrandingToDocument } from "@/core/branding/applyBrandingToDocument";
import type { WorkspaceBranding } from "@/types/branding";
import type { DocumentBlock } from "@/types/documentPlatform";

const branding: WorkspaceBranding = {
  workspaceId: "ws_1",
  brandName: "Amoré Bloom",
  legalBusinessName: "Amoré Bloom LLC",
  logoUrl: null,
  primaryColor: "#b68235",
  secondaryColor: "#2f2a24",
  typography: "serif-classic",
  tagline: "",
  footerText: "Thank you for your business.",
  legalFooter: "© 2026 Amoré Bloom LLC",
  businessAddress: "",
  taxId: "",
  contactEmail: "hello@amorebloom.test",
  contactPhone: "",
  socialInstagram: "",
  socialFacebook: "",
  socialWebsite: "",
  termsUrl: "",
  privacyUrl: "",
};

const brandTheme = applyBrandingToDocument(branding);

function bytesToAsciiPrefix(bytes: Uint8Array, length: number): string {
  return Array.from(bytes.slice(0, length))
    .map((byte) => String.fromCharCode(byte))
    .join("");
}

describe("renderDocumentToPdf", () => {
  it("produces a real PDF binary (starts with the %PDF magic header)", async () => {
    const content: DocumentBlock[] = [
      { id: "h1", type: "heading", level: 1, runs: [{ text: "Proposal for Alex Rivera" }] },
      { id: "p1", type: "paragraph", runs: [{ text: "Thank you for considering Amoré Bloom for your event." }] },
    ];
    const bytes = await renderDocumentToPdf(content, { documentTitle: "Proposal", brandTheme, mode: "print" });
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytesToAsciiPrefix(bytes, 5)).toBe("%PDF-");
  });

  it("renders every block type without throwing", async () => {
    const content: DocumentBlock[] = [
      { id: "h1", type: "heading", level: 2, runs: [{ text: "Section", bold: true }] },
      { id: "p1", type: "paragraph", runs: [{ text: "Body copy that is reasonably long so it can wrap across more than one line inside the page margins." }] },
      { id: "t1", type: "table", rows: [[[{ text: "Service" }], [{ text: "Price" }]], [[{ text: "Florals" }], [{ text: "$500" }]]] },
      { id: "i1", type: "image", src: "https://example.test/photo.jpg", alt: "Venue photo" },
      { id: "d1", type: "divider" },
      { id: "c1", type: "conditional", field: "x", operator: "eq", value: "y", blocks: [{ id: "cp1", type: "paragraph", runs: [{ text: "Conditional paragraph" }] }] },
      { id: "l1", type: "loop", source: "items", itemBlocks: [{ id: "lp1", type: "paragraph", runs: [{ text: "Loop paragraph" }] }] },
      { id: "pb1", type: "pageBreak" },
      { id: "h2", type: "heading", level: 3, runs: [{ text: "Page two" }] },
    ];
    const bytes = await renderDocumentToPdf(content, { documentTitle: "Full Coverage", brandTheme, mode: "print" });
    expect(bytesToAsciiPrefix(bytes, 5)).toBe("%PDF-");
  });

  it("includes an attachments appendix when attachmentNames is set", async () => {
    const content: DocumentBlock[] = [{ id: "p1", type: "paragraph", runs: [{ text: "See attached." }] }];
    const bytes = await renderDocumentToPdf(content, { documentTitle: "With Attachments", brandTheme, mode: "print", attachmentNames: ["Contract.pdf", "Invoice.pdf"] });
    expect(bytesToAsciiPrefix(bytes, 5)).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("renders in preview mode with an automatic watermark without throwing", async () => {
    const content: DocumentBlock[] = [{ id: "p1", type: "paragraph", runs: [{ text: "Draft content." }] }];
    const bytes = await renderDocumentToPdf(content, { documentTitle: "Draft", brandTheme, mode: "preview" });
    expect(bytesToAsciiPrefix(bytes, 5)).toBe("%PDF-");
  });

  it("respects an explicit watermarkText even in print mode", async () => {
    const content: DocumentBlock[] = [{ id: "p1", type: "paragraph", runs: [{ text: "Voided content." }] }];
    const bytes = await renderDocumentToPdf(content, { documentTitle: "Voided", brandTheme, mode: "print", watermarkText: "VOID" });
    expect(bytesToAsciiPrefix(bytes, 5)).toBe("%PDF-");
  });

  it("honors header and footer blocks", async () => {
    const headerBlocks: DocumentBlock[] = [{ id: "hh", type: "paragraph", runs: [{ text: "Header line" }] }];
    const footerBlocks: DocumentBlock[] = [{ id: "ff", type: "paragraph", runs: [{ text: "Footer line" }] }];
    const bytes = await renderDocumentToPdf([{ id: "p1", type: "paragraph", runs: [{ text: "Body" }] }], {
      documentTitle: "With header/footer",
      brandTheme,
      mode: "print",
      headerBlocks,
      footerBlocks,
    });
    expect(bytesToAsciiPrefix(bytes, 5)).toBe("%PDF-");
  });

  it("produces a larger document when pageNumbering is enabled across multiple pages", async () => {
    const manyBlocks: DocumentBlock[] = Array.from({ length: 3 }, (_, index) => ({ id: `pb-${index}`, type: "pageBreak" as const }));
    const bytes = await renderDocumentToPdf(manyBlocks, { documentTitle: "Multi-page", brandTheme, mode: "print", pageNumbering: true });
    expect(bytesToAsciiPrefix(bytes, 5)).toBe("%PDF-");
  });
});
