"use server";

import { isAIConfigured } from "@/core/ai/registry";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief";
import { registerProposalSkill } from "@/modules/ai/proposal/registerProposalSkill";
import { registerEventOperationsBriefSkill } from "@/modules/ai/registerEventOperationsBriefSkill";
import { registerDailyOperationsBriefSkill } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefSkill";
import { registerBrowseAIMemorySkill } from "@/modules/ai/memory/registerBrowseAIMemorySkill";
import { registerCRMAssistantSkill } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";
import { registerFinanceAssistantSkill } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import { registerUpcomingSkills } from "@/modules/ai/registerUpcomingSkills";
import { listSkills } from "@/core/ai/skills/registry";
import { listSkillsForWorkspace, getSkillMetadata } from "@/core/ai/skills/discovery";
import { getMemoryManager } from "@/core/ai/memory";
import type { SkillMetadata } from "@/core/ai/skills/types";
import type { ProposalDraft } from "@/types/proposal";
import type { DailyBriefExecution } from "@/types/dailyBriefExecution";
import type { AIMemoryEntry, AIMemorySummary } from "@/types/aiMemory";

const GENERIC_ACCESS_ERROR = "The Bloom AI overview isn't available right now.";
const RECENT_PROPOSALS_LIMIT = 50;
const RECENT_DAILY_BRIEF_EXECUTIONS_LIMIT = 5;
const RECENT_MEMORIES_LIMIT = 5;

// Registered once per process — idempotent, mirrors every other AI entry point's own call-on-load.
registerProposalSkill();
registerEventOperationsBriefSkill();
registerDailyOperationsBriefSkill();
registerBrowseAIMemorySkill();
registerCRMAssistantSkill();
registerFinanceAssistantSkill();
registerUpcomingSkills();

export interface BloomAIUsageStats {
  totalGenerated: number;
  accepted: number;
  rejected: number;
  awaitingReview: number;
}

export interface BloomAIOverviewData {
  providerConfigured: boolean;
  /** Every Skill this member may be offered — Installed/Active/Coming-Soon cards and Prompt Versions all derive from this one list, never a hardcoded UI array. */
  skills: SkillMetadata[];
  /** Every Skill registered on the platform, regardless of this member's own visibility — the Dashboard's own "what does BloomOS have" count. */
  installedSkillsCount: number;
  activeSkillsCount: number;
  comingSoonSkillsCount: number;
  recentProposals: ProposalDraft[];
  /** The Daily Operations Brief's own execution history (Checkpoint 5) — metadata only, never the brief's own content (see `types/dailyBriefExecution.ts`). */
  recentDailyBriefExecutions: DailyBriefExecution[];
  stats: BloomAIUsageStats;
  /** Checkpoint 6, Step 9 — "Knowledge Statistics"/"Memory Health", computed fresh by the Memory Manager's own `summarizeMemories`, never persisted separately. */
  memorySummary: AIMemorySummary;
  /** The five most recent memories across every category this member may see (workspace-visible plus their own user-visible ones) — same visibility rule `registerBrowseAIMemorySkill.ts`'s `execute` applies. */
  recentMemories: AIMemoryEntry[];
}

export type GetBloomAIOverviewResult = { success: true; data: BloomAIOverviewData } | { success: false; error: string };

function computeStats(proposals: ProposalDraft[]): BloomAIUsageStats {
  return {
    totalGenerated: proposals.length,
    accepted: proposals.filter((proposal) => proposal.status === "accepted").length,
    rejected: proposals.filter((proposal) => proposal.status === "rejected").length,
    awaitingReview: proposals.filter((proposal) => proposal.status === "draft").length,
  };
}

/**
 * Read-only aggregate for the Bloom AI landing page — Checkpoint 4 upgrade:
 * every Skill card, Prompt Version, and count on the Dashboard comes from
 * the Skill Registry (`listSkillsForWorkspace`/`getSkillMetadata`) rather
 * than a hand-maintained list of features, so a newly registered Skill
 * (real or "Coming Soon") appears here automatically. Usage Statistics
 * still reflect only the Proposal Generator's persisted history
 * (`ProposalDraft`), since the Event Operations Brief is deliberately never
 * persisted (see `docs/ai.md`'s "Versioning metadata, not persistence").
 * Execution History (Checkpoint 5) additionally surfaces the Daily
 * Operations Brief's own append-only history (`recentDailyBriefExecutions`)
 * — metadata only (timestamp/provider/latency/status), never the brief's
 * own content, alongside the Proposal list, each Skill's own history
 * appearing "automatically" once it persists one, per the Checkpoint 5
 * spec's own Step 7. No new permission was introduced: any active
 * Workspace member may view this page, matching `/services`'s own
 * unmapped-route precedent in `routeAccess.ts`. Checkpoint 6, Step 9 adds
 * `memorySummary`/`recentMemories` from the Memory Manager, the same
 * "workspace-visible plus this member's own user-visible" rule
 * `registerBrowseAIMemorySkill.ts`'s `execute` applies — a passive read for
 * the Dashboard's own cards, never itself an `executeSkill()` call (Step
 * 10's Skill is the interactive counterpart to this same data). Checkpoint
 * 7's CRM Assistant needs no dashboard-specific field here at all — Step
 * 8's "Statistics should update automatically" is satisfied purely by
 * `registerCRMAssistantSkill()` existing above, the same zero-extra-work
 * guarantee every Skill registration already gets from this function's own
 * registry-driven design.
 */
export async function getBloomAIOverview(): Promise<GetBloomAIOverviewResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const recentProposals = await getProposalsRepository().getRecentProposals(session.workspace.id, RECENT_PROPOSALS_LIMIT);
  const recentDailyBriefExecutions = await getDailyBriefExecutionsRepository().getRecentExecutions(session.workspace.id, RECENT_DAILY_BRIEF_EXECUTIONS_LIMIT);

  const memoryManager = getMemoryManager();
  const memorySummary = await memoryManager.summarizeMemories(session.workspace.id);
  // `approvalStatus: "approved"` — "Recent Memories" is a passive display of
  // what this Workspace has actually vetted, never a still-proposed
  // suggestion awaiting review (that's what `memorySummary.pendingCount` and
  // the "Memory Health" card are for). Same rule `registerBrowseAIMemorySkill.ts`'s
  // `execute` applies for the interactive Skill.
  const [recentWorkspaceMemories, recentUserMemories] = await Promise.all([
    memoryManager.filterMemories(session.workspace.id, { visibility: "workspace", approvalStatus: "approved" }),
    memoryManager.filterMemories(session.workspace.id, { visibility: "user", userId: session.user.id, approvalStatus: "approved" }),
  ]);
  const recentMemories = [...recentWorkspaceMemories, ...recentUserMemories]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_MEMORIES_LIMIT);

  const visible = await listSkillsForWorkspace({
    workspaceId: session.workspace.id,
    permissions: session.permissions,
    role: session.membership.role,
  });
  const skills = visible.map((skill) => getSkillMetadata(skill.id)).filter((metadata): metadata is SkillMetadata => metadata !== null);

  return {
    success: true,
    data: {
      providerConfigured: isAIConfigured(),
      skills,
      installedSkillsCount: listSkills().length,
      activeSkillsCount: skills.filter((skill) => skill.status === "active").length,
      comingSoonSkillsCount: skills.filter((skill) => skill.status === "coming_soon").length,
      recentProposals,
      recentDailyBriefExecutions,
      stats: computeStats(recentProposals),
      memorySummary,
      recentMemories,
    },
  };
}
