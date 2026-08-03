"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { registerSkillRunner, unregisterSkillRunner } from "@/core/ai/skills/runnerRegistry";
import { generateEventOperationsBrief } from "@/modules/ai/generateEventOperationsBrief";
import { EVENT_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/registerEventOperationsBriefSkill";
import type { GeneratedEventOperationsBrief, DetectedRisk } from "@/modules/ai/types";

const HEALTH_TONE = { ready: "success", waiting: "warning", blocked: "danger" } as const;
const HEALTH_LABEL = { ready: "Ready", waiting: "Needs attention", blocked: "Blocked" } as const;
const RISK_SEVERITY_TONE: Record<DetectedRisk["severity"], BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };

type SectionStatus = "idle" | "loading" | "success" | "error";

/**
 * Embedded in Event Detail rather than a standalone route — matches how
 * Notes/Timeline/Documents already live as sections there instead of their
 * own pages, and keeps Event Detail the single place to see everything
 * about one Event instead of a separate, easily-forgotten AI page. Never
 * imports the provider registry or a provider implementation directly —
 * the only thing this file calls is the server action, which is the sole
 * place a provider is ever invoked (see `generateEventOperationsBrief.ts`).
 */
export function EventOperationsBriefSection({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<SectionStatus>("idle");
  const [result, setResult] = useState<GeneratedEventOperationsBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  async function handleGenerate() {
    if (status === "loading") return; // duplicate-submit prevention
    const requestId = ++requestIdRef.current;
    setStatus("loading");
    setErrorMessage(null);

    const outcome = await generateEventOperationsBrief(eventId);

    if (requestId !== requestIdRef.current) return; // a newer request already superseded this one

    if (!outcome.success) {
      setStatus("error");
      setErrorMessage(outcome.error);
      return;
    }
    setResult(outcome.data);
    setStatus("success");
  }

  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // Scoped to this Event Detail page's lifetime — registered on mount,
  // removed on unmount, so the Bloom AI Skill Picker's "Event Operations
  // Brief" card only actually runs anything while an Event with this
  // section is open. The ref indirection lets the runner always call the
  // current `handleGenerate` (closing over the latest `eventId`/`status`)
  // without re-registering on every render.
  useEffect(() => {
    registerSkillRunner(EVENT_OPERATIONS_BRIEF_SKILL_ID, () => handleGenerateRef.current());
    return () => unregisterSkillRunner(EVENT_OPERATIONS_BRIEF_SKILL_ID);
  }, []);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-[17px] font-semibold text-text">AI Operations Brief</h3>
          <p className="mt-1 max-w-prose text-sm text-text-muted">
            Bloom AI reads this Event&apos;s current status, checklist, and schedule to draft an internal briefing and
            suggested next steps. It never changes this Event — review any recommendation before acting on it.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleGenerate}
          disabled={status === "loading"}
          aria-label={result ? "Regenerate AI brief" : "Generate AI brief"}
        >
          {status === "loading" ? "Generating…" : result ? "Regenerate" : "Generate brief"}
        </Button>
      </div>

      <div aria-live="polite" className="mt-3">
        {status === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : null}

        {status === "error" && errorMessage ? (
          <div role="alert" className="rounded-md border border-danger/60 bg-danger/10 px-4 py-2 text-sm text-danger">
            {errorMessage}
            <Button type="button" variant="ghost" onClick={handleGenerate} className="ml-2">
              Try again
            </Button>
          </div>
        ) : null}

        {status === "idle" ? <p className="text-sm text-text/55">No brief has been generated yet for this Event.</p> : null}

        {status === "success" && result ? <BriefResult result={result} /> : null}
      </div>
    </Card>
  );
}

function BriefResult({ result }: { result: GeneratedEventOperationsBrief }) {
  const { context, brief } = result;
  const generatedLabel = new Date(result.generatedAt).toLocaleString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>Generated {generatedLabel}</span>
        <Badge tone={result.mock ? "outline" : "accent"}>{result.mock ? "Development mock — not a real AI call" : "AI-generated"}</Badge>
        <Badge tone={HEALTH_TONE[context.health.status]}>{HEALTH_LABEL[context.health.status]}</Badge>
        <span title={context.confidence.reason}>Confidence: {context.confidence.score}%</span>
      </div>

      <section aria-labelledby="ai-brief-summary-heading">
        <h4 id="ai-brief-summary-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Executive Summary
        </h4>
        <p className="mt-1 text-sm text-text">{brief.executiveSummary}</p>
      </section>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Field label="Client" value={context.client?.name ?? "—"} />
        <Field label="Date" value={context.event.eventDate ?? "Not set"} />
        <Field label="Location" value={context.event.locationName ?? "Not set"} />
        <Field label="Status" value={context.event.status} />
        <Field label="Lifecycle stage" value={context.event.lifecycleStage} />
        <Field label="Assigned owner" value={context.event.assignedOwner ?? "Unassigned"} />
        <Field label="Checklist" value={`${context.checklist.completed}/${context.checklist.total} complete`} />
        <Field label="Overdue" value={context.overdueSummary} />
        <Field label="Next scheduled item" value={context.schedule.nextItem?.title ?? "None on file"} />
      </dl>

      <section aria-labelledby="ai-brief-health-heading">
        <h4 id="ai-brief-health-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Health Score Explanation
        </h4>
        <p className="mt-1 text-sm text-text">{brief.healthExplanation}</p>
      </section>

      {brief.riskExplanations.length > 0 ? (
        <section aria-labelledby="ai-brief-risks-heading">
          <h4 id="ai-brief-risks-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Detected Risks
          </h4>
          <ul className="mt-1 space-y-2">
            {brief.riskExplanations.map((item) => (
              <li key={item.risk.kind} className="text-sm text-text">
                <Badge tone={RISK_SEVERITY_TONE[item.risk.severity]}>{item.risk.label}</Badge>
                <p className="mt-1">{item.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {context.missingInformation.length > 0 ? (
        <section aria-labelledby="ai-brief-missing-heading">
          <h4 id="ai-brief-missing-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Missing information
          </h4>
          <ul className="mt-1 list-inside list-disc text-sm text-text">
            {context.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="ai-brief-actions-heading">
        <h4 id="ai-brief-actions-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Recommended Actions
        </h4>
        <p className="mt-1 text-xs text-text/55">Suggestions only — nothing here has been done automatically.</p>
        <ul className="mt-2 space-y-3">
          {brief.recommendedActions.map((action) => (
            <li key={action.id} className="text-sm text-text">
              <p className="font-medium">{action.label}</p>
              <p className="text-text-muted">{action.reason}</p>
              {action.actionTarget ? (
                <Link href={action.actionTarget.href} className="text-xs font-medium text-accent hover:underline">
                  {action.actionTarget.label}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {brief.preparationNotes ? (
        <section aria-labelledby="ai-brief-preparation-heading">
          <h4 id="ai-brief-preparation-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Preparation Notes
          </h4>
          <p className="mt-1 text-sm text-text">{brief.preparationNotes}</p>
        </section>
      ) : null}

      {brief.internalNotes ? (
        <section aria-labelledby="ai-brief-notes-heading">
          <h4 id="ai-brief-notes-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Internal notes
          </h4>
          <p className="mt-1 text-sm text-text">{brief.internalNotes}</p>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}
