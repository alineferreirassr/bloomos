# Client Portal Journey Integration

`modules/clientPortal/getClientPortalJourneySummary.ts`, `modules/clientJourney/components/ClientPortalJourneyCard.tsx`.

## A separate session mechanism, a separate action

Every other action in this checkpoint's module layer gates on `resolveMemberSessionSnapshot()` — a *team member* session. The Client Portal is accessed by a `ClientAccount`, resolved through `getCurrentClientAccountContext()` instead. `getClientPortalJourneySummaryAction` is a small, dedicated action that resolves the client's own account context, then calls the exported `buildClientJourney(workspaceId, "client", clientId)` — the same pure builder every team-facing action uses — without going through the team-member permission gate at all.

## The client-safe projection — never the raw `ClientJourney`

Step 26 (Privacy) names exactly what must never reach a client-facing surface: private internal notes, exact financial/contract details, internal risk indicators, ownership assignments. `ClientPortalJourneySummary` is a deliberately narrow shape:

```
currentStageLabel: string
progressPercentage: number
nextStepLabel: string | null
pendingSignature: boolean       // derived from the contract_unsigned blocker
pendingPayment: boolean         // derived from deposit_unpaid / final_balance_unpaid
pendingInformationRequests: ClientFacingInformationRequest[]
completedMilestoneLabels: string[]
```

`blockers`, `risks`, `owners`, and `context` (the full internal `ClientJourney` fields) never leave the server — the summary carries only booleans/labels/counts *derived* from them, never the fields themselves.

## Additive to the approved Client Dashboard

`ClientPortalJourneyCard` is a self-fetching client component slotted into `ClientDashboardView.tsx` as one more `LuxuryCard` row, between the existing Proposal/Checklist row and the Event Timeline/What's Included row. It never touches `ClientDashboardData`'s own server-side aggregation pipeline (`getClientDashboardData.ts`) — the same "coordinate additively, never rebuild the pipeline" discipline every other Journey UI integration in this checkpoint follows.

## What it shows

Welcome-context stage label, progress percentage, next step, pending-signature/pending-payment/pending-information-request pills, and a plain list of completed milestone labels — matching the spec's own named Client Portal integration list (Welcome Back, Current Journey Stage, Progress, Next Step, Pending Signature, Pending Payment, Pending Information Requests, Completed Milestones). Upcoming Event/Documents/Messages/Important Dates are already covered by the Client Portal's own existing sections and are not duplicated here.
