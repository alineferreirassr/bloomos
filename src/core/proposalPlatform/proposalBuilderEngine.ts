import type { CreateProposalVersionInput, ProposalBuilderState, ProposalDocumentStatus, ProposalSnapshot, ProposalVersion } from "@/types/proposalPlatform";
import { computeProposalPricing } from "@/core/proposalPlatform/pricingEngine";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 33 — Proposal Builder (Step 3) + Versioning (Step 8).
 * Pure assembly: freezes a `ProposalSnapshot` by value (including a
 * freshly-computed `ProposalPricing`, never a stale copy) and wraps it in
 * the next append-only `ProposalVersion` — the exact `ExecutionSnapshot`/
 * `ExecutionVersion` pattern (Checkpoint 27.3). The mock store
 * (`proposalBuilderStore.ts`) calls this to build the record it then
 * appends; this file never touches storage itself.
 */

export function assembleSnapshot(input: CreateProposalVersionInput): ProposalSnapshot {
  return {
    id: generateId("proposal_snapshot"),
    captured_at: nowIso(),
    template_id: input.templateId,
    templateKey: input.templateKey,
    header: input.header,
    hero: input.hero,
    sections: input.sections,
    packageIds: input.packageIds,
    addonIds: input.addonIds,
    variables: input.variables,
    pricing: computeProposalPricing(input.pricingInput),
    terms: input.terms,
    policies: input.policies,
    footer: input.footer,
  };
}

export function nextVersionNumber(existingVersions: ProposalVersion[]): number {
  if (existingVersions.length === 0) return 1;
  return Math.max(...existingVersions.map((v) => v.version_number)) + 1;
}

export function buildProposalVersion(proposalId: string, workspaceId: string, existingVersions: ProposalVersion[], input: CreateProposalVersionInput, actor: string): ProposalVersion {
  return {
    id: generateId("proposal_version"),
    proposal_id: proposalId,
    workspace_id: workspaceId,
    version_number: nextVersionNumber(existingVersions),
    snapshot: assembleSnapshot(input),
    notes: input.notes,
    reason: input.reason,
    created_by: actor,
    created_at: nowIso(),
  };
}

/**
 * A first version always leaves the document in `"draft"`; every later
 * version created while the document is already `"published"` moves it to
 * `"revision"` (a real edit is happening on top of what the client may
 * already have seen) rather than silently staying `"published"` — the
 * next explicit Publish action is what re-promotes it, mirroring "never
 * silently overwrite what was already sent."
 */
export function nextStatusAfterVersion(currentStatus: ProposalDocumentStatus, isFirstVersion: boolean): ProposalDocumentStatus {
  if (isFirstVersion) return "draft";
  if (currentStatus === "published") return "revision";
  return currentStatus;
}

export function currentVersionOf(state: ProposalBuilderState): ProposalVersion | null {
  if (!state.current_version_id) return null;
  return state.versions.find((v) => v.id === state.current_version_id) ?? null;
}
