"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getBloomAIOverview, type BloomAIOverviewData } from "@/modules/ai/getBloomAIOverview";
import { BloomAISkillPicker } from "@/modules/ai/components/BloomAISkillPicker";
import { browseAIMemory } from "@/modules/ai/memory/browseAIMemory";
import { BROWSE_AI_MEMORY_SKILL_ID } from "@/modules/ai/memory/registerBrowseAIMemorySkill";
import { registerSkillRunner, unregisterSkillRunner } from "@/core/ai/skills/runnerRegistry";
import type { SkillMetadata } from "@/core/ai/skills/types";
import type { ProposalStatus } from "@/types/proposal";
import type { AIMemoryCategory, AIMemoryEntry } from "@/types/aiMemory";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: BloomAIOverviewData };

const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Awaiting review",
  accepted: "Accepted",
  rejected: "Rejected",
  superseded: "Superseded",
};
const PROPOSAL_STATUS_TONE: Record<ProposalStatus, "warning" | "success" | "danger" | "neutral"> = {
  draft: "warning",
  accepted: "success",
  rejected: "danger",
  superseded: "neutral",
};

const CATEGORY_LABEL: Record<SkillMetadata["category"], string> = {
  proposal: "Proposal",
  operations: "Operations",
  crm: "CRM",
  finance: "Finance",
  documents: "Documents",
  briefing: "Briefing",
};

const MEMORY_CATEGORY_LABEL: Record<AIMemoryCategory, string> = {
  workspace_knowledge: "Workspace Knowledge",
  operational_knowledge: "Operational Knowledge",
  ai_generated_knowledge: "AI Generated Knowledge",
  reference_knowledge: "Reference Knowledge",
  historical_knowledge: "Historical Knowledge",
};

async function loadOverview(): Promise<LoadState> {
  const result = await getBloomAIOverview();
  if (!result.success) return { status: "error", message: result.error };
  return { status: "ready", data: result.data };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SkillCard({ skill }: { skill: SkillMetadata }) {
  return (
    <div className="rounded-md border border-border/60 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text">{skill.name}</span>
        {skill.status === "active" ? (
          <Badge tone={skill.availability === "live" ? "accent" : "outline"}>{skill.availability === "live" ? "Live" : "Mock"}</Badge>
        ) : (
          <Badge tone="neutral">Coming Soon</Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-text-muted">{skill.description}</p>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-text-muted/80">
        {CATEGORY_LABEL[skill.category]}
        {skill.requiresReview ? " · Requires review" : ""}
      </p>
      {skill.status === "active" ? (
        <div className="mt-3">
          <Link href="/events">
            <Button variant="secondary">Open an Event</Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

type BrowsedMemoriesState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; memories: AIMemoryEntry[] };

function MemoryEntryRow({ memory }: { memory: AIMemoryEntry }) {
  return (
    <li className="py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-text">{memory.title}</span>
        <div className="flex items-center gap-1.5">
          <Badge tone="neutral">{MEMORY_CATEGORY_LABEL[memory.category]}</Badge>
          <Badge tone={memory.approval_status === "approved" ? "success" : memory.approval_status === "proposed" ? "warning" : "outline"}>
            {memory.approval_status}
          </Badge>
        </div>
      </div>
      <p className="mt-1 text-xs text-text-muted">{memory.summary}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-text-muted/80">
        {formatDateTime(memory.created_at)} · {memory.source} · {memory.importance} importance
      </p>
    </li>
  );
}

export function BloomAIOverviewView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [browsedMemories, setBrowsedMemories] = useState<BrowsedMemoriesState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadOverview().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Checkpoint 6, Step 10 — "Browse AI Memory, through executeSkill()": the
  // Ask Bloom picker (`BloomAISkillPicker.tsx`) invokes whatever runner is
  // registered for a Skill's own id on the current page, falling back to
  // navigating here when none is. This page IS that Skill's natural home,
  // so it registers the real thing — running the Skill live and rendering
  // its result inline, the same pattern `ProposalGeneratorPanel`/
  // `EventOperationsBriefSection` already established for their own Skills.
  useEffect(() => {
    registerSkillRunner(BROWSE_AI_MEMORY_SKILL_ID, async () => {
      setBrowsedMemories({ status: "loading" });
      const result = await browseAIMemory();
      setBrowsedMemories(result.success ? { status: "ready", memories: result.data.memories } : { status: "error", message: result.error });
    });
    return () => unregisterSkillRunner(BROWSE_AI_MEMORY_SKILL_ID);
  }, []);

  return (
    <div>
      <PageHeader
        title="Bloom AI"
        subtitle="The central entry point for every AI capability inside BloomOS — grounded in the business's own data, never speculative, and never authoritative until a human explicitly reviews and approves it."
        actions={
          <>
            <BloomAISkillPicker />
            <Badge tone="accent">Live</Badge>
          </>
        }
      />

      {state.status === "loading" ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-6">
          <ErrorState message={state.message} onRetry={() => { setState({ status: "loading" }); loadOverview().then(setState); }} />
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="mt-6 space-y-6">
          {/* Skill Statistics */}
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Skill Statistics</h3>
            <p className="mt-1 text-sm text-text-muted">Every AI capability registered on the Bloom AI platform, discovered live from the Skill Registry.</p>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-semibold tabular-nums text-text">{state.data.installedSkillsCount}</div>
                <div className="text-xs text-text-muted uppercase tracking-wide">Installed Skills</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums text-text">{state.data.activeSkillsCount}</div>
                <div className="text-xs text-text-muted uppercase tracking-wide">Active Skills</div>
              </div>
              <div>
                <div className="text-2xl font-semibold tabular-nums text-text">{state.data.comingSoonSkillsCount}</div>
                <div className="text-xs text-text-muted uppercase tracking-wide">Coming Soon Skills</div>
              </div>
            </div>
          </Card>

          {/* Active Skills */}
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Active Skills</h3>
            <p className="mt-1 text-sm text-text-muted">Ready to run right now, from any Event they apply to.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {state.data.skills
                .filter((skill) => skill.status === "active")
                .map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
            </div>
          </Card>

          {/* Execution History */}
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Execution History</h3>
            <p className="mt-1 text-sm text-text-muted">
              {state.data.stats.totalGenerated} generated · {state.data.stats.accepted} accepted · {state.data.stats.rejected} rejected ·{" "}
              {state.data.stats.awaitingReview} awaiting review
            </p>
            {state.data.recentProposals.length === 0 ? (
              <p className="mt-3 text-sm text-text/55">
                No AI activity yet — generate a Proposal draft from any Event to see it here.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {state.data.recentProposals.slice(0, 5).map((proposal) => (
                  <li key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <Link href={`/events/${proposal.event_id}`} className="font-medium text-accent hover:underline">
                        Proposal draft v{proposal.version}
                      </Link>
                      <p className="text-xs text-text-muted">{formatDateTime(proposal.generated_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {proposal.mock ? <Badge tone="outline">Mock</Badge> : null}
                      <Badge tone={PROPOSAL_STATUS_TONE[proposal.status]}>{PROPOSAL_STATUS_LABEL[proposal.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {state.data.recentDailyBriefExecutions.length > 0 ? (
              <div className="mt-4 border-t border-border pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Daily Operations Brief</h4>
                <ul className="mt-2 divide-y divide-border">
                  {state.data.recentDailyBriefExecutions.map((execution) => (
                    <li key={execution.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <span className="font-medium text-text">{formatDateTime(execution.generated_at)}</span>
                        <p className="text-xs text-text-muted">
                          {execution.provider} · {execution.latency_ms}ms
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {execution.mock ? <Badge tone="outline">Mock</Badge> : null}
                        <Badge tone={execution.status === "success" ? "success" : "danger"}>{execution.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          {/* Prompt Versions + Provider Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="font-serif text-[17px] font-semibold text-text">Prompt Versions</h3>
              <p className="mt-1 text-sm text-text-muted">Every Skill and the prompt version it&apos;s currently running.</p>
              <ul className="mt-3 space-y-2">
                {state.data.skills.map((skill) => (
                  <li key={skill.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-text">{skill.id}</span>
                    <Badge tone="neutral">{skill.promptVersion}</Badge>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="font-serif text-[17px] font-semibold text-text">Provider Status</h3>
              <p className="mt-1.5 text-sm text-text-muted">
                {state.data.providerConfigured
                  ? "A live AI provider is registered — generations call the real model."
                  : "No live AI provider is registered — every generation runs against a deterministic development mock, clearly labelled throughout the UI."}
              </p>
              <div className="mt-3">
                <Badge tone={state.data.providerConfigured ? "accent" : "outline"}>
                  {state.data.providerConfigured ? "Live provider connected" : "Development mock"}
                </Badge>
              </div>
            </Card>
          </div>

          {/* Checkpoint 6, Step 9 — Memory Usage, Knowledge Statistics, Memory Health */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <h3 className="font-serif text-[17px] font-semibold text-text">Memory Usage</h3>
              <p className="mt-1 text-sm text-text-muted">How much operational memory this Workspace has accumulated, by importance.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-text">{state.data.memorySummary.totalCount}</div>
                  <div className="text-xs text-text-muted uppercase tracking-wide">Total Memories</div>
                </div>
                <div className="space-y-1 text-xs text-text-muted">
                  <div className="flex justify-between gap-2">
                    <span>High importance</span>
                    <span className="tabular-nums text-text">{state.data.memorySummary.byImportance.high}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Medium importance</span>
                    <span className="tabular-nums text-text">{state.data.memorySummary.byImportance.medium}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Low importance</span>
                    <span className="tabular-nums text-text">{state.data.memorySummary.byImportance.low}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-serif text-[17px] font-semibold text-text">Knowledge Statistics</h3>
              <p className="mt-1 text-sm text-text-muted">Every memory belongs to exactly one Knowledge Store category.</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {Object.entries(state.data.memorySummary.byCategory).map(([category, count]) => (
                  <li key={category} className="flex items-center justify-between gap-2">
                    <span className="text-text-muted">{MEMORY_CATEGORY_LABEL[category as AIMemoryCategory]}</span>
                    <span className="tabular-nums text-text">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="font-serif text-[17px] font-semibold text-text">Memory Health</h3>
              <p className="mt-1 text-sm text-text-muted">
                {state.data.memorySummary.pendingCount === 0
                  ? "No proposed memories are awaiting review."
                  : `${state.data.memorySummary.pendingCount} memor${state.data.memorySummary.pendingCount === 1 ? "y is" : "ies are"} awaiting review.`}
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Approved</span>
                  <Badge tone="success">{state.data.memorySummary.approvedCount}</Badge>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Proposed</span>
                  <Badge tone="warning">{state.data.memorySummary.pendingCount}</Badge>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Rejected</span>
                  <Badge tone="danger">{state.data.memorySummary.rejectedCount}</Badge>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Archived</span>
                  <Badge tone="outline">{state.data.memorySummary.archivedCount}</Badge>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">Expired</span>
                  <Badge tone="outline">{state.data.memorySummary.expiredCount}</Badge>
                </li>
              </ul>
            </Card>
          </div>

          {/* Recent Memories */}
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Recent Memories</h3>
            <p className="mt-1 text-sm text-text-muted">
              This Workspace&apos;s own remembered operational history — never a raw prompt or provider response (see{" "}
              <span className="font-mono text-[11px]">docs/memory.md</span>).
            </p>
            {state.data.recentMemories.length === 0 ? (
              <p className="mt-3 text-sm text-text/55">No memory recorded yet — Bloom AI remembers as Skills run.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {state.data.recentMemories.map((memory) => (
                  <MemoryEntryRow key={memory.id} memory={memory} />
                ))}
              </ul>
            )}

            {browsedMemories ? (
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Full Memory Browser</h4>
                  <Button variant="secondary" onClick={() => setBrowsedMemories(null)}>
                    Close
                  </Button>
                </div>
                {browsedMemories.status === "loading" ? <Skeleton className="mt-3 h-16 w-full" /> : null}
                {browsedMemories.status === "error" ? <p className="mt-3 text-sm text-danger">{browsedMemories.message}</p> : null}
                {browsedMemories.status === "ready" ? (
                  browsedMemories.memories.length === 0 ? (
                    <p className="mt-3 text-sm text-text/55">No memory matches this Workspace yet.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-border">
                      {browsedMemories.memories.map((memory) => (
                        <MemoryEntryRow key={memory.id} memory={memory} />
                      ))}
                    </ul>
                  )
                ) : null}
              </div>
            ) : null}
          </Card>

          {/* Coming Soon Skills */}
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Coming Soon Skills</h3>
            <p className="mt-1 text-sm text-text-muted">Built on the same Bloom AI Skill platform, not yet available.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {state.data.skills
                .filter((skill) => skill.status === "coming_soon")
                .map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
