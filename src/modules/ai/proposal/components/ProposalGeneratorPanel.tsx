"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { registerSkillRunner, unregisterSkillRunner } from "@/core/ai/skills/runnerRegistry";
import { generateProposalDraft } from "@/modules/ai/proposal/generateProposalDraft";
import { acceptProposalDraft } from "@/modules/ai/proposal/acceptProposalDraft";
import { rejectProposalDraft } from "@/modules/ai/proposal/rejectProposalDraft";
import { getLatestProposalForEvent } from "@/modules/ai/proposal/getLatestProposalForEvent";
import { PROPOSAL_SKILL_ID } from "@/modules/ai/proposal/registerProposalSkill";
import type { ProposalDraft } from "@/types/proposal";
import type { AIMemoryEntry } from "@/types/aiMemory";
import { WritingStudioModal } from "@/modules/ai/copilot/writing/WritingStudioModal";

type PanelStatus = "loading_initial" | "idle" | "generating" | "reviewing" | "error";

const STATUS_LABEL: Record<ProposalDraft["status"], string> = {
  draft: "Draft — awaiting review",
  accepted: "Accepted",
  rejected: "Rejected",
  superseded: "Superseded by a newer draft",
};
const STATUS_TONE: Record<ProposalDraft["status"], "warning" | "success" | "danger" | "neutral"> = {
  draft: "warning",
  accepted: "success",
  rejected: "danger",
  superseded: "neutral",
};

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100);
}

function toPlainText(proposal: ProposalDraft): string {
  const lines: string[] = [
    `PROPOSAL — v${proposal.version}`,
    "",
    "EXECUTIVE SUMMARY",
    proposal.executive_summary,
    "",
    "EVENT OVERVIEW",
    proposal.event_overview,
    "",
    "SERVICES INCLUDED",
    ...proposal.services_included.map((item) => `- ${item.label}: ${formatMoney(item.price_minor, item.currency)}${item.description ? ` (${item.description})` : ""}`),
    "",
    "TIMELINE SUMMARY",
    proposal.timeline_summary,
    "",
    "PRICING SUMMARY",
    `Subtotal: ${formatMoney(proposal.pricing_summary.subtotal_minor, proposal.pricing_summary.currency)}`,
  ];
  if (proposal.payment_terms.length > 0) {
    lines.push("", "PAYMENT TERMS", ...proposal.payment_terms.map((line) => `- ${line.label}: ${formatMoney(line.amount_minor, proposal.pricing_summary.currency)}${line.due_date ? ` (due ${line.due_date})` : ""}`));
  }
  if (proposal.recommendations.length > 0) {
    lines.push("", "RECOMMENDATIONS", ...proposal.recommendations.map((item) => `- ${item}`));
  }
  if (proposal.optional_add_ons.length > 0) {
    lines.push("", "OPTIONAL ADD-ONS", ...proposal.optional_add_ons.map((item) => `- ${item.label}: ${formatMoney(item.price_minor, item.currency)}`));
  }
  if (proposal.questions_for_client.length > 0) {
    lines.push("", "QUESTIONS FOR CLIENT", ...proposal.questions_for_client.map((item) => `- ${item}`));
  }
  return lines.join("\n");
}

/**
 * Embedded in Event Detail, matching the Event Operations Brief's own
 * precedent (`EventOperationsBriefSection`) — a Proposal is drafted for one
 * specific Event, not a standalone chat surface. Never imports a provider
 * or the Runtime directly; every action here calls a `"use server"` Server
 * Action, which is the only place a provider is ever invoked.
 */
export function ProposalGeneratorPanel({ eventId }: { eventId: string }) {
  const [status, setStatus] = useState<PanelStatus>("loading_initial");
  const [proposal, setProposal] = useState<ProposalDraft | null>(null);
  const [relevantMemories, setRelevantMemories] = useState<AIMemoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMissingInfo, setShowMissingInfo] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [writingStudioOpen, setWritingStudioOpen] = useState(false);
  const requestIdRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getLatestProposalForEvent(eventId);
      if (cancelled) return;
      if (result.success && result.data) {
        setProposal(result.data);
        setStatus("reviewing");
      } else {
        setStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleGenerate(parentProposalId: string | null) {
    if (status === "generating") return; // duplicate-submit prevention
    const requestId = ++requestIdRef.current;
    setStatus("generating");
    setErrorMessage(null);

    const outcome = await generateProposalDraft(eventId, parentProposalId);

    if (requestId !== requestIdRef.current) return; // a newer request already superseded this one

    if (!outcome.success) {
      setStatus("error");
      setErrorMessage(outcome.error);
      return;
    }
    setProposal(outcome.data);
    setRelevantMemories(outcome.relevantMemories);
    setStatus("reviewing");
  }

  async function handleAccept() {
    if (!proposal) return;
    const result = await acceptProposalDraft(proposal.id);
    if (result.success) setProposal(result.data);
  }

  async function handleReject() {
    if (!proposal) return;
    const result = await rejectProposalDraft(proposal.id);
    if (result.success) setProposal(result.data);
  }

  async function handleCopy() {
    if (!proposal) return;
    await navigator.clipboard.writeText(toPlainText(proposal));
    setCopyToast(true);
  }

  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  // Scoped to this Event Detail page's lifetime, same pattern as the Event
  // Operations Brief's own runner (`EventOperationsBriefSection`). Checkpoint
  // 4 collapses this panel's three separate Command Palette actions
  // ("Generate Proposal", "Open Proposal Draft", "Search Proposal") into one
  // Skill runner: scroll the panel into view, then generate (or regenerate,
  // if a draft already exists) — the single action the Bloom AI Skill
  // Picker's "Proposal Generator" card now triggers. Re-registered whenever
  // `proposal` changes (rather than read through a ref kept in sync by a
  // separate effect) so the closure always captures the current draft's id
  // directly, with no dependency on effect-ordering between two different
  // `useEffect` calls to stay race-free.
  useEffect(() => {
    registerSkillRunner(PROPOSAL_SKILL_ID, () => {
      panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      panelRef.current?.focus();
      return handleGenerateRef.current(proposal?.id ?? null);
    });
    return () => unregisterSkillRunner(PROPOSAL_SKILL_ID);
  }, [proposal]);

  return (
    <Card>
      <div ref={panelRef} tabIndex={-1}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-serif text-[17px] font-semibold text-text">AI Proposal Generator</h3>
            <p className="mt-1 max-w-prose text-sm text-text-muted">
              Bloom AI drafts a proposal from this Event&apos;s client profile, selected services, pricing, and consultation notes. It
              never sends anything or changes this Event — review and explicitly accept a draft before it goes anywhere.
            </p>
          </div>
          <div className="flex gap-2">
            {proposal && proposal.status === "draft" ? (
              <>
                <Button type="button" variant="ghost" onClick={handleCopy} aria-label="Copy proposal as text">
                  Copy
                </Button>
                <Button type="button" variant="secondary" onClick={() => handleGenerate(proposal.id)} disabled={status === "generating"}>
                  {status === "generating" ? "Regenerating…" : "Regenerate"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={() => handleGenerate(null)} disabled={status === "generating"}>
                {status === "generating" ? "Generating…" : "Generate draft"}
              </Button>
            )}
          </div>
        </div>

        <div aria-live="polite" className="mt-3">
          {status === "loading_initial" ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : null}

          {status === "generating" ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}

          {status === "error" && errorMessage ? (
            <div role="alert" className="rounded-md border border-danger/60 bg-danger/10 px-4 py-2 text-sm text-danger">
              {errorMessage}
              <Button type="button" variant="ghost" onClick={() => handleGenerate(proposal?.id ?? null)} className="ml-2">
                Try again
              </Button>
            </div>
          ) : null}

          {status === "idle" ? <p className="text-sm text-text/55">No proposal has been drafted yet for this Event.</p> : null}

          {status === "reviewing" && proposal ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <Badge tone={STATUS_TONE[proposal.status]}>{STATUS_LABEL[proposal.status]}</Badge>
                <Badge tone={proposal.mock ? "outline" : "accent"}>{proposal.mock ? "Development mock — not a real AI call" : "AI-generated"}</Badge>
                <span>Draft v{proposal.version}</span>
                <span>Provider: {proposal.provider}</span>
                <span>Latency: {proposal.generation_latency_ms}ms</span>
                <span>Prompt: {proposal.prompt_version}</span>
                <span title={`Confidence based on how complete this Event's information is`}>Confidence: {proposal.ai_confidence}%</span>
              </div>

              {relevantMemories.length > 0 ? (
                <section aria-labelledby="proposal-history-heading">
                  <h4 id="proposal-history-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Relevant History
                  </h4>
                  <p className="mt-1 text-xs text-text/55">
                    Approved memory from this Client or Event&apos;s own past — informational only, never used to change this draft automatically.
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {relevantMemories.map((memory) => (
                      <li key={memory.id} className="text-sm text-text">
                        <span className="font-medium">{memory.title}</span>
                        <p className="text-text-muted">{memory.summary}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="proposal-summary-heading">
                <div className="flex items-center justify-between gap-2">
                  <h4 id="proposal-summary-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Executive Summary
                  </h4>
                  {proposal.status === "draft" ? (
                    <button type="button" onClick={() => setWritingStudioOpen(true)} className="text-xs font-medium text-accent hover:underline">
                      Improve with Bloom AI
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-text">{proposal.executive_summary}</p>
              </section>

              {writingStudioOpen ? (
                <WritingStudioModal
                  open
                  onClose={() => setWritingStudioOpen(false)}
                  initialTaskType="proposal"
                  initialText={proposal.executive_summary}
                />
              ) : null}

              <section aria-labelledby="proposal-overview-heading">
                <h4 id="proposal-overview-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Event Overview
                </h4>
                <p className="mt-1 text-sm text-text">{proposal.event_overview}</p>
              </section>

              <section aria-labelledby="proposal-services-heading">
                <h4 id="proposal-services-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Services Included
                </h4>
                {proposal.services_included.length === 0 ? (
                  <p className="mt-1 text-sm text-text/55">No services are assigned to this Event yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {proposal.services_included.map((item) => (
                      <li key={item.event_service_id} className="flex justify-between text-sm text-text">
                        <span>
                          {item.label}
                          {item.description ? <span className="text-text-muted"> — {item.description}</span> : null}
                        </span>
                        <span className="font-medium tabular-nums">{formatMoney(item.price_minor, item.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="proposal-timeline-heading">
                <h4 id="proposal-timeline-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Timeline Summary
                </h4>
                <p className="mt-1 text-sm text-text">{proposal.timeline_summary}</p>
              </section>

              <section aria-labelledby="proposal-pricing-heading">
                <h4 id="proposal-pricing-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Pricing Summary
                </h4>
                <p className="mt-1 text-sm font-medium tabular-nums text-text">
                  {formatMoney(proposal.pricing_summary.subtotal_minor, proposal.pricing_summary.currency)}
                </p>
              </section>

              {proposal.payment_terms.length > 0 ? (
                <section aria-labelledby="proposal-payment-terms-heading">
                  <h4 id="proposal-payment-terms-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Payment Terms
                  </h4>
                  <ul className="mt-2 space-y-1">
                    {proposal.payment_terms.map((line, index) => (
                      <li key={`${line.label}-${index}`} className="flex justify-between text-sm text-text">
                        <span>
                          {line.label}
                          {line.due_date ? <span className="text-text-muted"> — due {line.due_date}</span> : null}
                        </span>
                        <span className="font-medium tabular-nums">{formatMoney(line.amount_minor, proposal.pricing_summary.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {proposal.recommendations.length > 0 ? (
                <section aria-labelledby="proposal-recommendations-heading">
                  <h4 id="proposal-recommendations-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Recommendations
                  </h4>
                  <ul className="mt-1 list-inside list-disc text-sm text-text">
                    {proposal.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {proposal.optional_add_ons.length > 0 ? (
                <section aria-labelledby="proposal-addons-heading">
                  <h4 id="proposal-addons-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Optional Add-ons
                  </h4>
                  <ul className="mt-2 space-y-1">
                    {proposal.optional_add_ons.map((item) => (
                      <li key={item.event_service_id} className="flex justify-between text-sm text-text">
                        <span>{item.label}</span>
                        <span className="font-medium tabular-nums">{formatMoney(item.price_minor, item.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {proposal.questions_for_client.length > 0 ? (
                <section aria-labelledby="proposal-questions-heading">
                  <h4 id="proposal-questions-heading" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Questions for Client
                  </h4>
                  <ul className="mt-1 list-inside list-disc text-sm text-text">
                    {proposal.questions_for_client.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {proposal.missing_information.length > 0 ? (
                <section aria-labelledby="proposal-missing-heading">
                  <button
                    type="button"
                    id="proposal-missing-heading"
                    onClick={() => setShowMissingInfo((value) => !value)}
                    aria-expanded={showMissingInfo}
                    aria-controls="proposal-missing-list"
                    className="text-xs font-semibold uppercase tracking-wide text-text-muted underline decoration-dotted"
                  >
                    {showMissingInfo ? "Hide" : "View"} Missing Information ({proposal.missing_information.length})
                  </button>
                  {showMissingInfo ? (
                    <ul id="proposal-missing-list" className="mt-2 list-inside list-disc text-sm text-text">
                      {proposal.missing_information.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {proposal.status === "draft" ? (
                <div className="flex gap-2 border-t border-border/60 pt-4">
                  <Button type="button" variant="primary" onClick={handleAccept}>
                    Accept Draft
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleReject}>
                    Reject Draft
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {copyToast ? <Toast tone="success" message="Proposal copied to clipboard." onDismiss={() => setCopyToast(false)} /> : null}
    </Card>
  );
}
