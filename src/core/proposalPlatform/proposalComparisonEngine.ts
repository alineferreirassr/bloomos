import type { ProposalComparisonResult, ProposalDiffEntry, ProposalSnapshot, ProposalVersion } from "@/types/proposalPlatform";

/**
 * v2.0 Checkpoint 33 — Proposal Comparison Engine (Step 9). Pure structural
 * diff over two already-frozen `ProposalSnapshot`s — never re-derives
 * pricing or content, only compares the values each snapshot already
 * carries. Mirrors `ExecutionVersionComparisonResult`'s own "diff by
 * category" shape (Checkpoint 27.3).
 */

function diffPricing(a: ProposalSnapshot, b: ProposalSnapshot): ProposalDiffEntry[] {
  const diffs: ProposalDiffEntry[] = [];
  const fields: Array<[string, (s: ProposalSnapshot) => number]> = [
    ["Grand Total", (s) => s.pricing.grandTotal_minor],
    ["Subtotal", (s) => s.pricing.subtotal_minor],
    ["Discount", (s) => s.pricing.discountAmount_minor],
    ["Tax", (s) => s.pricing.taxAmount_minor],
    ["Deposit Due", (s) => s.pricing.depositDue_minor],
  ];
  for (const [field, get] of fields) {
    const before = get(a);
    const after = get(b);
    if (before !== after) {
      diffs.push({ category: "pricing", field, before: String(before), after: String(after), changeType: "changed" });
    }
  }
  return diffs;
}

function diffIdSets(category: ProposalDiffEntry["category"], field: string, before: string[], after: string[]): ProposalDiffEntry[] {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const diffs: ProposalDiffEntry[] = [];
  for (const id of after) {
    if (!beforeSet.has(id)) diffs.push({ category, field, before: null, after: id, changeType: "added" });
  }
  for (const id of before) {
    if (!afterSet.has(id)) diffs.push({ category, field, before: id, after: null, changeType: "removed" });
  }
  return diffs;
}

function diffSections(a: ProposalSnapshot, b: ProposalSnapshot): ProposalDiffEntry[] {
  const beforeMap = new Map(a.sections.map((s) => [s.id, s]));
  const afterMap = new Map(b.sections.map((s) => [s.id, s]));
  const diffs: ProposalDiffEntry[] = [];

  for (const section of b.sections) {
    if (!beforeMap.has(section.id)) {
      diffs.push({ category: "sections", field: section.title, before: null, after: "added", changeType: "added" });
    }
  }
  for (const section of a.sections) {
    if (!afterMap.has(section.id)) {
      diffs.push({ category: "sections", field: section.title, before: "present", after: null, changeType: "removed" });
    }
  }
  for (const section of a.sections) {
    const match = afterMap.get(section.id);
    if (match && JSON.stringify(match.blocks) !== JSON.stringify(section.blocks)) {
      diffs.push({ category: "sections", field: section.title, before: `${section.blocks.length} block(s)`, after: `${match.blocks.length} block(s)`, changeType: "changed" });
    }
  }
  return diffs;
}

function diffVariables(a: ProposalSnapshot, b: ProposalSnapshot): ProposalDiffEntry[] {
  const beforeMap = new Map(a.variables.map((v) => [v.key, v.value]));
  const afterMap = new Map(b.variables.map((v) => [v.key, v.value]));
  const diffs: ProposalDiffEntry[] = [];
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const key of keys) {
    const before = beforeMap.get(key) ?? null;
    const after = afterMap.get(key) ?? null;
    if (before === after) continue;
    diffs.push({ category: "variables", field: key, before, after, changeType: before === null ? "added" : after === null ? "removed" : "changed" });
  }
  return diffs;
}

function diffText(category: ProposalDiffEntry["category"], field: string, before: string, after: string): ProposalDiffEntry[] {
  if (before === after) return [];
  return [{ category, field, before, after, changeType: "changed" }];
}

function diffImages(a: ProposalSnapshot, b: ProposalSnapshot): ProposalDiffEntry[] {
  const before = [a.header.logoAssetId, a.hero.imageAssetId, ...a.sections.flatMap((s) => s.blocks.flatMap((blk) => blk.mediaAssetIds))].filter((id): id is string => id !== null);
  const after = [b.header.logoAssetId, b.hero.imageAssetId, ...b.sections.flatMap((s) => s.blocks.flatMap((blk) => blk.mediaAssetIds))].filter((id): id is string => id !== null);
  return diffIdSets("images", "Media", before, after);
}

export function compareProposalVersions(versionA: ProposalVersion, versionB: ProposalVersion): ProposalComparisonResult {
  const a = versionA.snapshot;
  const b = versionB.snapshot;

  const diffs: ProposalDiffEntry[] = [
    ...diffPricing(a, b),
    ...diffSections(a, b),
    ...diffIdSets("packages", "Selected Packages", a.packageIds, b.packageIds),
    ...diffIdSets("addons", "Selected Add-ons", a.addonIds, b.addonIds),
    ...diffVariables(a, b),
    ...diffText("terms", "Terms", a.terms, b.terms),
    ...diffText("policies", "Policies", a.policies, b.policies),
    ...diffImages(a, b),
  ];

  return {
    versionANumber: versionA.version_number,
    versionBNumber: versionB.version_number,
    diffs,
    hasChanges: diffs.length > 0,
  };
}
