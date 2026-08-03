/**
 * Checkpoint 14, Step 6 — the client-facing Event Timeline. Aggregates
 * real events from real modules (Proposals, Contracts, Invoices, Payments,
 * Documents, and the Automation Engine's own execution history) into one
 * sorted, read-only feed — never a new source of truth, never a duplicate
 * of any of those modules' own records. `workflow_milestone` entries are
 * deliberately generic: they summarize what an `AutomationExecution`
 * *did* (via its own safe `resultRef`/summary), never the Workflow graph
 * or Automation Definition that produced it — Step 12's own "must never
 * access... Automation, Workflow Builder" applies here too, even though
 * the *effect* of an Automation is fair to show.
 */
export const CLIENT_PORTAL_TIMELINE_ENTRY_KINDS = [
  "proposal_accepted",
  "contract_generated",
  "invoice_issued",
  "payment_received",
  "workflow_milestone",
  "document_published",
] as const;
export type ClientPortalTimelineEntryKind = (typeof CLIENT_PORTAL_TIMELINE_ENTRY_KINDS)[number];

export interface ClientPortalTimelineEntry {
  id: string;
  kind: ClientPortalTimelineEntryKind;
  title: string;
  description: string | null;
  occurred_at: string;
  /** A client-safe reference back to the entity this entry describes (e.g. an Invoice's own id) — never dereferenced by the Timeline UI itself beyond an optional link. */
  entity_id: string | null;
}
