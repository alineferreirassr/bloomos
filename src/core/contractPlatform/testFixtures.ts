import type { Contract } from "@/types/contract";
import type { ContractVariableClient } from "@/core/contractPlatform/variableEngine";
import type { ContractBlock, ContractBuilderState, ContractBuilderTemplate, ContractClause, ContractPricingReference, ContractSection, ContractSnapshot, ContractVersion } from "@/types/contractPlatform";

/** v2.0 Checkpoint 34 — shared fixture builders for engine tests, mirroring Proposal Platform's own `testFixtures.ts` (Checkpoint 33) precedent. Not a test file itself. */

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_test_${sequence}`;
}

export function makeVariableClient(overrides: Partial<ContractVariableClient> = {}): ContractVariableClient {
  return {
    first_name: "Jordan",
    last_name: "Rivera",
    email: "jordan.rivera@example.com",
    phone: "555-0100",
    address: "123 Main St, Austin, TX 78701",
    ...overrides,
  };
}

export function makeContract(overrides: Partial<Contract> = {}): Contract {
  const now = new Date().toISOString();
  return {
    id: nextId("contract"),
    workspace_id: "ws_test",
    client_id: nextId("client"),
    event_id: nextId("event"),
    template_id: null,
    contract_number: "C-0001",
    title: "Luxury Picnic Agreement",
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
    total_value: 65000,
    deposit_required: true,
    deposit_amount: 19500,
    remaining_balance: 45500,
    currency: "USD",
    notes: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as Contract;
}

export function makeHeader(overrides: Partial<ContractSnapshot["header"]> = {}) {
  return { title: "Master Service Agreement", subtitle: null, logoAssetId: null, ...overrides };
}

export function makeFooter(overrides: Partial<ContractSnapshot["footer"]> = {}) {
  return { text: "Thank you for choosing Amoré Bloom.", contactEmail: "hello@amorebloom.test", contactPhone: null, ...overrides };
}

export function makeBlock(overrides: Partial<ContractBlock> = {}): ContractBlock {
  return {
    id: nextId("contract_block"),
    type: "paragraph",
    order: 0,
    heading: null,
    text: "Sample clause text.",
    variableKeys: [],
    clauseId: null,
    mediaAssetIds: [],
    tableRows: [],
    attachmentIds: [],
    placeholderLabel: null,
    ...overrides,
  };
}

export function makeSection(overrides: Partial<ContractSection> = {}): ContractSection {
  return { id: nextId("contract_section"), key: "payment_terms", title: "Payment Terms", isCustom: false, blocks: [makeBlock()], ...overrides };
}

export function makePricingReference(overrides: Partial<ContractPricingReference> = {}): ContractPricingReference {
  return { proposalId: nextId("proposal"), grandTotal_minor: 65000, currency: "USD", depositDue_minor: 19500, remainingBalance_minor: 45500, ...overrides };
}

export function makeSnapshot(overrides: Partial<ContractSnapshot> = {}): ContractSnapshot {
  return {
    id: nextId("contract_snapshot"),
    captured_at: new Date().toISOString(),
    builderTemplateId: nextId("contract_builder_template"),
    builderTemplateKey: "proposal_agreement",
    header: makeHeader(),
    sections: [makeSection()],
    clauseIds: ["clause_1"],
    variables: [{ key: "client_name", label: "Client Name", value: "Jordan Rivera" }],
    pricingReference: makePricingReference(),
    attachmentIds: [],
    terms: "Standard terms apply.",
    policies: "Standard cancellation policy applies.",
    footer: makeFooter(),
    ...overrides,
  };
}

export function makeVersion(overrides: Partial<ContractVersion> = {}): ContractVersion {
  return {
    id: nextId("contract_version"),
    contract_id: nextId("contract"),
    workspace_id: "ws_test",
    version_number: 1,
    snapshot: makeSnapshot(),
    notes: null,
    reason: null,
    created_by: "member_test",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeBuilderState(overrides: Partial<ContractBuilderState> = {}): ContractBuilderState {
  const version = makeVersion();
  const now = new Date().toISOString();
  return {
    id: nextId("contract_builder"),
    contract_id: version.contract_id,
    workspace_id: "ws_test",
    status: "draft",
    current_version_id: version.id,
    versions: [version],
    ready_at: null,
    archived_at: null,
    created_by: "member_test",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function makeBuilderTemplate(overrides: Partial<ContractBuilderTemplate> = {}): ContractBuilderTemplate {
  const now = new Date().toISOString();
  return {
    id: nextId("contract_builder_template"),
    workspace_id: "ws_test",
    key: "proposal_agreement",
    name: "Proposal Agreement",
    description: "For converting an accepted Proposal into a signable agreement.",
    isSystemTemplate: true,
    structure: {
      header: makeHeader(),
      sectionKeys: ["parties", "scope_of_services", "payment_terms", "clauses", "signatures"],
      defaultClauseKeys: ["payment_terms", "cancellation_policy"],
      optionalClauseKeys: ["reschedule_policy"],
      hasSignaturePlaceholders: true,
      footer: makeFooter(),
    },
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  };
}

export function makeClause(overrides: Partial<ContractClause> = {}): ContractClause {
  const now = new Date().toISOString();
  return {
    id: nextId("contract_clause"),
    workspace_id: "ws_test",
    key: "payment_terms",
    name: "Payment Terms",
    category: "Financial",
    bodyText: "{{client_name}} agrees to pay {{proposal_total}}.",
    isOptional: false,
    isCustom: false,
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  };
}
