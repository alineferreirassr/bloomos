# Client Contract Experience

`modules/clientPortal/getClientPortalContract.ts`, `modules/clientPortal/components/ClientPortalContractDocumentSection.tsx`.

## No signing, by design

This is a read-only view of the prepared document — sections, resolved clauses, terms, policies, version history, attachments. The real Contract's own send/view/sign flow (`sendContract`/`markViewed`/`markSigned` in `modules/contracts/`) is completely untouched and stays the only path that changes `signature_status`. Nothing in this checkpoint's Client Portal surface lets a client accept, decline, or sign anything.

## The two-session-mechanism split

Every action resolves a `ClientAccount` via `getCurrentClientAccountContext()` — never the team-member session gate `contractPlatformActions.ts` uses. The same split `getClientPortalProposal.ts` (Checkpoint 33) established.

## Visible only once published

A document is only visible to the client once its own document status reaches `"published"` — the same "never show a client a work-in-progress" rule `getClientPortalProposalAction`'s `sent_at !== null` gate enforces, adapted to this checkpoint's document-status vocabulary since there is no separate "sent" concept for the Document layer. Once a new version moves the document back to `"review"`, client access is revoked until it's republished — confirmed by test.

## Named actions (Step 12)

| Action | What it does |
|---|---|
| `getClientPortalContractDocumentAction(contractId)` | The client-safe, variable-substituted document: header, sections (blocks with `{{key}}` already resolved via the [Variable Engine](variable-engine.md)), resolved clauses, terms, policies, footer, current/available version numbers, and real Exhibits |
| `compareClientPortalContractVersionsAction(contractId, a, b)` | Read-only version comparison, reusing `compareContractVersions` directly |
| `listClientPortalContractsAction()` | Every published contract document belonging to the current client |

`ClientPortalContractDocumentSection.tsx` renders all of the above additively on the existing `ClientPortalContractDetailView.tsx`, below the real commercial-summary card that view already had.

## What crosses the boundary and what doesn't

Every block's `text`/`heading`, every clause's `bodyText`, and both `terms`/`policies` are substituted through `substituteVariables` before they ever reach this file's return value — a client never sees a raw `{{client_name}}` placeholder. Internal reasoning (Health category scores, Readiness reasons, document status transitions beyond the current one) stays entirely server-side, the same discipline `getClientPortalProposalAction`'s own doc comment establishes for Proposal Health/Readiness.
