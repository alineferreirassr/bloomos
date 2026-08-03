# Event Center

`ClientPortalEventDetailView.tsx`, at `/client-access/events/[id]`, reading `getClientPortalEventById()` (Checkpoint 14/19). The events *list* page pre-dates this checkpoint; the Event Center's own addition is the detail view's Preparation/Execution status framing and its Knowledge Graph connections panel.

## Preparation Status / Execution Status — derived, not stored

Both are computed entirely from the real, already-client-visible `event.status` (`core/enums/eventStatus.ts`'s own linear progression: draft → inquiry → … → confirmed → planning → ready → in_progress → completed, or cancelled/archived) via `derivePreparationExecution()`. No new field, no second status model a staff member would have to keep in sync.

## "How Everything Connects" — Knowledge Graph, read back

`getClientPortalKnowledgeSummaryAction(eventId)` (Step 14) reads the same Knowledge Graph relationships every internal platform already writes (`getCoreKnowledgeGraphService().createRelationship`, fired when a Proposal/Contract/Invoice is created) — never a second "how things connect" computation. `CLIENT_SAFE_NODE_TYPES` is a strict allowlist (`proposal`, `contract`, `invoice`, `document`) rather than a denylist, so any future node type (comment, message, reminder, workflow, template/clause library entities, etc.) is excluded by default until explicitly reviewed. A relationship pointing at a record this client can't resolve a title for (a data inconsistency, or an edge that predates the account) is silently skipped rather than shown with a guessed label.

## Named action

`getClientPortalKnowledgeSummaryAction(eventId): { connections: { nodeType, nodeId, label, relationshipLabel, href }[] }` — re-verifies the event belongs to the caller's own account (via `getClientPortalEventById`, which throws `NotFoundError` otherwise) before reading any graph edges.
