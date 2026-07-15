import type { Contract } from "@/types/contract";
import type { ContractFormInput } from "@/modules/contracts/schema";

/** Converts a Contract record's null/numeric fields into the plain-string shape the form works with. */
export function contractToFormInput(contract: Contract): ContractFormInput {
  return {
    client_id: contract.client_id,
    event_id: contract.event_id ?? "",
    template_id: contract.template_id ?? "",
    title: contract.title,
    description: contract.description ?? "",
    effective_date: contract.effective_date ?? "",
    expiration_date: contract.expiration_date ?? "",
    total_value: contract.total_value === null ? "" : String(contract.total_value),
    deposit_required: contract.deposit_required,
    deposit_amount: contract.deposit_amount === null ? "" : String(contract.deposit_amount),
    currency: contract.currency,
    notes: contract.notes ?? "",
  };
}

/** Formats a nullable amount using the Contract's own currency code — display only, no rounding surprises for whole-dollar seed data. */
export function formatContractValue(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
