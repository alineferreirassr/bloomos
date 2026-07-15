import type { Contract } from "@/types/contract";
import type { ContractTemplate } from "@/types/contractTemplate";
import type { ContractExhibit } from "@/types/contractExhibit";

/** Test-only fixture factory — not imported by any app code. */
export function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract_test",
    workspace_id: "ws_test",
    client_id: "client_test",
    event_id: null,
    template_id: null,
    contract_number: "CT-2026-0001",
    title: "Test Contract",
    description: null,
    status: "draft",
    signature_status: "unsigned",
    version: 1,
    version_history: [],
    effective_date: null,
    expiration_date: null,
    signed_at: null,
    sent_at: null,
    viewed_at: null,
    declined_at: null,
    cancelled_at: null,
    archived_at: null,
    total_value: null,
    deposit_required: false,
    deposit_amount: null,
    remaining_balance: null,
    currency: "USD",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeContractTemplate(overrides: Partial<ContractTemplate> = {}): ContractTemplate {
  return {
    id: "template_test",
    workspace_id: "ws_test",
    name: "Test Template",
    description: null,
    category: "event_agreement",
    body: "This agreement is between {{workspace_name}} and {{client_name}}.",
    version: 1,
    active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeContractExhibit(overrides: Partial<ContractExhibit> = {}): ContractExhibit {
  return {
    id: "exhibit_test",
    contract_id: "contract_test",
    title: "Test Exhibit",
    description: null,
    display_order: 0,
    document_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
