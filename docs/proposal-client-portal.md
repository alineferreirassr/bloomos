# Client Proposal Experience

`modules/clientPortal/getClientPortalProposal.ts`, `modules/proposalPlatform/components/ClientPortalProposalCard.tsx`.

## A separate session mechanism, the same Checkpoint 32 precedent

Exactly like `getClientPortalJourneySummary.ts`: this resolves a `ClientAccount` via `getCurrentClientAccountContext()`, never the team-member session gate `proposalPlatformActions.ts` uses, and reuses the exported `buildProposalDetail` read model directly. Only proposals with `builderState.sent_at !== null` are ever visible to a client — a draft still being built is never exposed, checked both when listing (`listClientPortalProposalsAction`) and when opening one (`getClientPortalProposalAction` rejects an unsent proposal).

## The 8 named actions

| Spec action | Implementation |
|---|---|
| View Proposal | `getClientPortalProposalAction` — also the real trigger for `proposal_document_viewed` (Checkpoint 32 explicitly deferred this event for lack of a real trigger; this checkpoint supplies one) |
| View Versions | `availableVersionNumbers` on the summary |
| Compare Versions | `compareClientPortalProposalVersionsAction`, reusing the same [Comparison Engine](proposal-versioning.md) the staff surface uses |
| Request Revision | `requestProposalRevisionAction` — records `proposal_revision_requested` |
| Accept Placeholder | `submitClientProposalResponseAction(id, "accepted")` |
| Decline Placeholder | `submitClientProposalResponseAction(id, "declined")` |
| Favorite Proposal | `toggleFavoriteProposalAction` |
| Download PDF Placeholder | Rendered disabled in `ClientPortalProposalCard`, no server action — no PDF generation exists this checkpoint |

## Accept/Decline are genuinely non-binding — disclosed, not hidden

This is the one design decision this checkpoint makes most explicit: a client's Accept/Decline click records `ProposalBuilderState.clientResponse` (`"accepted" | "declined"`) — the client's own **recorded intent**, timestamped, surfaced back to staff — and fires `proposal_client_response_recorded`. It never calls `acceptProposalDraft.ts`/`rejectProposalDraft.ts` (Checkpoint 3/32), which remain the only path that actually flips `ProposalDraft.status`, gated on `events.update` and callable only by staff. Building real client-authority signing was explicitly out of scope this checkpoint (the stop condition's own e-signature prohibition) — this design gives the client a real, honest, persisted "I said yes" without fabricating legal authority for it.

## Client-safe projection

`ClientPortalProposalSummary` carries only `title`, `heroHeadline`, `sections`, `pricing`, `terms`, `policies`, `currentVersionNumber`, `availableVersionNumbers`, `favorited`, `clientResponse`, `revisionRequestedAt` — never the internal `ProposalHealth`/`ProposalReadiness`/staff notes/Timeline. `resolveOwnedProposal` double-checks `workspace_id` and `client_id` match the current account before returning anything, so one client can never see another's proposal by guessing an id.

## Additive to the approved Client Dashboard

`ClientPortalProposalCard` is a self-fetching client component slotted into `ClientDashboardView.tsx` as one more `LuxuryCard` row, directly below `ClientPortalJourneyCard` — it never touches `ClientDashboardData`'s own server-side aggregation pipeline, the same "coordinate additively, never rebuild the pipeline" discipline every other Journey/Proposal UI integration in this codebase follows.
