/**
 * A named attachment/appendix to a Contract (e.g. Payment Schedule,
 * Cancellation Policy, Rental Terms, Damage Waiver, Photo Release, or a
 * Custom Attachment) — model support only, per the current phase's scope.
 * `document_id` is a placeholder for the future Documents module; no file
 * storage exists yet, so it's always null today (same pattern as
 * ContractTemplate.body having no renderer yet).
 *
 * `workspace_id` is carried redundantly here (not derivable only through
 * `contract_id`) so Supabase RLS can gate on it directly without a join
 * through `contracts` — the same pattern `checklist_items`/
 * `event_schedule_items` already use.
 */
export interface ContractExhibit {
  id: string;
  workspace_id: string;
  contract_id: string;
  title: string;
  description: string | null;
  display_order: number;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}
