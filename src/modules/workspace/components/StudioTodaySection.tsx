import Link from "next/link";
import { Activity, AlertTriangle, CalendarClock, ClipboardCheck, Route, Siren } from "lucide-react";
import { MetricStat } from "@/components/ui/MetricStat";
import { EditorialSectionHeader } from "@/components/ui/EditorialSectionHeader";
import type { OperationalKpiSnapshot } from "@/types/operationsCenter";

/**
 * VISUAL-01 Revision B, Part C — Workspace's own "At a Glance / The studio
 * today" operational overview, moved here from Home per the founder's
 * Home/Workspace split (personal+executive vs. operational command
 * center). All six figures come from `OperationalKpiSnapshot`
 * (`computeOperationalKpis()`), already computed by
 * `evaluateOperationsCenterAction()` for the `operational_overview` widget
 * below on this same page — `getWorkspaceSummaryAction` now also passes
 * the full `kpis` object through (previously only `health.overallOperationsCenterHealth`
 * was read from it). No new query, no fabricated figure, no duplication
 * of Home's own (unrelated) Revenue/Leads/Proposals/Events/Outstanding
 * KPIs.
 *
 * GLOBAL-VISUAL-03B.1 — rebuilt off the same editorial hierarchy
 * Relationships now uses, replacing six equal-weight bordered cards ("SIX
 * VALUES ≠ SIX IDENTICAL CARDS" per the founder's explicit correction).
 * "Active Operations" is the studio's one genuine headline figure (how much
 * is in motion right now) — PRIMARY, bare typography. Approvals Waiting/
 * Scheduling Conflicts/High-Risk Routes are routine operational counts a
 * founder checks but aren't urgent by themselves — SECONDARY, a quiet
 * tinted strip. Open Incidents/Critical Alerts are the two counts that are
 * actually urgent when nonzero — kept TERTIARY in scale (small, inline,
 * same treatment Relationships gives Contracts/Invitations) but never
 * demoted in color: a nonzero count still renders in the rose/critical tone
 * so it can't visually disappear the way shrinking an urgent count to grey
 * inline text would. Same six real figures, same `computeOperationalKpis()`
 * values, same destinations — presentation only.
 */
export function StudioTodaySection({ kpis }: { kpis: OperationalKpiSnapshot }) {
  const hasUrgent = kpis.openIncidents > 0 || kpis.criticalAlerts > 0;

  return (
    <div className="space-y-6">
      <EditorialSectionHeader eyebrow="At a glance" title="The studio today" />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.1fr_1.4fr] md:items-center">
        <Link href="/operations-center" className="block rounded-2xl transition-opacity duration-150 hover:opacity-80">
          <MetricStat size="primary" icon={Activity} tint="var(--color-accent)" value={String(kpis.activeOperations)} label="Active Operations" />
        </Link>
        <div className="grid grid-cols-1 divide-y divide-border/40 rounded-2xl bg-surface-tint sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <MetricStat icon={ClipboardCheck} tint="var(--color-accent-2)" value={String(kpis.pendingAcceptances)} label="Approvals Waiting" />
          <MetricStat icon={CalendarClock} tint="var(--color-accent-2)" value={String(kpis.schedulingConflicts)} label="Scheduling Conflicts" />
          <MetricStat icon={Route} tint="var(--color-accent-2)" value={String(kpis.highRiskRoutes)} label="High-Risk Routes" />
        </div>
      </div>

      <div
        className={`flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs ${hasUrgent ? "text-danger" : "text-text-muted"}`}
      >
        <Link href="/operations-center" className="flex items-center gap-1.5 hover:underline">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: hasUrgent ? "var(--color-danger)" : "var(--color-text-muted)" }} aria-hidden="true" />
          Open Incidents <strong className="font-semibold">{kpis.openIncidents}</strong>
        </Link>
        <Link href="/operations-center" className="flex items-center gap-1.5 hover:underline">
          <Siren className="h-3.5 w-3.5 shrink-0" style={{ color: hasUrgent ? "var(--color-danger)" : "var(--color-text-muted)" }} aria-hidden="true" />
          Critical Alerts <strong className="font-semibold">{kpis.criticalAlerts}</strong>
        </Link>
      </div>
    </div>
  );
}
