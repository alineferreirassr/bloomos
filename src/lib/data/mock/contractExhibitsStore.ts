import type { ContractExhibit } from "@/types/contractExhibit";

const SEED_EXHIBITS: ContractExhibit[] = [
  {
    id: "exhibit_1",
    contract_id: "contract_1",
    title: "Payment Schedule",
    description: "Deposit and remaining balance due dates.",
    display_order: 0,
    document_id: null,
    created_at: "2026-06-10T09:30:00.000Z",
    updated_at: "2026-06-10T09:30:00.000Z",
  },
  {
    id: "exhibit_2",
    contract_id: "contract_1",
    title: "Cancellation Policy",
    description: "Refund terms if the event is cancelled or rescheduled.",
    display_order: 1,
    document_id: null,
    created_at: "2026-06-10T09:30:00.000Z",
    updated_at: "2026-06-10T09:30:00.000Z",
  },
  {
    id: "exhibit_3",
    contract_id: "contract_6",
    title: "Rental Terms",
    description: "Terms covering rented decor and furniture for the wedding.",
    display_order: 0,
    document_id: null,
    created_at: "2026-07-09T13:00:00.000Z",
    updated_at: "2026-07-09T13:00:00.000Z",
  },
  {
    id: "exhibit_4",
    contract_id: "contract_6",
    title: "Damage Waiver",
    description: "Liability terms for rented items and venue property.",
    display_order: 1,
    document_id: null,
    created_at: "2026-07-09T13:00:00.000Z",
    updated_at: "2026-07-09T13:00:00.000Z",
  },
];

let exhibits: ContractExhibit[] = SEED_EXHIBITS.map((exhibit) => ({ ...exhibit }));

export function readContractExhibits(): ContractExhibit[] {
  return exhibits;
}

export function writeContractExhibits(next: ContractExhibit[]): void {
  exhibits = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetContractExhibitsStore(): void {
  exhibits = SEED_EXHIBITS.map((exhibit) => ({ ...exhibit }));
}
