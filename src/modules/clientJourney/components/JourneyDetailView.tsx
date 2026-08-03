"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluateClientJourneyAction, transitionClientJourneyAction, assignJourneyOwnerAction, listInformationRequestsAction, createInformationRequestAction } from "@/modules/clientJourney/clientJourneyActions";
import type { ClientJourney, JourneyOwnerRole, ClientInformationRequest } from "@/types/clientJourney";
import { JOURNEY_OWNER_ROLES, JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CrmIcon } from "@/components/ui/icons";
import { CommentsPanel } from "@/modules/communication/comments/components/CommentsPanel";

/**
 * v2.0 Checkpoint 32, Step 18 — Journey Detail. One Lead's or Client's
 * full journey record. Every figure comes straight from
 * `evaluateClientJourneyAction` — nothing here recalculates anything.
 * Cancel/Reopen are the only wired mutations (Journey Transitions are
 * this checkpoint's own writable domain, validated by the Transition
 * Engine before being recorded); every other Next Best Action links out
 * to the real source module rather than performing the action itself.
 */

const SEVERITY_TONE: Record<string, BadgeTone> = { critical: "danger", high: "warning", medium: "accent", low: "neutral", informational: "outline" };
const STATUS_TONE: Record<ClientJourney["status"], BadgeTone> = { active: "success", at_risk: "warning", blocked: "danger", completed: "accent", lost: "neutral", cancelled: "neutral" };

export function JourneyDetailView({ subjectType, subjectId }: { subjectType: "lead" | "client"; subjectId: string }) {
  const [journey, setJourney] = useState<ClientJourney | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<ClientInformationRequest[]>([]);
  const [acting, setActing] = useState(false);

  async function load() {
    const result = await evaluateClientJourneyAction(subjectType, subjectId);
    if (result.success) {
      setJourney(result.data);
      setError(null);
      if (subjectType === "client") {
        const reqResult = await listInformationRequestsAction(subjectId);
        if (reqResult.success) setRequests(reqResult.data);
      }
    } else {
      setError(result.error);
    }
  }

  useEffect(() => {
    let cancelled = false;
    evaluateClientJourneyAction(subjectType, subjectId).then(async (result) => {
      if (cancelled) return;
      if (result.success) {
        setJourney(result.data);
        if (subjectType === "client") {
          const reqResult = await listInformationRequestsAction(subjectId);
          if (!cancelled && reqResult.success) setRequests(reqResult.data);
        }
      } else {
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [subjectType, subjectId]);

  async function handleCancel() {
    if (!journey) return;
    setActing(true);
    await transitionClientJourneyAction(subjectType, subjectId, "cancel", "cancelled", "Cancelled from the Journey Detail page.");
    await load();
    setActing(false);
  }

  async function handleReopen() {
    if (!journey) return;
    setActing(true);
    await transitionClientJourneyAction(subjectType, subjectId, "reopen", "planning", "Reopened from the Journey Detail page.");
    await load();
    setActing(false);
  }

  async function handleAssignOwner(role: JourneyOwnerRole, memberId: string) {
    if (!memberId) return;
    setActing(true);
    await assignJourneyOwnerAction(subjectType, subjectId, role, memberId);
    await load();
    setActing(false);
  }

  if (error) return <EmptyState title="This journey isn't available" description={error} icon={CrmIcon} />;
  if (!journey) return <p className="text-sm text-text-muted">Loading journey…</p>;

  const isTerminal = journey.currentStage === "closed" || journey.currentStage === "lost" || journey.currentStage === "cancelled";
  const subjectHref = subjectType === "lead" ? `/leads/${subjectId}` : `/clients/${subjectId}`;

  return (
    <div>
      <PageHeader
        title={journey.displayName}
        subtitle={`${subjectType === "lead" ? "Lead" : "Client"} journey — currently at '${JOURNEY_STAGE_DEFAULT_LABELS[journey.currentStage]}'`}
        icon={CrmIcon}
        breadcrumb={[{ label: "Client Journeys", href: "/client-journeys" }, { label: journey.displayName }]}
        actions={
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[journey.status]}>{journey.status.replace("_", " ")}</Badge>
            <Link href={subjectHref} className="text-sm underline">
              View {subjectType === "lead" ? "Lead" : "Client"} record
            </Link>
            {journey.currentStage === "lost" || journey.currentStage === "cancelled" ? (
              <Button variant="secondary" onClick={handleReopen} disabled={acting}>
                Restore
              </Button>
            ) : !isTerminal ? (
              <Button
                variant="secondary"
                onClick={() => {
                  if (window.confirm("Cancel this journey? This can be restored later.")) handleCancel();
                }}
                disabled={acting}
              >
                Cancel Journey
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Progress</h2>
          <p className="text-2xl font-semibold">{journey.progress.overallPercentage}%</p>
          <p className="text-xs text-text-muted">{journey.progress.completedStages.length} of {journey.progress.completedStages.length + journey.progress.remainingRequiredStages.length} required stages complete</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Journey Health</h2>
          <p className="text-2xl font-semibold">{journey.health.overallJourneyHealth}</p>
          <p className="text-xs text-text-muted">Composed from Lead/Proposal/Contract/Invoice/Payment/Communication/Portal/Planning health</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Blockers</h2>
          <p className="text-2xl font-semibold">{journey.blockers.length}</p>
          <p className="text-xs text-text-muted">{journey.blockers.filter((b) => b.severity === "critical").length} critical</p>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Next Best Actions</h2>
        {journey.nextBestActions.length === 0 ? (
          <p className="text-sm text-success">Nothing outstanding right now.</p>
        ) : (
          <ul role="list">
            {journey.nextBestActions.map((a) => (
              <li key={a.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-text-muted">{a.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={SEVERITY_TONE[a.priority]}>{a.priority}</Badge>
                  {a.deepLink && (
                    <Link href={a.deepLink} className="text-xs underline">
                      Open
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Blockers <span className="font-normal text-text-muted">({journey.blockers.length})</span>
        </h2>
        {journey.blockers.length === 0 ? (
          <p className="text-sm text-success">No blockers detected.</p>
        ) : (
          <ul role="list">
            {journey.blockers.map((b) => (
              <li key={b.id} role="listitem" className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{b.description}</p>
                  <p className="text-xs text-text-muted">{b.suggestedNextAction}</p>
                </div>
                <Badge tone={SEVERITY_TONE[b.severity]}>{b.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Risks <span className="font-normal text-text-muted">({journey.risks.length})</span>
        </h2>
        {journey.risks.length === 0 ? (
          <p className="text-sm text-success">No risks detected.</p>
        ) : (
          <ul role="list">
            {journey.risks.map((r) => (
              <li key={r.id} role="listitem" className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <p className="text-sm">{r.description}</p>
                <Badge tone={SEVERITY_TONE[r.severity]}>{r.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Milestones</h2>
        <ul role="list" className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {journey.milestones.map((m) => (
            <li key={m.stage} role="listitem" className="flex items-center gap-2 text-sm">
              <span aria-hidden="true">{m.completed ? "✓" : "○"}</span>
              <span className={m.completed ? "" : "text-text-muted"}>{m.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Ownership</h2>
        <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {JOURNEY_OWNER_ROLES.map((role) => {
            const assignment = journey.owners.find((o) => o.role === role);
            return (
              <li key={role} role="listitem" className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2">
                <span className="text-sm capitalize">{role.replace("_", " ")}</span>
                <input
                  type="text"
                  placeholder="Member ID"
                  defaultValue={assignment?.memberId ?? ""}
                  className="w-32 rounded-md border border-border bg-surface px-2 py-1 text-xs"
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== assignment?.memberId) handleAssignOwner(role, e.target.value);
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      {subjectType === "client" && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold">
            Information Requests <span className="font-normal text-text-muted">({requests.length})</span>
          </h2>
          {requests.length === 0 ? (
            <p className="text-sm text-text-muted">No information requests yet.</p>
          ) : (
            <ul role="list">
              {requests.map((r) => (
                <li key={r.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-text-muted">{r.description}</p>
                  </div>
                  <Badge tone={r.status === "pending" ? "warning" : r.status === "overdue" ? "danger" : r.status === "fulfilled" ? "success" : "neutral"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            className="mt-3"
            onClick={async () => {
              const title = window.prompt("Information request title:");
              if (!title) return;
              await createInformationRequestAction({ clientId: subjectId, title, description: "" });
              await load();
            }}
          >
            New Information Request
          </Button>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Internal Notes &amp; Comments</h2>
        <CommentsPanel ownerType={subjectType} ownerId={subjectId} />
      </Card>
    </div>
  );
}
