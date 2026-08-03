"use server";

import { getCurrentClientAccountContext, getContract, getContractExhibitsByContractId } from "@/lib/data";
import { getCoreContractBuilderService, getCoreContractClausesService } from "@/core/contractPlatform";
import { currentVersionOf } from "@/core/contractPlatform/contractBuilderEngine";
import { substituteVariables } from "@/core/contractPlatform/variableEngine";
import { compareContractVersions } from "@/core/contractPlatform/contractComparisonEngine";
import { getCoreCommentsService } from "@/core/comments";
import type { ContractComparisonResult, ContractDocumentStatus, ContractFooterContent, ContractHeaderContent } from "@/types/contractPlatform";
import { type DataResult, ok, fail } from "@/lib/data/result";

/**
 * v2.0 Checkpoint 34, Step 12 — Client Contract Experience. The same
 * two-session-mechanism split `getClientPortalProposal.ts` (Checkpoint 33)
 * established: resolves a `ClientAccount` via `getCurrentClientAccountContext()`,
 * never the team-member session gate `contractPlatformActions.ts` uses.
 *
 * No signing here — this is a read-only view of the prepared document
 * (sections, resolved clauses, terms, policies, version history,
 * attachments), exactly this checkpoint's own scope. The real Contract's
 * own send/view/sign flow (`sendContract`/`markViewed`/`markSigned` in
 * `modules/contracts/`) is untouched and stays the only path that changes
 * `signature_status`.
 *
 * A document is only visible to the client once its own document status
 * reaches `"published"` — the same "never show a client a work-in-progress"
 * rule `getClientPortalProposalAction`'s `sent_at !== null` gate enforces,
 * adapted to this checkpoint's own document-status vocabulary since there is
 * no separate "sent" concept for the Document layer.
 *
 * Checkpoint 36, Step 4 — `requestClientPortalContractReviewAction` adds
 * the Contract Center's own "Review Requests" surface, composing the
 * existing Comments Platform rather than inventing a parallel request
 * system (see its own doc comment below).
 */

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. Please sign in again.";
const NOT_FOUND_ERROR = "This contract document could not be found.";

type Result<T> = { success: true; data: T } | { success: false; error: string };

interface ClientPortalContractBlockView {
  type: string;
  heading: string | null;
  text: string | null;
}

interface ClientPortalContractSectionView {
  key: string;
  title: string;
  blocks: ClientPortalContractBlockView[];
}

interface ClientPortalContractClauseView {
  key: string;
  name: string;
  bodyText: string;
}

interface ClientPortalContractExhibitView {
  id: string;
  title: string;
  description: string | null;
}

export interface ClientPortalContractDocumentSummary {
  contractId: string;
  title: string;
  documentStatus: ContractDocumentStatus;
  header: ContractHeaderContent;
  sections: ClientPortalContractSectionView[];
  clauses: ClientPortalContractClauseView[];
  terms: string;
  policies: string;
  footer: ContractFooterContent;
  currentVersionNumber: number;
  availableVersionNumbers: number[];
  exhibits: ClientPortalContractExhibitView[];
}

async function resolveOwnedPublishedContract(contractId: string) {
  const context = await getCurrentClientAccountContext();
  if (!context) return { context: null, contract: null, builderState: null } as const;

  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== context.account.workspace_id || contract.client_id !== context.account.client_id) {
    return { context, contract: null, builderState: null } as const;
  }

  const builderState = await getCoreContractBuilderService().getByContractId(contractId);
  if (!builderState || builderState.status !== "published") return { context, contract, builderState: null } as const;

  return { context, contract, builderState } as const;
}

export async function getClientPortalContractDocumentAction(contractId: string): Promise<Result<ClientPortalContractDocumentSummary>> {
  const { context, contract, builderState } = await resolveOwnedPublishedContract(contractId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!contract || !builderState) return { success: false, error: NOT_FOUND_ERROR };

  const version = currentVersionOf(builderState);
  if (!version) return { success: false, error: NOT_FOUND_ERROR };

  const { snapshot } = version;
  const clauses = await getCoreContractClausesService().getClausesByIds(snapshot.clauseIds);

  return {
    success: true,
    data: {
      contractId,
      title: snapshot.header.title || contract.title,
      documentStatus: builderState.status,
      header: snapshot.header,
      sections: snapshot.sections.map((section) => ({
        key: section.key,
        title: section.title,
        blocks: section.blocks.map((block) => ({
          type: block.type,
          heading: block.heading ? substituteVariables(block.heading, snapshot.variables) : null,
          text: block.text ? substituteVariables(block.text, snapshot.variables) : null,
        })),
      })),
      clauses: clauses.map((clause) => ({ key: clause.key, name: clause.name, bodyText: substituteVariables(clause.bodyText, snapshot.variables) })),
      terms: substituteVariables(snapshot.terms, snapshot.variables),
      policies: substituteVariables(snapshot.policies, snapshot.variables),
      footer: snapshot.footer,
      currentVersionNumber: version.version_number,
      availableVersionNumbers: builderState.versions.map((v) => v.version_number),
      exhibits: (await getContractExhibitsByContractId(contractId).catch(() => [])).map((e) => ({ id: e.id, title: e.title, description: e.description })),
    },
  };
}

export async function compareClientPortalContractVersionsAction(contractId: string, versionANumber: number, versionBNumber: number): Promise<Result<ContractComparisonResult>> {
  const { context, builderState } = await resolveOwnedPublishedContract(contractId);
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!builderState) return { success: false, error: NOT_FOUND_ERROR };

  const versionA = builderState.versions.find((v) => v.version_number === versionANumber);
  const versionB = builderState.versions.find((v) => v.version_number === versionBNumber);
  if (!versionA || !versionB) return { success: false, error: "One or both versions could not be found." };

  return { success: true, data: compareContractVersions(versionA, versionB) };
}

/**
 * Checkpoint 36, Step 4 — the Contract Center's own "Review Requests"
 * surface. Composes the existing, generic Comments Platform
 * (Checkpoint 24) directly — no new storage, no second request-tracking
 * system. `ContractDetailView.tsx`'s own `CommentsPanel` (`ownerType:
 * "contract"`) already renders every comment on this exact contract, so a
 * client's review request appears to the team the moment it's posted,
 * through a surface staff already watches.
 */
export async function requestClientPortalContractReviewAction(contractId: string, note: string): Promise<DataResult<null>> {
  const trimmed = note.trim();
  if (trimmed.length === 0) return fail("Please fix the highlighted fields.", { note: "A note can't be empty" });

  const { context, contract } = await resolveOwnedPublishedContract(contractId);
  if (!context) return fail(GENERIC_ACCESS_ERROR);
  if (!contract) return fail(NOT_FOUND_ERROR);

  const result = await getCoreCommentsService().createComment(context.account.workspace_id, `${context.clientName} (Client)`, "contract", contractId, { body: `Review requested: ${trimmed}` });
  if (!result.success) return result;
  return ok(null);
}

export async function listClientPortalContractsAction(): Promise<Result<Array<{ contractId: string; title: string; documentStatus: ContractDocumentStatus; currentVersionNumber: number | null }>>> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const states = await getCoreContractBuilderService().listForWorkspace(context.account.workspace_id);
  const published = states.filter((s) => s.status === "published");

  const results = await Promise.all(
    published.map(async (state) => {
      const contract = await getContract(state.contract_id).catch(() => null);
      if (!contract || contract.client_id !== context.account.client_id) return null;
      const version = currentVersionOf(state);
      return {
        contractId: state.contract_id,
        title: version?.snapshot.header.title || contract.title,
        documentStatus: state.status,
        currentVersionNumber: version?.version_number ?? null,
      };
    }),
  );

  return { success: true, data: results.filter((r): r is NonNullable<typeof r> => r !== null) };
}
