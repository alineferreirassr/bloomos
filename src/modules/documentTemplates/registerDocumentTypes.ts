import { registerDocumentType } from "@/core/documents/documentTypeRegistry";
import { contractDocumentType } from "@/modules/documentTemplates/types/contractDocumentType";
import { proposalDocumentType } from "@/modules/documentTemplates/types/proposalDocumentType";
import { invoiceDocumentType } from "@/modules/documentTemplates/types/invoiceDocumentType";
import { receiptDocumentType } from "@/modules/documentTemplates/types/receiptDocumentType";
import { welcomeGuideDocumentType } from "@/modules/documentTemplates/types/welcomeGuideDocumentType";
import { questionnaireDocumentType } from "@/modules/documentTemplates/types/questionnaireDocumentType";
import { checklistDocumentType } from "@/modules/documentTemplates/types/checklistDocumentType";
import { runSheetDocumentType } from "@/modules/documentTemplates/types/runSheetDocumentType";
import { clientHandbookDocumentType } from "@/modules/documentTemplates/types/clientHandbookDocumentType";
import { planningGuideDocumentType } from "@/modules/documentTemplates/types/planningGuideDocumentType";
import { faqDocumentType } from "@/modules/documentTemplates/types/faqDocumentType";
import { thankYouLetterDocumentType } from "@/modules/documentTemplates/types/thankYouLetterDocumentType";
import { reviewRequestDocumentType } from "@/modules/documentTemplates/types/reviewRequestDocumentType";
import { vendorReferralLetterDocumentType } from "@/modules/documentTemplates/types/vendorReferralLetterDocumentType";
import { leadWelcomeLetterDocumentType } from "@/modules/documentTemplates/types/leadWelcomeLetterDocumentType";

let registered = false;

const documentTypes = [
  contractDocumentType,
  proposalDocumentType,
  invoiceDocumentType,
  receiptDocumentType,
  welcomeGuideDocumentType,
  questionnaireDocumentType,
  checklistDocumentType,
  runSheetDocumentType,
  // v2 Checkpoint 44, Step 4 — the Document Template Library's own new types,
  // registered through the same Step 2 registry, never a second one.
  clientHandbookDocumentType,
  planningGuideDocumentType,
  faqDocumentType,
  thankYouLetterDocumentType,
  reviewRequestDocumentType,
  vendorReferralLetterDocumentType,
  leadWelcomeLetterDocumentType,
];

/**
 * Registers the Step 2 built-ins (8) plus the v2 Checkpoint 44 additions (7)
 * — 15 total. Idempotent, the same module-level guard
 * `registerWorkflowNodes()`/`registerSettingsSections()` already use. Per
 * Step 18's own Developer Experience guarantee, a future document type
 * needs only its own definition file plus one array entry here — nothing
 * in the Document UI itself changes.
 */
export function registerDocumentTypes(): void {
  if (registered) return;
  for (const documentType of documentTypes) {
    registerDocumentType(documentType);
  }
  registered = true;
}

/** Test-only: clears the idempotency guard so a test that also resets the underlying registry (`resetDocumentTypeRegistry`) can call `registerDocumentTypes()` again and see it actually re-populate. */
export function resetDocumentTypesRegistration(): void {
  registered = false;
}
