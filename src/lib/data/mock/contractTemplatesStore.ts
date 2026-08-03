import type { ContractTemplate } from "@/types/contractTemplate";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const SEED_TEMPLATES: ContractTemplate[] = [
  {
    id: "template_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    name: "Standard Event Services Agreement",
    description: "General-purpose agreement for a single planned event: scope, pricing, deposit, and cancellation terms.",
    category: "event_agreement",
    body:
      "This Event Services Agreement is entered into between {{workspace_name}} and {{client_name}}" +
      " ({{partner_name}}) for the event on {{event_date}} at {{event_location}}. Total contract value:" +
      " {{contract_total}}. Deposit due upon signing: {{deposit_amount}}. Remaining balance:" +
      " {{remaining_balance}}, due prior to the event date.",
    version: 1,
    active: true,
    created_at: "2025-01-15T09:00:00.000Z",
    updated_at: "2025-01-15T09:00:00.000Z",
  },
  {
    id: "template_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    name: "Vendor Rental Agreement",
    description: "Short-form agreement for a standalone rental item or service that isn't the full event package.",
    category: "rental_agreement",
    body:
      "This Rental Agreement is entered into between {{workspace_name}} and {{client_name}} for rental" +
      " items associated with the event on {{event_date}}. Total rental fee: {{contract_total}}.",
    version: 1,
    active: true,
    created_at: "2025-03-02T09:00:00.000Z",
    updated_at: "2025-03-02T09:00:00.000Z",
  },
  {
    id: "template_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    name: "Photography & Media Release",
    description: "Grants permission to use event photography/video in marketing. Still being drafted — not active yet.",
    category: "photography_release",
    body:
      "{{client_name}} grants {{workspace_name}} permission to use photography and video from the event" +
      " on {{event_date}} for portfolio and marketing purposes.",
    version: 1,
    active: false,
    created_at: "2026-05-01T09:00:00.000Z",
    updated_at: "2026-05-01T09:00:00.000Z",
  },
];

let templates: ContractTemplate[] = SEED_TEMPLATES.map((template) => ({ ...template }));

export function readContractTemplates(): ContractTemplate[] {
  return templates;
}

export function writeContractTemplates(next: ContractTemplate[]): void {
  templates = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetContractTemplatesStore(): void {
  templates = SEED_TEMPLATES.map((template) => ({ ...template }));
}
