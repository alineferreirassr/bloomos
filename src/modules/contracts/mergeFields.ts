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
];

export const MERGE_FIELD_KEYS: string[] = MERGE_FIELDS.map((field) => field.key);
