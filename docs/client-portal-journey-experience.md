# Journey Experience

`modules/clientPortal/getClientPortalJourneyDetail.ts`, rendered at `/client-access/journey` by `ClientPortalJourneyView.tsx`.

## One Journey engine, two client-safe projections

Checkpoint 32 built `buildClientJourney()` and the client-safe `getClientPortalJourneySummaryAction` (a compact dashboard card: current stage, progress %, next step, pending-signature/payment flags). This checkpoint's `getClientPortalJourneyDetailAction()` composes the exact same engine and Information Requests service for a fuller page — every stage step (not just "current"), every milestone (not just completed ones), and every Information Request the client can read/respond to. Neither action re-derives Journey state; they only project it differently.

## The privacy line, held twice

Checkpoint 32's own Step 26 named what must never reach a client-facing surface: private internal notes, exact financial/contract details, internal risk indicators, ownership assignments. `blockers`/`risks`/`owners`/`context` never leave `buildClientJourney()`'s server-side result in either projection — the detail action carries only booleans/labels/counts derived from those fields.

## Journey Notes — the one new write path

"Journey Notes" is this checkpoint's own name for the client-facing side of Information Requests: a staff member creates a request (Checkpoint 32), and `respondToClientPortalJourneyNoteAction(requestId, response)` is the client's own reply path, composing the same `recordClientResponse` the internal `respondToInformationRequestAction` already calls. Before writing, the action independently re-verifies the target request's `workspaceId`/`clientId` match the caller's own session — never trusting a client-supplied `requestId` alone. Gated by `ClientAccountContext`, the same two-session-mechanism split every other Client Portal write action uses (see `client-portal.md`'s Security model section).

## Named read

| Action | Returns |
|---|---|
| `getClientPortalJourneyDetailAction()` | `currentStageLabel`, `progressPercentage`, `currentStageProgress`, every `steps[]` (completed/current/upcoming), every `milestones[]`, and `notes[]` (client-facing Information Requests) |
