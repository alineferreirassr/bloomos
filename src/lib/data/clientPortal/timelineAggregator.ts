import { getProposalsRepository } from "@/lib/data/proposals";
import { getAutomationManager } from "@/core/automation/manager";
import type { ClientPortalContract, ClientPortalInvoiceWithPayments, ClientPortalDocument, ClientPortalEvent } from "@/types/clientPortal";
import type { ClientPortalTimelineEntry } from "@/types/clientPortalTimeline";

/**
 * Checkpoint 14, Step 6 — the one Timeline aggregation, shared by both the
 * mock and Supabase `ClientPortalRepository` implementations so the
 * business logic ("what counts as a Timeline entry, and how it's
 * described") is never duplicated between them. Each repository supplies
 * its own already-client-safe data (fetched via its own existing methods),
 * so this function never talks to a data store directly except for
 * Proposals and Automation history — both of which are *always* mock-only
 * regardless of `NEXT_PUBLIC_DATA_MODE` already (see `lib/data/proposals/index.ts`'s
 * own doc comment, and `core/workflow`/`core/automation`'s own established
 * precedent), so calling them here is safe in either repository.
 */
export interface TimelineAggregatorInput {
  workspaceId: string;
  events: ClientPortalEvent[];
  contracts: ClientPortalContract[];
  invoicesWithPayments: ClientPortalInvoiceWithPayments[];
  documents: ClientPortalDocument[];
}

export async function aggregateClientPortalTimeline(input: TimelineAggregatorInput): Promise<ClientPortalTimelineEntry[]> {
  const entries: ClientPortalTimelineEntry[] = [];
  const eventIds = new Set(input.events.map((event) => event.id));

  for (const contract of input.contracts) {
    entries.push({
      id: `contract-generated-${contract.id}`,
      kind: "contract_generated",
      title: "Contract generated",
      description: contract.title,
      occurred_at: contract.created_at,
      entity_id: contract.id,
    });
  }

  for (const invoice of input.invoicesWithPayments) {
    if (invoice.sent_at || invoice.issue_date) {
      entries.push({
        id: `invoice-issued-${invoice.id}`,
        kind: "invoice_issued",
        title: "Invoice issued",
        description: `Invoice ${invoice.invoice_number}`,
        occurred_at: invoice.sent_at ?? invoice.issue_date ?? invoice.created_at,
        entity_id: invoice.id,
      });
    }
    for (const payment of invoice.payments) {
      if (payment.received_at) {
        entries.push({
          id: `payment-received-${payment.id}`,
          kind: "payment_received",
          title: "Payment received",
          description: `Invoice ${invoice.invoice_number}`,
          occurred_at: payment.received_at,
          entity_id: payment.id,
        });
      }
    }
  }

  for (const document of input.documents) {
    if (document.status !== "draft") {
      entries.push({
        id: `document-published-${document.id}`,
        kind: "document_published",
        title: "Document published",
        description: document.title,
        occurred_at: document.uploaded_at ?? document.created_at,
        entity_id: document.id,
      });
    }
  }

  // Proposals — always mock-backed regardless of data mode (see this file's own doc comment); one lookup per Event, matching `getProposalsByEvent`'s own only query shape.
  const proposalsRepository = getProposalsRepository();
  for (const event of input.events) {
    const proposals = await proposalsRepository.getProposalsByEvent(event.id);
    for (const proposal of proposals) {
      if (proposal.status === "accepted") {
        entries.push({
          id: `proposal-accepted-${proposal.id}`,
          kind: "proposal_accepted",
          title: "Proposal accepted",
          description: event.title,
          occurred_at: proposal.updated_at,
          entity_id: proposal.id,
        });
      }
    }
  }

  // Workflow milestones — a safe, generic summary of what an Automation *did*, never its own name, Trigger, Conditions, or the Workflow that produced it (Step 12's own "must never access... Automation, Workflow Builder" boundary, even though the *effect* is fair to show).
  const executions = await getAutomationManager().getRecentExecutions(input.workspaceId, 200);
  for (const execution of executions) {
    const factEventId = typeof execution.triggerFacts.eventId === "string" ? execution.triggerFacts.eventId : null;
    if (!factEventId || !eventIds.has(factEventId)) continue;
    if (execution.status !== "success" && execution.status !== "partial_failure") continue;
    const safeSummary = execution.actionResults
      .filter((result) => result.status === "success")
      .map((result) => result.message)
      .join(" ");
    if (!safeSummary) continue;
    entries.push({
      id: `workflow-milestone-${execution.id}`,
      kind: "workflow_milestone",
      title: "Workflow update",
      description: safeSummary,
      occurred_at: execution.startedAt,
      entity_id: null,
    });
  }

  return entries.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
