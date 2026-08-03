import { validateNodeConstraints } from "@/core/knowledge/relationshipConstraintsEngine";
import { recommendationsFromMissingRequirements, recommendationsFromViolations } from "@/core/knowledge/operationalRecommendationEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { CompletenessResult, ReadinessScore } from "@/types/businessHealth";

/**
 * v2.0 Checkpoint 25, Step 15.5 — Readiness Engine. Composes two things that
 * already exist rather than re-detecting anything: `relationshipConstraintsEngine`
 * (Step 10.7) supplies blocking/warning-level violations for *any* node
 * type (Client/Proposal/Invoice/Event/Vendor/Workspace/Asset/Collection all
 * flow through the same `validateNodeConstraints` call, since constraints
 * are declared per node type in the registry, not per readiness check),
 * and `CompletenessEngine` (Step 15.5, earlier) supplies the entity-specific
 * missing requirements for the four node types it currently covers
 * (Proposal/Event/Client/Vendor). Entity data-fetching stays in the module
 * layer — this engine only ever receives an already-computed
 * `CompletenessResult`, keeping it a pure function like every other engine
 * in this checkpoint.
 *
 * Invoice/Workspace/Asset/Collection readiness is constraint-only for now
 * (`completeness: null`) — there is no dedicated Completeness Engine
 * evaluator for those node types yet, so their `missingRequirements` is
 * always `[]`. This is a disclosed simplification, not a silent gap: it's
 * called out in `docs/readiness-engine.md`.
 */

export interface ComputeReadinessScoreInput {
  node: KnowledgeNodeRef;
  relationships: KnowledgeRelationship[];
  /** Pre-computed by the caller via `completenessEngine.ts` when the node type has an evaluator; `null` otherwise. */
  completeness: CompletenessResult | null;
  /** Injected rather than read from `Date.now()`, so the engine stays a pure, deterministically-testable function. */
  evaluatedAt: string;
}

const HARD_VIOLATION_PENALTY = 20;
const SOFT_VIOLATION_PENALTY = 5;

export function computeReadinessScore(input: ComputeReadinessScoreInput): ReadinessScore {
  const constraintViolations = validateNodeConstraints(input.node, input.relationships);
  const hardViolations = constraintViolations.filter((v) => v.constraint.severity === "hard");
  const softViolations = constraintViolations.filter((v) => v.constraint.severity === "soft");

  const missingRequirements = input.completeness?.missingRequirements ?? [];
  const blockingIssues = hardViolations.map((v) => v.message);
  const warnings = softViolations.map((v) => v.message);

  const completenessScore = input.completeness?.score ?? 100;
  const penalty = hardViolations.length * HARD_VIOLATION_PENALTY + softViolations.length * SOFT_VIOLATION_PENALTY;
  const overallScore = Math.max(0, Math.min(completenessScore, 100) - penalty);

  const suggestedNextSteps = [
    ...recommendationsFromMissingRequirements(input.node, missingRequirements),
    ...recommendationsFromViolations(
      constraintViolations.map((v) => ({ ruleId: v.constraint.id, description: v.message, node: v.node, severity: v.constraint.severity })),
    ),
  ];

  return {
    node: input.node,
    overallScore,
    missingRequirements,
    warnings,
    blockingIssues,
    suggestedNextSteps,
    lastEvaluatedAt: input.evaluatedAt,
  };
}
