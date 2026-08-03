/**
 * The centralized registry of merge fields a ContractTemplate's `body` may
 * reference (as literal `{{key}}` placeholders). Architecture only: nothing
 * here parses a template, substitutes a value, or renders anything — that's
 * explicitly out of scope for this phase. This module exists so that once a
 * renderer is built, it (and any future template editor) has one shared list
 * of valid fields to consume, instead of each place re-deciding what
 * `{{client_name}}` means.
 */
export interface MergeField {
  key: string;
  label: string;
  description: string;
}

export const MERGE_FIELDS: MergeField[] = [
  { key: "client_name", label: "Client Name", description: "The primary Client's full name." },
  { key: "partner_name", label: "Partner Name", description: "The Client's partner, if recorded." },
  { key: "event_date", label: "Event Date", description: "The linked Event's date, if any." },
  { key: "event_location", label: "Event Location", description: "The linked Event's location name." },
  { key: "contract_total", label: "Contract Total", description: "The Contract's total_value, formatted as currency." },
  { key: "deposit_amount", label: "Deposit Amount", description: "The Contract's deposit_amount, formatted as currency." },
  { key: "remaining_balance", label: "Remaining Balance", description: "The Contract's remaining_balance, formatted as currency." },
  { key: "workspace_name", label: "Workspace Name", description: "The business operating this Workspace." },
  // v2.0 Checkpoint 34 — Contract Management Platform's own Variable Engine
  // (`core/contractPlatform/variableEngine.ts`) is the first real resolver
  // for this registry — these 6 additive keys are the ones Step 5's own
  // named list needed that weren't already here, extending the existing
  // registry rather than building a second, competing one.
  { key: "proposal_total", label: "Proposal Total", description: "The linked Proposal's own grand total, formatted as currency — distinct from `contract_total`, which is the Contract's own commercial figure." },
  { key: "deposit", label: "Deposit", description: "The linked Proposal's own deposit due, formatted as currency." },
  { key: "company_name", label: "Company Name", description: "The Workspace's own name — the same value as `workspace_name`, named to match Step 5's own vocabulary." },
  { key: "address", label: "Address", description: "The primary Client's address, if recorded." },
  { key: "phone", label: "Phone", description: "The primary Client's phone number, if recorded." },
  { key: "email", label: "Email", description: "The primary Client's email address." },
];

export const MERGE_FIELD_KEYS: string[] = MERGE_FIELDS.map((field) => field.key);
