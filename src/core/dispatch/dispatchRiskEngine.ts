import type { DispatchOrderResult, DispatchFinding, DispatchFindingSeverity } from "@/types/dispatch";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 28, Step 11 — Executive Integration's risk detection
 * half. Six named, deterministic detectors over already-computed data —
 * no AI, no randomness, no new evaluation logic. Every detector reads a
 * `DispatchOrderResult` the caller already assembled from
 * `DispatchValidationEngine`/`DispatchHealthEngine` — mirrors
 * `executionPackageRiskEngine.ts`'s shape exactly, just against the
 * Dispatch domain's own bundled result type instead of separate maps.
 */

const LOW_ACCEPTANCE_THRESHOLD = 60;
const QUEUE_CONGESTION_THRESHOLD = 60;

function finding(type: DispatchFinding["type"], severity: DispatchFindingSeverity, description: string, relatedOrderId: string): DispatchFinding {
  return { id: generateId("dispatch_finding"), type, severity, description, relatedOrderId };
}

export function detectDispatchRisks(results: DispatchOrderResult[]): DispatchFinding[] {
  const findings: DispatchFinding[] = [];

  for (const { order, validation, health } of results) {
    const label = `Dispatch order "${order.id}"`;

    // 1. Dispatch Blocked
    if (!validation.valid) {
      findings.push(finding("dispatch_blocked", "high", `${label} is blocked by validation issues and cannot be dispatched as-is.`, order.id));
    }

    // 2. Dispatch Ready
    if (validation.valid && health.dispatchReadiness === 100) {
      findings.push(finding("dispatch_ready", "low", `${label} is ready to dispatch.`, order.id));
    }

    // 3. Low Acceptance Rate
    if (health.acceptanceRate < LOW_ACCEPTANCE_THRESHOLD) {
      findings.push(finding("low_acceptance_rate", "medium", `${label} has a low acceptance rate (${health.acceptanceRate}/100).`, order.id));
    }

    // 4. Queue Congestion
    if (health.queueHealth < QUEUE_CONGESTION_THRESHOLD) {
      findings.push(finding("queue_congestion", "medium", `${label}'s queue is congested (queue health ${health.queueHealth}/100, ${health.pendingCount} pending).`, order.id));
    }

    // 5. Assignment Failure + 6. Resource Rejected
    for (const assignment of order.assignments) {
      if (assignment.queue_state === "expired") {
        findings.push(finding("assignment_failure", "high", `${label}'s assignment for ${assignment.resource_type} "${assignment.resource_id}" expired without a response.`, order.id));
      }
      if (assignment.queue_state === "declined") {
        const reason = assignment.reason !== null ? `: ${assignment.reason}` : "";
        findings.push(finding("resource_rejected", "medium", `${label}'s assignment for ${assignment.resource_type} "${assignment.resource_id}" was declined${reason}.`, order.id));
      }
    }
  }

  return findings;
}
