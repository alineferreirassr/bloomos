import { beforeEach, describe, expect, it } from "vitest";
import { resetDocumentTypeRegistry, listDocumentTypes } from "@/core/documents/documentTypeRegistry";
import { registerDocumentTypes, resetDocumentTypesRegistration } from "@/modules/documentTemplates/registerDocumentTypes";

describe("registerDocumentTypes", () => {
  beforeEach(() => {
    resetDocumentTypeRegistry();
    resetDocumentTypesRegistration();
  });

  it("is idempotent — calling twice does not duplicate registrations", () => {
    registerDocumentTypes();
    registerDocumentTypes();
    expect(listDocumentTypes()).toHaveLength(15);
  });

  it("registers all 8 document types named in Step 2", () => {
    registerDocumentTypes();
    const ids = listDocumentTypes().map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["contract", "proposal", "invoice", "receipt", "welcome-guide", "questionnaire", "checklist", "run-sheet"]),
    );
  });

  it("registers the 7 v2 Checkpoint 44 Document Template Library additions", () => {
    registerDocumentTypes();
    const ids = listDocumentTypes().map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "client-handbook",
        "planning-guide",
        "faq",
        "thank-you-letter",
        "review-request",
        "vendor-referral-letter",
        "lead-welcome-letter",
      ]),
    );
    expect(ids).toHaveLength(15);
  });

  it("every document type has at least one suggested merge field", () => {
    registerDocumentTypes();
    for (const type of listDocumentTypes()) {
      expect(type.suggestedMergeFieldKeys.length).toBeGreaterThan(0);
    }
  });

  it("every document type icon resolves to a real icon, never the HelpCircle fallback", async () => {
    registerDocumentTypes();
    const { resolveDocumentTypeIcon } = await import("@/modules/documentTemplates/documentTypeIcons");
    const { HelpCircle } = await import("lucide-react");
    for (const type of listDocumentTypes()) {
      expect(resolveDocumentTypeIcon(type.icon)).not.toBe(HelpCircle);
    }
  });
});
