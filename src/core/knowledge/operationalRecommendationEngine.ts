import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { BusinessRuleViolation, OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";

/**
 * v2.0 Checkpoint 25, Step 15.5 — Operational Recommendation Engine. Every
 * recommendation is a plain lookup from an already-computed finding (a
 * `CompletenessEngine` missing requirement, or a `BusinessRuleEngine`
 * violation) to a human action — this file detects nothing itself, it only
 * translates. "Recommendations must always reference the exact business
 * rule that generated them" (spec) — every `OperationalRecommendation` here
 * carries the originating `ruleId`, never a bare message.
 */

interface RecommendationTemplate {
  ruleId: string;
  message: string;
  severity: RecommendationSeverity;
}

/** One rule id per Completeness Engine missing-requirement label — a lookup table, not a second detector. The requirement strings themselves are produced once, in `completenessEngine.ts`. */
const COMPLETENESS_RECOMMENDATIONS: Record<string, RecommendationTemplate> = {
  "Missing Hero Image": { ruleId: "proposal_completeness.hero_image", message: "Upload a Hero Image.", severity: "warning" },
  "Missing Contract": { ruleId: "proposal_completeness.contract", message: "Attach the required contract.", severity: "critical" },
  "Missing Pricing": { ruleId: "proposal_completeness.pricing", message: "Add pricing to this proposal.", severity: "critical" },
  "Missing Approval": { ruleId: "proposal_completeness.approval", message: "Complete the missing approval.", severity: "warning" },
  "Missing Attachments": { ruleId: "proposal_completeness.attachments", message: "Attach required documents.", severity: "info" },
  "Missing Timeline": { ruleId: "event_completeness.timeline", message: "Build out the Event timeline.", severity: "warning" },
  "Missing Vendor": { ruleId: "event_completeness.vendor", message: "Assign a vendor to this Event.", severity: "warning" },
  "Missing Checklist": { ruleId: "event_completeness.checklist", message: "Create a checklist for this Event.", severity: "warning" },
  "Missing Payment": { ruleId: "event_completeness.payment", message: "Create an invoice for this Event.", severity: "critical" },
  "Missing Assets": { ruleId: "event_completeness.assets", message: "Upload assets for this Event.", severity: "info" },
  "Missing Team": { ruleId: "event_completeness.team", message: "Assign an owner.", severity: "warning" },
  "Missing Contact Information": { ruleId: "client_completeness.contact_info", message: "Collect this Client's phone number.", severity: "warning" },
  "Missing Signed Agreement": { ruleId: "client_completeness.signed_agreement", message: "Obtain a signed agreement from this Client.", severity: "critical" },
  "Missing Documents": { ruleId: "client_completeness.documents", message: "Request required documents from this Client.", severity: "info" },
  "Vendor Is Inactive": { ruleId: "vendor_completeness.status", message: "Reactivate or archive this Vendor.", severity: "warning" },
};

/** Friendlier action phrasing for the two `BusinessRuleEngine`-only rule ids; every other `ruleId` falls back to the constraint's own `description` (already a real sentence from `relationshipConstraintsRegistry.ts`), so no rule ever goes unrecommended for lack of a template entry here. */
const VIOLATION_MESSAGE_OVERRIDES: Record<string, string> = {
  circular_dependency: "Resolve the circular relationship.",
  invalid_parent_folder: "Fix or remove the folder's broken parent reference.",
};

export function recommendationsFromMissingRequirements(node: KnowledgeNodeRef, missingRequirements: string[]): OperationalRecommendation[] {
  return missingRequirements.map((requirement) => {
    const template = COMPLETENESS_RECOMMENDATIONS[requirement];
    return template
      ? { ruleId: template.ruleId, message: template.message, severity: template.severity, node }
      : { ruleId: `completeness.${requirement.toLowerCase().replace(/\s+/g, "_")}`, message: requirement, severity: "warning" as const, node };
  });
}

export function recommendationsFromViolations(violations: BusinessRuleViolation[]): OperationalRecommendation[] {
  return violations.map((v) => ({
    ruleId: v.ruleId,
    message: VIOLATION_MESSAGE_OVERRIDES[v.ruleId] ?? v.description,
    severity: v.severity === "hard" ? "critical" : "warning",
    node: v.node,
  }));
}
