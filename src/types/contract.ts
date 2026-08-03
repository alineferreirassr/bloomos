import type { ContractStatus } from "@/core/enums/contractStatus";
import type { SignatureStatus } from "@/core/enums/signatureStatus";

/**
 * A snapshot of a Contract's editable content taken immediately before an
 * update overwrites it — the minimal "version history" the model needs
 * (see Contract.version_history below) without a separate versions table.
 * No UI reads this yet; it exists so the data isn't lost the first time
 * updateContract() is called.
 */
export interface ContractVersionSnapshot {
  version: number;
  title: string;
  description: string | null;
  total_value: number | null;
  deposit_amount: number | null;
  recorded_at: string;
}

/**
 * Closes the commercial cycle: Lead -> Client -> Event -> Contract ->
 * Invoice (future) -> Payments (future). A Contract always belongs to a
 * Client; `event_id` is deliberately nullable — a Contract can be a
 * standalone agreement with a Client (e.g. a retainer) that predates or
 * never needs a specific Event record. Never assume a single Workspace:
 * every Contract is reusable across Workspaces the same way Leads/Clients/
 * Events are (workspace_id, never hardcoded to Amoré Bloom).
 *
 * `status` and `signature_status` are two independent state machines, the
 * same pattern as Event's `status`/`lifecycle_stage` (see
 * core/workflows/contractWorkflow.ts) — `status` is the contract's overall
 * commercial lifecycle (draft ... completed, or a terminal branch);
 * `signature_status` is specifically about the e-signature process and can
 * reach `partially_signed`, a state `status` has no equivalent for.
 *
 * No PDF, signature-provider integration, Supabase, or Documents module
 * exists yet — `notes` is a plain internal text field (mirrors Event's
 * `internal_summary`), separate from the shared Notes entity a Contract
 * also owns via owner_type/owner_id (see lib/data/index.ts's Contract
 * Notes section) — same dual pattern Event already uses.
 */
export interface Contract {
  id: string;
  workspace_id: string;
  client_id: string;
  event_id: string | null;
  template_id: string | null;
  contract_number: string;
  title: string;
  description: string | null;
  status: ContractStatus;
  signature_status: SignatureStatus;
  version: number;
  version_history: ContractVersionSnapshot[];
  effective_date: string | null;
  expiration_date: string | null;
  signed_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
  total_value: number | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  remaining_balance: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
