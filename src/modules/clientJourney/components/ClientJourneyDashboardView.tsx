"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listClientJourneysAction, type ClientJourneySummary } from "@/modules/clientJourney/clientJourneyActions";
import { JOURNEY_STAGE_DEFAULT_LABELS, type JourneyStage, type JourneySubjectType } from "@/types/clientJourney";
import { journeyRouteId } from "@/modules/clientJourney/journeyRoute";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { CrmIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 32, Step 17 — Client Journey Dashboard. Read-only
 * aggregate over `listClientJourneysAction()`'s own already-evaluated
 * summaries — coordinates the existing CRM/commercial modules, never a
 * second source of truth for any of them. Stage buckets are computed
 * client-side from the same `currentStage` every Journey Detail page
 * shows, so the Dashboard and Detail page can never disagree.
 */

const STAGE_BUCKETS: { id: string; label: string; stages: JourneyStage[] }[] = [
  { id: "new_leads", label: "New Leads", stages: ["new_lead"] },
  { id: "contact_pending", label: "Contact Pending", stages: ["contacted"] },
  { id: "proposal_pending", label: "Proposal Pending", stages: ["qualified", "discovery", "proposal_preparation", "proposal_sent", "negotiation"] },
  { id: "contract_pending", label: "Contract Pending", stages: ["proposal_accepted", "contract_preparation"] },
  { id: "signature_pending", label: "Signature Pending", stages: ["contract_sent"] },
  { id: "deposit_pending", label: "Deposit Pending", stages: ["contract_signed", "invoice_preparation", "invoice_sent", "deposit_pending"] },
  { id: "welcome_pending", label: "Welcome Pending", stages: ["deposit_paid"] },
  { id: "portal_setup_pending", label: "Portal Setup Pending", stages: ["welcome"] },
  { id: "planning", label: "Planning", stages: ["portal_activated", "planning"] },
  { id: "service_in_progress", label: "Service in Progress", stages: ["ready_for_service", "service_in_progress"] },
  { id: "final_balance_pending", label: "Final Balance Pending", stages: ["service_completed", "final_balance_pending"] },
  { id: "follow_up_due", label: "Follow-Up Due", stages: ["closed", "follow_up"] },
  { id: "review_pending", label: "Review Pending", stages: ["review_requested"] },
  { id: "rebooking_opportunities", label: "Rebooking Opportunities", stages: ["review_received", "rebooking_opportunity"] },
  { id: "lost_and_cancelled", label: "Lost and Cancelled", stages: ["lost", "cancelled"] },
];

const STATUS_TONE: Record<ClientJourneySummary["status"], BadgeTone> = {
  active: "success",
  at_risk: "warning",
  blocked: "danger",
  completed: "accent",
  lost: "neutral",
  cancelled: "neutral",
};

export function ClientJourneyDashboardView() {
  const [journeys, setJourneys] = useState<ClientJourneySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [subjectFilter, setSubjectFilter] = useState<"all" | JourneySubjectType>("all");

  useEffect(() => {
    let cancelled = false;
    listClientJourneysAction().then((result) => {
      if (cancelled) return;
      if (result.success) setJourneys(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!journeys) return [];
    return journeys.filter((j) => {
      if (subjectFilter !== "all" && j.subjectType !== subjectFilter) return false;
      if (stageFilter === "all") return true;
      const bucket = STAGE_BUCKETS.find((b) => b.id === stageFilter);
      return bucket ? bucket.stages.includes(j.currentStage) : true;
    });
  }, [journeys, stageFilter, subjectFilter]);

  const bucketCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bucket of STAGE_BUCKETS) {
      counts.set(bucket.id, (journeys ?? []).filter((j) => bucket.stages.includes(j.currentStage)).length);
    }
    return counts;
  }, [journeys]);

  const activeCount = (journeys ?? []).filter((j) => j.status === "active").length;
  const atRiskCount = (journeys ?? []).filter((j) => j.status === "at_risk").length;
  const blockedCount = (journeys ?? []).filter((j) => j.status === "blocked").length;
  const avgHealth = journeys && journeys.length > 0 ? Math.round(journeys.reduce((sum, j) => sum + j.overallHealth, 0) / journeys.length) : 0;

  if (error) return <EmptyState title="The Client Journey Platform isn't available" description={error} icon={CrmIcon} />;

  return (
    <div>
      <PageHeader
        title="Client Journeys"
        subtitle="Coordinates the existing CRM and client-facing systems into one continuous journey — never a second source of truth for Leads, Clients, Proposals, Contracts, Invoices, or Events."
        icon={CrmIcon}
        breadcrumb={[{ label: "Client Journeys" }]}
      />

      {journeys ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Active Journeys" value={String(activeCount)} icon={AnalyticsIcon} />
            <KpiCard label="At Risk" value={String(atRiskCount)} icon={AnalyticsIcon} />
            <KpiCard label="Blocked" value={String(blockedCount)} icon={AnalyticsIcon} />
            <KpiCard label="Average Journey Health" value={String(avgHealth)} icon={CheckIcon} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-text-muted" htmlFor="journey-subject-filter">
              Type
            </label>
            <select id="journey-subject-filter" className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as "all" | JourneySubjectType)}>
              <option value="all">All</option>
              <option value="lead">Leads</option>
              <option value="client">Clients</option>
            </select>
            <label className="text-sm text-text-muted" htmlFor="journey-stage-filter">
              Stage
            </label>
            <select id="journey-stage-filter" className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
              <option value="all">All Stages</option>
              {STAGE_BUCKETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({bucketCounts.get(b.id) ?? 0})
                </option>
              ))}
            </select>
          </div>

          <Card>
            {filtered.length === 0 ? (
              <EmptyState title="No journeys match this filter" description="Try a different stage or type." icon={CrmIcon} />
            ) : (
              <ul role="list">
                {filtered.map((j) => (
                  <li key={`${j.subjectType}:${j.subjectId}`} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/client-journeys/${encodeURIComponent(journeyRouteId(j.subjectType, j.subjectId))}`} className="truncate text-sm font-medium hover:underline">
                        {j.displayName}
                      </Link>
                      <p className="text-xs text-text-muted">
                        {j.subjectType === "lead" ? "Lead" : "Client"} · {JOURNEY_STAGE_DEFAULT_LABELS[j.currentStage]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {j.criticalBlockerCount > 0 && <Badge tone="danger">{j.criticalBlockerCount} critical blocker{j.criticalBlockerCount === 1 ? "" : "s"}</Badge>}
                      {j.blockerCount > 0 && j.criticalBlockerCount === 0 && <Badge tone="warning">{j.blockerCount} blocker{j.blockerCount === 1 ? "" : "s"}</Badge>}
                      <Badge tone="neutral">{j.overallProgress}%</Badge>
                      <Badge tone={STATUS_TONE[j.status]}>{j.status.replace("_", " ")}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : (
        <p className="text-sm text-text-muted">Loading journeys…</p>
      )}
    </div>
  );
}
