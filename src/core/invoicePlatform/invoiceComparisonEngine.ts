import type { InvoiceComparisonResult, InvoiceDiffEntry, InvoiceSnapshot, InvoiceVersion } from "@/types/invoicePlatform";

/**
 * v2.0 Checkpoint 35 — Comparison Engine (Step 9). Pure structural diff
 * over two already-frozen `InvoiceSnapshot`s — never re-derives pricing,
 * only compares the values each snapshot already carries. Mirrors
 * `compareContractVersions` (Checkpoint 34) exactly, over this checkpoint's
 * own 8 named diff categories: Amounts, Line Items, Terms, Installments,
 * Credits, Discounts, Notes, Policies.
 */

function diffIdSets(category: InvoiceDiffEntry["category"], field: string, before: string[], after: string[]): InvoiceDiffEntry[] {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const diffs: InvoiceDiffEntry[] = [];
  for (const id of after) {
    if (!beforeSet.has(id)) diffs.push({ category, field, before: null, after: id, changeType: "added" });
  }
  for (const id of before) {
    if (!afterSet.has(id)) diffs.push({ category, field, before: id, after: null, changeType: "removed" });
  }
  return diffs;
}

function diffAmounts(a: InvoiceSnapshot, b: InvoiceSnapshot): InvoiceDiffEntry[] {
  const diffs: InvoiceDiffEntry[] = [];
  const fields: Array<[string, (s: InvoiceSnapshot) => number]> = [
    ["Grand Total", (s) => s.pricing.grandTotal_minor],
    ["Subtotal", (s) => s.pricing.subtotal_minor],
    ["Deposit Due", (s) => s.pricing.depositDue_minor],
    ["Remaining Balance", (s) => s.pricing.remainingBalance_minor],
    ["Outstanding Balance", (s) => s.pricing.outstandingBalance_minor],
  ];
  for (const [field, get] of fields) {
    const before = get(a);
    const after = get(b);
    if (before !== after) diffs.push({ category: "amounts", field, before: String(before), after: String(after), changeType: "changed" });
  }
  return diffs;
}

function diffLineItems(a: InvoiceSnapshot, b: InvoiceSnapshot): InvoiceDiffEntry[] {
  const revenue = (li: InvoiceSnapshot["lineItems"][number]) => li.kind !== "discount";
  const beforeItems = a.lineItems.filter(revenue);
  const afterItems = b.lineItems.filter(revenue);
  const afterMap = new Map(afterItems.map((li) => [li.id, li]));
  const diffs = diffIdSets("line_items", "Line Items", beforeItems.map((li) => li.id), afterItems.map((li) => li.id));
  for (const item of beforeItems) {
    const match = afterMap.get(item.id);
    if (match && match.amount_minor !== item.amount_minor) {
      diffs.push({ category: "line_items", field: item.label, before: String(item.amount_minor), after: String(match.amount_minor), changeType: "changed" });
    }
  }
  return diffs;
}

function diffDiscounts(a: InvoiceSnapshot, b: InvoiceSnapshot): InvoiceDiffEntry[] {
  const beforeDiscounts = a.lineItems.filter((li) => li.kind === "discount");
  const afterDiscounts = b.lineItems.filter((li) => li.kind === "discount");
  return diffIdSets("discounts", "Discounts", beforeDiscounts.map((li) => li.id), afterDiscounts.map((li) => li.id));
}

function diffCredits(a: InvoiceSnapshot, b: InvoiceSnapshot): InvoiceDiffEntry[] {
  const isCreditKind = (kind: string) => kind === "credit" || kind === "service_credit" || kind === "invoice_credit";
  const beforeCredits = a.adjustments.filter((adj) => isCreditKind(adj.kind));
  const afterCredits = b.adjustments.filter((adj) => isCreditKind(adj.kind));
  return diffIdSets("credits", "Credits", beforeCredits.map((c) => c.id), afterCredits.map((c) => c.id));
}

function diffInstallments(a: InvoiceSnapshot, b: InvoiceSnapshot): InvoiceDiffEntry[] {
  return diffIdSets("installments", "Payment Schedule", a.paymentSchedule.map((i) => i.id), b.paymentSchedule.map((i) => i.id));
}

function diffText(category: InvoiceDiffEntry["category"], field: string, before: string, after: string): InvoiceDiffEntry[] {
  if (before === after) return [];
  return [{ category, field, before, after, changeType: "changed" }];
}

export function compareInvoiceVersions(versionA: InvoiceVersion, versionB: InvoiceVersion): InvoiceComparisonResult {
  const a = versionA.snapshot;
  const b = versionB.snapshot;

  const diffs: InvoiceDiffEntry[] = [
    ...diffAmounts(a, b),
    ...diffLineItems(a, b),
    ...diffText("terms", "Terms", a.terms, b.terms),
    ...diffInstallments(a, b),
    ...diffCredits(a, b),
    ...diffDiscounts(a, b),
    ...diffText("notes", "Notes", a.notes, b.notes),
    ...diffText("policies", "Policies", a.policies, b.policies),
  ];

  return {
    versionANumber: versionA.version_number,
    versionBNumber: versionB.version_number,
    diffs,
    hasChanges: diffs.length > 0,
  };
}
