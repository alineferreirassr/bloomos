import type { OperationalSnapshot, OperationalStatus } from "@/types/operationsCenter";

/**
 * v2.0 Checkpoint 31, Step 4 — Operational Status Engine. A pure,
 * deterministic function over the Snapshot's own already-aggregated
 * facts (Step 2) — never a second health/priority calculation of its
 * own. `unknown`/`degraded` are about the aggregation itself (nothing
 * ever fetched vs. too much of what was fetched being stale/missing to
 * trust); `critical`/`at_risk`/`attention`/`normal` are about the
 * operation's own facts, evaluated only once there is enough real data
 * to judge them. Most-severe-wins: the first matching tier is returned.
 */

const DEGRADED_CONFIDENCE_FLOOR = 50;

export function computeOperationalStatus(snapshot: OperationalSnapshot): OperationalStatus {
  if (snapshot.sourceOutcomes.length === 0) return "unknown";
  if (snapshot.confidence < DEGRADED_CONFIDENCE_FLOOR) return "degraded";

  const { liveOperations } = snapshot;

  const isCritical =
    snapshot.criticalExecutiveDecisions > 0 ||
    snapshot.executionPackagesNotReady > 0 ||
    liveOperations.blockedFieldOperations > 0 ||
    snapshot.businessHealthScore < 40 ||
    snapshot.knowledgeHealthScore < 40;
  if (isCritical) return "critical";

  const isAtRisk =
    liveOperations.highRiskRoutes > 0 ||
    snapshot.allocationRisks > 0 ||
    snapshot.schedulingConflicts > 0 ||
    snapshot.businessHealthScore < 70 ||
    snapshot.knowledgeHealthScore < 70;
  if (isAtRisk) return "at_risk";

  const needsAttention =
    snapshot.capacityAlerts > 0 ||
    liveOperations.declinedAssignments > 0 ||
    liveOperations.expiredAssignments > 0 ||
    liveOperations.pausedFieldOperations > 0 ||
    snapshot.businessHealthScore < 90 ||
    snapshot.knowledgeHealthScore < 90;
  if (needsAttention) return "attention";

  return "normal";
}
