import type { ExecutionSession, ExecutionValidationResult, ExecutionHealthScores, ExecutionState, FieldOperationFinding, FieldOperationFindingSeverity } from "@/types/fieldOperations";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 29, Step 11 — Executive Integration's risk detection
 * half. 7 named, deterministic detectors over already-computed data —
 * no AI, no randomness, no new evaluation logic. Every detector reads
 * a session's own already-computed validation/health/state — the caller
 * (`fieldOperationsActions.ts`) resolves all of it via
 * `ExecutionValidationEngine`/`ExecutionHealthEngine`/`ExecutionStateEngine`,
 * this file re-implements none of it.
 */

const HEALTHY_THRESHOLD = 80;
const EXECUTION_DELAY_PAUSE_HEALTH_THRESHOLD = 60;
/** How far actual execution time may exceed the frozen plan's own summed `estimated_duration_minutes` before it counts as an operational delay — 50% over budget. */
const OPERATIONAL_DELAY_OVERRUN_RATIO = 1.5;

function finding(type: FieldOperationFinding["type"], severity: FieldOperationFindingSeverity, description: string, relatedFieldOperationId: string): FieldOperationFinding {
  return { id: generateId("field_operation_finding"), type, severity, description, relatedFieldOperationId };
}

export interface FieldOperationRiskInput {
  fieldOperationId: string;
  session: ExecutionSession;
  validation: ExecutionValidationResult;
  health: ExecutionHealthScores;
  state: ExecutionState;
  /** Sum of `estimated_duration_minutes * 60` across every step in the frozen snapshot — resolved by the caller, never re-derived here. */
  estimatedDurationSeconds: number;
}

export function detectFieldOperationRisks(inputs: FieldOperationRiskInput[]): FieldOperationFinding[] {
  const findings: FieldOperationFinding[] = [];

  for (const input of inputs) {
    const { fieldOperationId, session, validation, health, state } = input;
    const label = `Field operation "${fieldOperationId}"`;

    // 1. Execution Blocked
    if (!validation.valid) {
      findings.push(finding("execution_blocked", "high", `${label} is blocked by validation issues and cannot start.`, fieldOperationId));
    }

    // 2. Execution Paused
    if (session.lifecycle_state === "paused") {
      findings.push(finding("execution_paused", "medium", `${label}'s session is currently paused.`, fieldOperationId));
    }

    // 3. Execution Failed
    if (session.outcome === "failed") {
      findings.push(finding("execution_failed", "high", `${label}'s session failed${session.reason ? `: ${session.reason}` : "."}`, fieldOperationId));
    }

    // 4. Execution Healthy
    if (validation.valid && health.overallOperationalHealth >= HEALTHY_THRESHOLD) {
      findings.push(finding("execution_healthy", "low", `${label} is healthy (${health.overallOperationalHealth}/100).`, fieldOperationId));
    }

    // 5. Execution Completed
    if (session.outcome === "completed") {
      findings.push(finding("execution_completed", "low", `${label}'s session completed successfully.`, fieldOperationId));
    }

    // 6. Execution Delayed — this session's own pace, via how much of its elapsed time has been spent paused.
    if (health.pauseHealth < EXECUTION_DELAY_PAUSE_HEALTH_THRESHOLD) {
      findings.push(finding("execution_delayed", "medium", `${label} has spent a large share of its elapsed time paused (pause health ${health.pauseHealth}/100).`, fieldOperationId));
    }

    // 7. Operational Delay — actual execution time significantly exceeds the frozen plan's own estimated duration.
    if (input.estimatedDurationSeconds > 0 && state.executionDurationSeconds > input.estimatedDurationSeconds * OPERATIONAL_DELAY_OVERRUN_RATIO) {
      findings.push(finding("operational_delay", "medium", `${label} has run ${state.executionDurationSeconds}s of execution against a ${input.estimatedDurationSeconds}s estimate.`, fieldOperationId));
    }
  }

  return findings;
}
