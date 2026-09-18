import { Activity, AlertTriangle, CalendarClock, ClipboardCheck, Route, Siren } from "lucide-react";
import { StudioTodayCard, type StudioTodayCardData } from "@/modules/workspace/components/StudioTodayCard";
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
 * KPIs. `meta` is intentionally omitted on every card — none of these six
 * counts have a truthful "next 14 days"-style qualifier to show.
 */
export function StudioTodaySection({ kpis }: { kpis: OperationalKpiSnapshot }) {
  const cards: StudioTodayCardData[] = [
    { id: "active-operations", label: "Active Operations", value: String(kpis.activeOperations), icon: Activity, href: "/operations-center", tone: "blush" },
    { id: "approvals-waiting", label: "Approvals Waiting", value: String(kpis.pendingAcceptances), icon: ClipboardCheck, href: "/operations-center", tone: "champagne" },
    { id: "scheduling-conflicts", label: "Scheduling Conflicts", value: String(kpis.schedulingConflicts), icon: CalendarClock, href: "/operations-center", tone: "champagne" },
    { id: "high-risk-routes", label: "High-Risk Routes", value: String(kpis.highRiskRoutes), icon: Route, href: "/route-optimization", tone: "champagne" },
    { id: "open-incidents", label: "Open Incidents", value: String(kpis.openIncidents), icon: AlertTriangle, href: "/operations-center", tone: "rose" },
    { id: "critical-alerts", label: "Critical Alerts", value: String(kpis.criticalAlerts), icon: Siren, href: "/operations-center", tone: "rose" },
  ];

  return (
    <div>
      <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-coral uppercase">At a Glance</p>
      <h2 className="mt-1 font-luxury-display text-luxury-page font-semibold text-luxury-text">The studio today</h2>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <StudioTodayCard key={card.id} data={card} />
        ))}
      </div>
    </div>
  );
}
