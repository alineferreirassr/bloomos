import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getProposalsRepository } from "@/lib/data/proposals";
import { formatMoney } from "@/lib/money";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"proposal"` Merge Field domain (v2 Checkpoint 44) — a single
 * Proposal's own figures, resolved from `context.proposalId`. Distinct
 * from `"crm"`'s own `client_proposal_history` (a list across every
 * proposal for an Event) — this domain is for a document about *one*
 * specific proposal (a "Proposal Sent" email, a Proposal cover letter).
 */
export const proposalMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "proposal_status", label: "Proposal Status", description: "The linked Proposal's own status.", domain: "proposal", valueType: "string", required: false },
  { key: "proposal_total", label: "Proposal Total", description: "The linked Proposal's own subtotal, formatted as currency.", domain: "proposal", valueType: "currency", required: false },
  { key: "proposal_version", label: "Proposal Version", description: "The linked Proposal's own version number.", domain: "proposal", valueType: "number", required: false },
];

export function registerProposalMergeFields(): void {
  for (const definition of proposalMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("proposal_status", async (context) => {
    if (!context.proposalId) return null;
    const proposal = await getProposalsRepository().getProposalById(context.proposalId);
    return proposal?.status ?? null;
  });

  registerMergeResolver("proposal_total", async (context) => {
    if (!context.proposalId) return null;
    const proposal = await getProposalsRepository().getProposalById(context.proposalId);
    return proposal ? formatMoney(proposal.pricing_summary.subtotal_minor, proposal.pricing_summary.currency) : null;
  });

  registerMergeResolver("proposal_version", async (context) => {
    if (!context.proposalId) return null;
    const proposal = await getProposalsRepository().getProposalById(context.proposalId);
    return proposal?.version ?? null;
  });
}
