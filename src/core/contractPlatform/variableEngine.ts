import type { Client } from "@/types/client";
import type { ContractPricingReference, ContractVariable } from "@/types/contractPlatform";
import { getFullName } from "@/lib/personName";

/**
 * v2.0 Checkpoint 34 — Variable Engine (Step 5). Pure, deterministic
 * `{{key}}` substitution over already-fetched real records — no AI, no
 * invented values. This is the first real resolver/renderer for
 * `modules/contracts/mergeFields.ts`'s own `MERGE_FIELDS` registry
 * (Checkpoint "Contracts Foundation"), whose own doc comment discloses
 * "nothing parses a template, substitutes a value, or renders anything —
 * that's explicitly out of scope for this phase." This file fills
 * exactly that disclosed gap, extending the existing registry with the
 * 6 keys the spec's own Step 5 names that weren't already present
 * (`proposal_total`, `deposit`, `company_name`, `address`, `phone`,
 * `email`) rather than building a second, competing registry.
 *
 * A variable with no real source value resolves to an empty string,
 * disclosed as a real (if empty) resolution — never a fabricated one.
 */

/** Only the fields the engine actually reads — narrower than the full `Client` record so a caller (or test fixture) never has to assemble one just to resolve a few variables. */
export type ContractVariableClient = Pick<Client, "first_name" | "last_name" | "address" | "phone" | "email">;

export interface ContractVariableSourceData {
  client: ContractVariableClient | null;
  eventDate: string | null;
  pricingReference: ContractPricingReference | null;
  companyName: string;
}

function formatMoney(minor: number | null, currency: string | null): string {
  if (minor === null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency ?? "USD" }).format(minor / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** The 9 named keys Step 5 lists, resolved from real data only. */
export function resolveContractVariables(data: ContractVariableSourceData): ContractVariable[] {
  const currency = data.pricingReference?.currency ?? null;
  return [
    { key: "client_name", label: "Client Name", value: data.client ? getFullName(data.client) : "" },
    { key: "event_date", label: "Event Date", value: formatDate(data.eventDate) },
    { key: "proposal_total", label: "Proposal Total", value: formatMoney(data.pricingReference?.grandTotal_minor ?? null, currency) },
    { key: "deposit", label: "Deposit", value: formatMoney(data.pricingReference?.depositDue_minor ?? null, currency) },
    { key: "remaining_balance", label: "Remaining Balance", value: formatMoney(data.pricingReference?.remainingBalance_minor ?? null, currency) },
    { key: "company_name", label: "Company Name", value: data.companyName },
    { key: "address", label: "Address", value: data.client?.address ?? "" },
    { key: "phone", label: "Phone", value: data.client?.phone ?? "" },
    { key: "email", label: "Email", value: data.client?.email ?? "" },
  ];
}

/** Replaces every `{{key}}` occurrence with its resolved value — an unresolved key (one with no matching variable) is left untouched rather than silently dropped, so a missing variable is visible instead of hidden. */
export function substituteVariables(text: string, variables: ContractVariable[]): string {
  const byKey = new Map(variables.map((v) => [v.key, v.value]));
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    const value = byKey.get(key);
    return value !== undefined ? value : match;
  });
}

/** Every `{{key}}` a piece of text references — used by Health's "Missing Variables" check to find placeholders with no real resolved value. */
export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>();
  const pattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) keys.add(match[1]);
  return Array.from(keys);
}
