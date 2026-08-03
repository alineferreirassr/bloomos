"use client";

import { useEffect, useMemo, useState } from "react";
import { getCapabilityRequirementAction, evaluateCapabilityRequirementAction } from "@/modules/capability/capabilityActions";
import { listWorkersAction } from "@/modules/workforce/workforceActions";
import { explainCapabilityEvaluation } from "@/core/capability/capabilityExplanationEngine";
import type { CapabilityRequirement, RequirementEvaluationResult, WorkerRankingEntry } from "@/types/capability";
import type { Worker } from "@/types/workforce";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 26.1, Step 22 — Capability Requirement Detail View.
 * Displays the full evaluation: hard/soft requirements, every worker's
 * eligibility state and rank, score breakdown, and the human-readable
 * explanation for each — never collapsed into a bare number.
 */
const STATE_TONE: Record<WorkerRankingEntry["eligibility"]["state"], BadgeTone> = {
  eligible: "success",
  conditionally_eligible: "warning",
  ineligible: "danger",
  unknown: "neutral",
};
const STATE_LABEL: Record<WorkerRankingEntry["eligibility"]["state"], string> = {
  eligible: "Eligible",
  conditionally_eligible: "Conditionally Eligible",
  ineligible: "Ineligible",
  unknown: "Unknown",
};

function WorkerRankingRow({ entry, workerName }: { entry: WorkerRankingEntry; workerName: string }) {
  const [expanded, setExpanded] = useState(false);
  const explanation = useMemo(() => explainCapabilityEvaluation(entry.eligibility, entry.scores), [entry]);

  return (
    <li role="listitem" className="border-b border-border/50 py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {entry.rank !== null ? <span className="text-xs font-semibold text-text-muted">#{entry.rank}</span> : null}
          <Badge tone={STATE_TONE[entry.eligibility.state]}>{STATE_LABEL[entry.eligibility.state]}</Badge>
          <span className="text-sm font-medium">{workerName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Score {entry.scores.overallCapabilityScore}</span>
          <Button variant="secondary" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} explanation for ${workerName}`}>
            {expanded ? "Hide" : "Explain"}
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-2 space-y-2 rounded-md bg-surface-muted p-3 text-xs">
          <p>{explanation.summary}</p>
          {explanation.blockingReasons.length > 0 ? (
            <div>
              <p className="font-semibold">Blocking reasons</p>
              <ul className="list-disc pl-4">
                {explanation.blockingReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {explanation.expiringCertificationNotes.length > 0 ? (
            <div>
              <p className="font-semibold">Expiring soon</p>
              <ul className="list-disc pl-4">
                {explanation.expiringCertificationNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="font-semibold">Score breakdown</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {explanation.scoreBreakdown.map((s) => (
                <div key={s.label} className="flex justify-between">
                  <dt className="text-text-muted">{s.label}</dt>
                  <dd className="font-mono tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function RequirementDetailView({ requirementId }: { requirementId: string }) {
  const [requirement, setRequirement] = useState<CapabilityRequirement | null>(null);
  const [evaluation, setEvaluation] = useState<RequirementEvaluationResult | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCapabilityRequirementAction(requirementId), evaluateCapabilityRequirementAction(requirementId), listWorkersAction()]).then(([reqResult, evalResult, workersResult]) => {
      if (cancelled) return;
      if (reqResult.success) setRequirement(reqResult.data);
      else setError(reqResult.error);
      if (evalResult.success) setEvaluation(evalResult.data);
      else if (reqResult.success) setError(evalResult.error);
      if (workersResult.success) setWorkers(workersResult.data);
    });
    return () => {
      cancelled = true;
    };
  }, [requirementId]);

  async function reevaluate() {
    setLoading(true);
    const result = await evaluateCapabilityRequirementAction(requirementId);
    if (result.success) setEvaluation(result.data);
    else setError(result.error);
    setLoading(false);
  }

  const workerNameById = useMemo(() => new Map(workers.map((w) => [w.id, `${w.first_name} ${w.last_name}`] as const)), [workers]);
  const eligible = useMemo(() => evaluation?.ranking.filter((r) => r.eligibility.state === "eligible") ?? [], [evaluation]);
  const conditional = useMemo(() => evaluation?.ranking.filter((r) => r.eligibility.state === "conditionally_eligible") ?? [], [evaluation]);
  const ineligible = useMemo(() => evaluation?.ranking.filter((r) => r.eligibility.state === "ineligible" || r.eligibility.state === "unknown") ?? [], [evaluation]);

  if (error) return <EmptyState title="This capability requirement isn't available" description={error} icon={AnalyticsIcon} />;
  if (!requirement || !evaluation) return <p className="text-sm text-text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader
        title={requirement.title}
        subtitle={requirement.description ?? "No description."}
        icon={AnalyticsIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: "Workforce", href: "/assets/workforce" }, { label: "Capabilities", href: "/assets/workforce/capabilities" }, { label: requirement.title }]}
        actions={
          <Button variant="secondary" onClick={reevaluate} disabled={loading}>
            {loading ? "Evaluating…" : "Re-evaluate"}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Hard Requirements</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Required skills</dt>
              <dd>{requirement.required_skills.join(", ") || "None"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Required certifications</dt>
              <dd>{requirement.required_certifications.join(", ") || "None"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Required languages</dt>
              <dd>{requirement.required_languages.join(", ") || "None"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Minimum experience</dt>
              <dd>{requirement.minimum_experience_level ?? "None"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold">Soft Preferences</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Preferred skills</dt>
              <dd>{requirement.preferred_skills.join(", ") || "None"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Preferred certifications</dt>
              <dd>{requirement.preferred_certifications.join(", ") || "None"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Preferred languages</dt>
              <dd>{requirement.preferred_languages.join(", ") || "None"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Eligible <span className="font-normal text-text-muted">({eligible.length})</span>
        </h2>
        {eligible.length === 0 ? <p className="text-sm text-text-muted">No eligible workers.</p> : <ul role="list">{eligible.map((e) => <WorkerRankingRow key={e.workerId} entry={e} workerName={workerNameById.get(e.workerId) ?? e.workerId} />)}</ul>}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Conditionally Eligible <span className="font-normal text-text-muted">({conditional.length})</span>
        </h2>
        {conditional.length === 0 ? <p className="text-sm text-text-muted">None.</p> : <ul role="list">{conditional.map((e) => <WorkerRankingRow key={e.workerId} entry={e} workerName={workerNameById.get(e.workerId) ?? e.workerId} />)}</ul>}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Ineligible <span className="font-normal text-text-muted">({ineligible.length})</span>
        </h2>
        {ineligible.length === 0 ? (
          <p className="text-sm text-success">Every evaluated worker is at least conditionally eligible.</p>
        ) : (
          <ul role="list">{ineligible.map((e) => <WorkerRankingRow key={e.workerId} entry={e} workerName={workerNameById.get(e.workerId) ?? e.workerId} />)}</ul>
        )}
      </Card>
    </div>
  );
}
