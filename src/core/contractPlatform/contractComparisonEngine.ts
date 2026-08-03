import type { ContractComparisonResult, ContractDiffEntry, ContractSnapshot, ContractVersion } from "@/types/contractPlatform";

/**
 * v2.0 Checkpoint 34 — Comparison Engine (Step 7). Pure structural diff
 * over two already-frozen `ContractSnapshot`s — never re-derives pricing
 * or content, only compares the values each snapshot already carries.
 * Mirrors `compareProposalVersions` (Checkpoint 33) exactly, over this
 * checkpoint's own 7 named diff categories: Clauses, Variables, Pricing
 * References, Sections, Attachments, Terms, Policies.
 */

function diffIdSets(category: ContractDiffEntry["category"], field: string, before: string[], after: string[]): ContractDiffEntry[] {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const diffs: ContractDiffEntry[] = [];
  for (const id of after) {
    if (!beforeSet.has(id)) diffs.push({ category, field, before: null, after: id, changeType: "added" });
  }
  for (const id of before) {
    if (!afterSet.has(id)) diffs.push({ category, field, before: id, after: null, changeType: "removed" });
  }
  return diffs;
}

function diffVariables(a: ContractSnapshot, b: ContractSnapshot): ContractDiffEntry[] {
  const beforeMap = new Map(a.variables.map((v) => [v.key, v.value]));
  const afterMap = new Map(b.variables.map((v) => [v.key, v.value]));
  const diffs: ContractDiffEntry[] = [];
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const key of keys) {
    const before = beforeMap.get(key) ?? null;
    const after = afterMap.get(key) ?? null;
    if (before === after) continue;
    diffs.push({ category: "variables", field: key, before, after, changeType: before === null ? "added" : after === null ? "removed" : "changed" });
  }
  return diffs;
}

function diffPricingReferences(a: ContractSnapshot, b: ContractSnapshot): ContractDiffEntry[] {
  const diffs: ContractDiffEntry[] = [];
  const fields: Array<[string, (s: ContractSnapshot) => number | null]> = [
    ["Grand Total", (s) => s.pricingReference?.grandTotal_minor ?? null],
    ["Deposit Due", (s) => s.pricingReference?.depositDue_minor ?? null],
    ["Remaining Balance", (s) => s.pricingReference?.remainingBalance_minor ?? null],
  ];
  for (const [field, get] of fields) {
    const before = get(a);
    const after = get(b);
    if (before !== after) {
      diffs.push({ category: "pricing_references", field, before: before === null ? null : String(before), after: after === null ? null : String(after), changeType: "changed" });
    }
  }
  if (a.pricingReference?.proposalId !== b.pricingReference?.proposalId) {
    diffs.push({ category: "pricing_references", field: "Linked Proposal", before: a.pricingReference?.proposalId ?? null, after: b.pricingReference?.proposalId ?? null, changeType: "changed" });
  }
  return diffs;
}

function diffSections(a: ContractSnapshot, b: ContractSnapshot): ContractDiffEntry[] {
  const beforeMap = new Map(a.sections.map((s) => [s.id, s]));
  const afterMap = new Map(b.sections.map((s) => [s.id, s]));
  const diffs: ContractDiffEntry[] = [];

  for (const section of b.sections) {
    if (!beforeMap.has(section.id)) diffs.push({ category: "sections", field: section.title, before: null, after: "added", changeType: "added" });
  }
  for (const section of a.sections) {
    if (!afterMap.has(section.id)) diffs.push({ category: "sections", field: section.title, before: "present", after: null, changeType: "removed" });
  }
  for (const section of a.sections) {
    const match = afterMap.get(section.id);
    if (match && JSON.stringify(match.blocks) !== JSON.stringify(section.blocks)) {
      diffs.push({ category: "sections", field: section.title, before: `${section.blocks.length} block(s)`, after: `${match.blocks.length} block(s)`, changeType: "changed" });
    }
  }
  return diffs;
}

function diffText(category: ContractDiffEntry["category"], field: string, before: string, after: string): ContractDiffEntry[] {
  if (before === after) return [];
  return [{ category, field, before, after, changeType: "changed" }];
}

export function compareContractVersions(versionA: ContractVersion, versionB: ContractVersion): ContractComparisonResult {
  const a = versionA.snapshot;
  const b = versionB.snapshot;

  const diffs: ContractDiffEntry[] = [
    ...diffIdSets("clauses", "Selected Clauses", a.clauseIds, b.clauseIds),
    ...diffVariables(a, b),
    ...diffPricingReferences(a, b),
    ...diffSections(a, b),
    ...diffIdSets("attachments", "Attachments", a.attachmentIds, b.attachmentIds),
    ...diffText("terms", "Terms", a.terms, b.terms),
    ...diffText("policies", "Policies", a.policies, b.policies),
  ];

  return {
    versionANumber: versionA.version_number,
    versionBNumber: versionB.version_number,
    diffs,
    hasChanges: diffs.length > 0,
  };
}
