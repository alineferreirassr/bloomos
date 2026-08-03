import type { ContractBuilderState, ContractDocumentStatus, ContractPricingReference, ContractSnapshot, ContractVariable, ContractVersion, CreateContractVersionInput } from "@/types/contractPlatform";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 34 — Contract Builder (Step 3) + Versioning (Step 6).
 * Pure assembly: freezes a `ContractSnapshot` by value — never a live
 * reference to the Variable Engine's resolved values, the linked
 * Proposal's pricing, or the real `Contract`'s own attachments (Exhibits).
 * The module layer resolves all three (real I/O) and passes them in
 * already-computed; this file only assembles and versions.
 */

export interface AssembleContractSnapshotInput {
  createInput: CreateContractVersionInput;
  variables: ContractVariable[];
  pricingReference: ContractPricingReference | null;
  attachmentIds: string[];
}

export function assembleSnapshot(input: AssembleContractSnapshotInput): ContractSnapshot {
  const { createInput } = input;
  return {
    id: generateId("contract_snapshot"),
    captured_at: nowIso(),
    builderTemplateId: createInput.builderTemplateId,
    builderTemplateKey: createInput.builderTemplateKey,
    header: createInput.header,
    sections: createInput.sections,
    clauseIds: createInput.clauseIds,
    variables: input.variables,
    pricingReference: input.pricingReference,
    attachmentIds: input.attachmentIds,
    terms: createInput.terms,
    policies: createInput.policies,
    footer: createInput.footer,
  };
}

export function nextVersionNumber(existingVersions: ContractVersion[]): number {
  if (existingVersions.length === 0) return 1;
  return Math.max(...existingVersions.map((v) => v.version_number)) + 1;
}

export function buildContractVersion(contractId: string, workspaceId: string, existingVersions: ContractVersion[], input: AssembleContractSnapshotInput, actor: string): ContractVersion {
  return {
    id: generateId("contract_version"),
    contract_id: contractId,
    workspace_id: workspaceId,
    version_number: nextVersionNumber(existingVersions),
    snapshot: assembleSnapshot(input),
    notes: input.createInput.notes,
    reason: input.createInput.reason,
    created_by: actor,
    created_at: nowIso(),
  };
}

/**
 * A first version always leaves the document in `"draft"`; every later
 * version created while the document is already `"published"` moves it
 * to `"review"` (a real edit is happening on top of what may already be
 * under review/signature) rather than silently staying `"published"` —
 * the same "never silently overwrite what was already sent" precedent
 * `nextStatusAfterVersion` established for the Proposal Platform
 * (Checkpoint 33).
 */
export function nextStatusAfterVersion(currentStatus: ContractDocumentStatus, isFirstVersion: boolean): ContractDocumentStatus {
  if (isFirstVersion) return "draft";
  if (currentStatus === "published") return "review";
  return currentStatus;
}

export function currentVersionOf(state: ContractBuilderState): ContractVersion | null {
  if (!state.current_version_id) return null;
  return state.versions.find((v) => v.id === state.current_version_id) ?? null;
}
