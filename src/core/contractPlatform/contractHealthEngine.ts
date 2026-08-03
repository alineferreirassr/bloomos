import type { ContractBuilderState, ContractHealth, ContractHealthCategoryScore, ContractSectionKey, ContractVersion } from "@/types/contractPlatform";
import { extractVariableKeys } from "@/core/contractPlatform/variableEngine";

/**
 * v2.0 Checkpoint 34 — Contract Health Engine (Step 8). Mirrors Business
 * Health's own `categoryFrom*`/"average of non-null scores" pattern
 * (`core/knowledge/businessHealthEngine.ts`, Checkpoint 25) rather than
 * importing it directly — `HealthCategory` there is Business Health's own
 * closed 11-item union, not extensible with these 7 Contract-specific
 * categories, the same parallel-implementation discipline
 * `computeProposalHealth` (Checkpoint 33) already established.
 */

function scoreCategory(category: ContractHealthCategoryScore["category"], score: number, issues: string[]): ContractHealthCategoryScore {
  return { category, score: Math.max(0, Math.min(100, Math.round(score))), issues, notApplicableReason: null };
}

function notApplicable(category: ContractHealthCategoryScore["category"], reason: string): ContractHealthCategoryScore {
  return { category, score: null, issues: [], notApplicableReason: reason };
}

export interface ComputeContractHealthInput {
  builderState: ContractBuilderState | null;
  currentVersion: ContractVersion | null;
  hasClient: boolean;
  requiredSectionKeys: ContractSectionKey[];
  /** Resolved `ContractClause.key`s the current template marks as default (required) — never raw ids, so this engine never needs to look up the Clause Library itself. */
  requiredClauseKeys: string[];
  /** The keys of every clause actually selected on the current snapshot, resolved by the caller from `clauseIds`. */
  presentClauseKeys: string[];
  hasLinkedProposal: boolean;
  hasLinkedJourney: boolean;
  evaluatedAt: string;
}

export function computeContractHealth(input: ComputeContractHealthInput): ContractHealth {
  const { currentVersion } = input;
  const snapshot = currentVersion?.snapshot ?? null;

  const categories: ContractHealthCategoryScore[] = [];

  // completeness
  if (!snapshot) {
    categories.push(notApplicable("completeness", "No contract document has been built yet."));
  } else {
    const checks: Array<[boolean, string]> = [
      [snapshot.header.title.trim().length > 0, "Header title is missing."],
      [snapshot.sections.length > 0, "No sections have been added."],
      [snapshot.clauseIds.length > 0, "No clauses have been selected."],
      [snapshot.terms.trim().length > 0, "Terms are missing."],
      [snapshot.policies.trim().length > 0, "Policies are missing."],
      [input.hasClient, "No linked client record."],
    ];
    const failed = checks.filter(([ok]) => !ok);
    categories.push(scoreCategory("completeness", ((checks.length - failed.length) / checks.length) * 100, failed.map(([, issue]) => issue)));
  }

  // missing_variables — every {{key}} referenced across sections/clauses/terms/policies must have a real, non-empty resolved value.
  if (!snapshot) {
    categories.push(notApplicable("missing_variables", "No contract document has been built yet."));
  } else {
    const referencedKeys = new Set<string>();
    for (const section of snapshot.sections) {
      for (const block of section.blocks) {
        if (block.text) for (const key of extractVariableKeys(block.text)) referencedKeys.add(key);
        if (block.heading) for (const key of extractVariableKeys(block.heading)) referencedKeys.add(key);
      }
    }
    for (const key of extractVariableKeys(snapshot.terms)) referencedKeys.add(key);
    for (const key of extractVariableKeys(snapshot.policies)) referencedKeys.add(key);

    if (referencedKeys.size === 0) {
      categories.push(notApplicable("missing_variables", "No variable placeholders are referenced in this document."));
    } else {
      const resolvedKeys = new Set(snapshot.variables.filter((v) => v.value.trim().length > 0).map((v) => v.key));
      const missing = Array.from(referencedKeys).filter((k) => !resolvedKeys.has(k));
      categories.push(scoreCategory("missing_variables", ((referencedKeys.size - missing.length) / referencedKeys.size) * 100, missing.map((k) => `{{${k}}} has no resolved value.`)));
    }
  }

  // missing_clauses
  if (!snapshot) {
    categories.push(notApplicable("missing_clauses", "No contract document has been built yet."));
  } else if (input.requiredClauseKeys.length === 0) {
    categories.push(notApplicable("missing_clauses", "No template is selected, so no clauses are required yet."));
  } else {
    const presentSet = new Set(input.presentClauseKeys);
    const missing = input.requiredClauseKeys.filter((k) => !presentSet.has(k));
    categories.push(scoreCategory("missing_clauses", ((input.requiredClauseKeys.length - missing.length) / input.requiredClauseKeys.length) * 100, missing.map((k) => `Missing required clause: ${k}`)));
  }

  // missing_sections
  if (!snapshot) {
    categories.push(notApplicable("missing_sections", "No contract document has been built yet."));
  } else if (input.requiredSectionKeys.length === 0) {
    categories.push(notApplicable("missing_sections", "No template is selected, so no sections are required yet."));
  } else {
    const presentKeys = new Set(snapshot.sections.map((s) => s.key));
    const missing = input.requiredSectionKeys.filter((k) => !presentKeys.has(k));
    categories.push(scoreCategory("missing_sections", ((input.requiredSectionKeys.length - missing.length) / input.requiredSectionKeys.length) * 100, missing.map((k) => `Missing required section: ${k}`)));
  }

  // proposal_link
  categories.push(scoreCategory("proposal_link", input.hasLinkedProposal ? 100 : 0, input.hasLinkedProposal ? [] : ["No linked Proposal was found for this contract's event."]));

  // journey_link
  categories.push(scoreCategory("journey_link", input.hasLinkedJourney ? 100 : 0, input.hasLinkedJourney ? [] : ["No Client Journey context is available for this contract's client."]));

  // client_link
  categories.push(scoreCategory("client_link", input.hasClient ? 100 : 0, input.hasClient ? [] : ["No linked client record."]));

  const scored = categories.filter((c): c is ContractHealthCategoryScore & { score: number } => c.score !== null);
  const overallScore = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  return { categories, overallScore, evaluatedAt: input.evaluatedAt };
}
