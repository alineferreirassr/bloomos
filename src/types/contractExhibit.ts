/**
 * A named attachment/appendix to a Contract (e.g. Payment Schedule,
 * Cancellation Policy, Rental Terms, Damage Waiver, Photo Release, or a
 * Custom Attachment) — model support only, per the current phase's scope.
 * `document_id` is a placeholder for the future Documents module; no file
 * storage exists yet, so it's always null today (same pattern as
 * ContractTemplate.body having no renderer yet).
 */
export interface ContractExhibit {
  id: string;
  contract_id: string;
  title: string;
  description: string | null;
  display_order: number;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}
