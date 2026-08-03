# Timeline Center

`ClientPortalTimelineView.tsx`, at `/client-access/timeline`. The read-only, aggregated Event Timeline itself (`getClientPortalTimeline`, Checkpoint 14) is unchanged — proposal-accepted, contract-generated, invoice-issued, payment-received, document-published, and workflow-milestone entries, never a new source of truth.

## Step 8's own addition: filtering, entirely client-side

Search, category (kind) toggle chips, and a From/To date range all filter the same already-fetched `entries` array in the browser — no second, filtered server round-trip. The full history for one client is small enough that this trades nothing meaningful for simplicity. `ALL_KINDS` (derived from `KIND_LABEL`'s own keys) drives both the filter chip row and the badge tone map, so a future timeline entry kind only needs one new map entry to appear correctly in both places.

## Never surfaces an Automation's own name

`workflow_milestone` entries render only the generic label "Workflow Update" (`KIND_LABEL.workflow_milestone`) — never the underlying Automation's own name or configuration, the same boundary `client-portal.md`'s own "What the Portal can never touch" section draws for Automation/Workflow internals.

## Named entry kinds

| Kind | Label | Tone |
|---|---|---|
| `proposal_accepted` | Proposal Accepted | accent |
| `contract_generated` | Contract Generated | neutral |
| `invoice_issued` | Invoice Issued | warning |
| `payment_received` | Payment Received | success |
| `workflow_milestone` | Workflow Update | outline |
| `document_published` | Document Published | neutral |
