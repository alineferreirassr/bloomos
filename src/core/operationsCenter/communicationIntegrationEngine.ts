import type { OperationalKpiSnapshot, OperationalStatus } from "@/types/operationsCenter";

/**
 * v2.0 Checkpoint 31, Step 15 — Communication Integration. Alert/Incident
 * comments and mentions are already wired structurally: `operational_alert`
 * and `operational_incident` are real `EntityType` values, so the
 * existing generic Comments/Mentions system (`getCommentsForOwnerAction`/
 * `createCommentAction`) already works against them with no Operations
 * Center-specific code of its own. Announcements and Internal Messaging
 * are existing Communication Platform surfaces this checkpoint sends
 * *content* into, never a new channel.
 *
 * The one new piece of logic Operations Center itself owns is composing
 * that content: a plain-text operational digest, built only from figures
 * this checkpoint has already computed, meant to be posted through the
 * existing Announcements/Internal Messaging systems — never sent via
 * email/SMS/push/Slack/Gmail/Outlook, which this checkpoint's own stop
 * condition forbids touching.
 */
export function buildOperationalDigest(status: OperationalStatus, kpis: OperationalKpiSnapshot): string {
  const lines: string[] = [`Operations status: ${status}.`];

  lines.push(`${kpis.activeOperations} active operation${kpis.activeOperations === 1 ? "" : "s"}, ${kpis.pausedOperations} paused, ${kpis.blockedOperations} blocked.`);
  lines.push(`${kpis.pendingAcceptances} assignment${kpis.pendingAcceptances === 1 ? "" : "s"} awaiting acceptance.`);

  if (kpis.criticalAlerts > 0) lines.push(`${kpis.criticalAlerts} critical alert${kpis.criticalAlerts === 1 ? "" : "s"} open.`);
  if (kpis.openIncidents > 0) lines.push(`${kpis.openIncidents} open incident${kpis.openIncidents === 1 ? "" : "s"}.`);
  if (kpis.highRiskRoutes > 0) lines.push(`${kpis.highRiskRoutes} route${kpis.highRiskRoutes === 1 ? "" : "s"} at high delay risk.`);
  if (kpis.schedulingConflicts > 0) lines.push(`${kpis.schedulingConflicts} scheduling conflict${kpis.schedulingConflicts === 1 ? "" : "s"}.`);

  lines.push(`${kpis.availableWorkers} of ${kpis.availableWorkers + kpis.unavailableWorkers} workers available.`);

  return lines.join(" ");
}
