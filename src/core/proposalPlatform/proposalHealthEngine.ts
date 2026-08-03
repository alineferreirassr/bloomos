import type { ProposalDraft } from "@/types/proposal";
import type { ProposalBuilderState, ProposalHealth, ProposalHealthCategoryScore, ProposalVersion } from "@/types/proposalPlatform";

/**
 * v2.0 Checkpoint 33 — Proposal Health Engine (Step 10). Mirrors Business
 * Health's own `categoryFrom*`/"average of non-null scores" pattern
 * (`core/knowledge/businessHealthEngine.ts`, Checkpoint 25) rather than
 * importing it directly — `HealthCategory` there is BusinessHealth's own
 * closed 11-item union, not extensible with these 7 Proposal-specific
 * categories. `journey_readiness` reuses an already-computed Client
 * Journey health score passed in by the caller (never recalculated here),
 * the same "compose, don't duplicate" discipline every cross-checkpoint
 * integration in this codebase follows.
 */

function scoreCategory(category: ProposalHealthCategoryScore["category"], score: number, issues: string[]): ProposalHealthCategoryScore {
  return { category, score: Math.max(0, Math.min(100, Math.round(score))), issues, notApplicableReason: null };
}

function notApplicable(category: ProposalHealthCategoryScore["category"], reason: string): ProposalHealthCategoryScore {
  return { category, score: null, issues: [], notApplicableReason: reason };
}

export interface ComputeProposalHealthInput {
  proposal: ProposalDraft;
  builderState: ProposalBuilderState | null;
  currentVersion: ProposalVersion | null;
  hasClient: boolean;
  requiredSectionKeys: string[];
  /** An already-computed Client Journey health score (0–100) for this proposal's client/lead, when the Client Journey Platform has one — `null` when no journey context is available, scored `notApplicable` rather than fabricated. */
  journeyReadinessScore: number | null;
  evaluatedAt: string;
}

export function computeProposalHealth(input: ComputeProposalHealthInput): ProposalHealth {
  const { currentVersion } = input;
  const snapshot = currentVersion?.snapshot ?? null;

  const categories: ProposalHealthCategoryScore[] = [];

  // completeness — the core fields every real proposal needs before it's presentable.
  if (!snapshot) {
    categories.push(notApplicable("completeness", "No proposal document has been built yet."));
  } else {
    const checks: Array<[boolean, string]> = [
      [snapshot.header.title.trim().length > 0, "Header title is missing."],
      [snapshot.hero.headline.trim().length > 0, "Hero headline is missing."],
      [snapshot.sections.length > 0, "No sections have been added."],
      [snapshot.pricing.lineItems.length > 0, "No pricing line items have been added."],
      [snapshot.terms.trim().length > 0, "Terms are missing."],
      [snapshot.policies.trim().length > 0, "Policies are missing."],
      [input.hasClient, "No linked client record."],
    ];
    const failed = checks.filter(([ok]) => !ok);
    categories.push(scoreCategory("completeness", ((checks.length - failed.length) / checks.length) * 100, failed.map(([, issue]) => issue)));
  }

  // pricing_health
  if (!snapshot) {
    categories.push(notApplicable("pricing_health", "No proposal document has been built yet."));
  } else {
    const issues: string[] = [];
    if (snapshot.pricing.lineItems.length === 0) issues.push("No pricing lines configured.");
    if (snapshot.pricing.grandTotal_minor <= 0) issues.push("Grand total is zero.");
    if (snapshot.pricing.depositDue_minor === 0) issues.push("No deposit configured.");
    categories.push(scoreCategory("pricing_health", 100 - issues.length * 20, issues));
  }

  // content_health — ratio of sections that carry at least one block with real content.
  if (!snapshot || snapshot.sections.length === 0) {
    categories.push(notApplicable("content_health", "No sections exist yet to evaluate content for."));
  } else {
    const emptySections = snapshot.sections.filter((s) => s.blocks.length === 0 || s.blocks.every((b) => !b.text?.trim() && !b.heading?.trim() && b.items.length === 0 && b.mediaAssetIds.length === 0 && b.packageIds.length === 0));
    categories.push(scoreCategory("content_health", ((snapshot.sections.length - emptySections.length) / snapshot.sections.length) * 100, emptySections.map((s) => `"${s.title}" has no content yet.`)));
  }

  // required_sections
  if (!snapshot) {
    categories.push(notApplicable("required_sections", "No proposal document has been built yet."));
  } else if (input.requiredSectionKeys.length === 0) {
    categories.push(notApplicable("required_sections", "No template is selected, so no sections are required yet."));
  } else {
    const presentKeys = new Set(snapshot.sections.map((s) => s.key));
    const missing = input.requiredSectionKeys.filter((k) => !presentKeys.has(k as never));
    categories.push(scoreCategory("required_sections", ((input.requiredSectionKeys.length - missing.length) / input.requiredSectionKeys.length) * 100, missing.map((k) => `Missing required section: ${k}`)));
  }

  // required_pricing
  if (!snapshot) {
    categories.push(notApplicable("required_pricing", "No proposal document has been built yet."));
  } else {
    const hasPricing = snapshot.pricing.lineItems.length > 0 && snapshot.pricing.grandTotal_minor > 0;
    categories.push(scoreCategory("required_pricing", hasPricing ? 100 : 0, hasPricing ? [] : ["Pricing has not been configured."]));
  }

  // template_health
  if (!snapshot) {
    categories.push(notApplicable("template_health", "No proposal document has been built yet."));
  } else {
    categories.push(scoreCategory("template_health", snapshot.templateKey ? 100 : 60, snapshot.templateKey ? [] : ["No template was used to build this proposal."]));
  }

  // journey_readiness
  if (input.journeyReadinessScore === null) {
    categories.push(notApplicable("journey_readiness", "No Client Journey context is available for this proposal's client."));
  } else {
    categories.push(scoreCategory("journey_readiness", input.journeyReadinessScore, []));
  }

  const scored = categories.filter((c): c is ProposalHealthCategoryScore & { score: number } => c.score !== null);
  const overallScore = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  return { categories, overallScore, evaluatedAt: input.evaluatedAt };
}
