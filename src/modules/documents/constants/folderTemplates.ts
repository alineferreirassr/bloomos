/**
 * Reusable folder-name templates, not UI. Nothing auto-creates these —
 * `applyDefaultFolderTemplate()` (lib/data/index.ts) is called on demand
 * with one of these kinds, an owner, and an optional parent folder (e.g.
 * applying the `finance` template nested under an Event's own "Finance"
 * folder). Every folder is seeded with `visibility: "internal"` and no
 * description; a user re-labels/re-visibilities from there.
 */
export const FOLDER_TEMPLATE_KINDS = ["client", "event", "contract", "finance"] as const;

export type FolderTemplateKind = (typeof FOLDER_TEMPLATE_KINDS)[number];

export const DOCUMENT_FOLDER_TEMPLATES: Record<FolderTemplateKind, string[]> = {
  client: ["Contracts", "Payments", "Identification", "Inspiration", "General"],
  event: [
    "Contracts",
    "Finance",
    "Moodboards",
    "Floor Plans",
    "Schedule",
    "Photos",
    "Videos",
    "Vendor Documents",
    "General",
  ],
  contract: ["Main Contract", "Signed Versions", "Exhibits", "Supporting Documents"],
  finance: ["Invoices", "Receipts", "Payment Confirmations", "Expense Receipts", "Reimbursements", "Tax Documents"],
};
