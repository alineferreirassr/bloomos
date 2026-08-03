# Client Information Request System

`core/clientJourney/informationRequestEngine.ts`, persisted via `lib/data/mock/clientInformationRequestsStore.ts`. The third genuinely persisted entity this checkpoint introduces — no external forms/email/SMS provider is ever involved; the Client Portal only ever reads and responds to requests already created here.

## Fields

`title`, `description`, `requiredFields: string[]`, `requiredDocuments: string[]`, `dueDate`, `status`, `clientResponse`, `internalNotes`, `relatedJourneyStage`, `relatedEventId` — every field the spec's own Step 15 names.

## Status — live-computed, never stale

`InformationRequestStatus` is `pending | fulfilled | overdue | cancelled`, but "overdue" is never stored as a flag — `isRequestOverdue`/`effectiveStatus` compare the request's own `dueDate` against `now` on every read, so a request can never drift into a stale "pending" state after its due date silently passes.

## Client-facing projection

`toClientFacing()` strips `internalNotes` (and every other internal-only field) before anything reaches the Client Portal — the Client Portal Journey card (see [`client-journey-portal.md`](client-journey-portal.md)) only ever renders `ClientFacingInformationRequest`, never the raw persisted record.

## Lifecycle actions

`createInformationRequestAction` (records a `note_added` Timeline event against the client), `setInformationRequestStatusAction`, `respondToInformationRequestAction` (marks `fulfilled`, stamps `fulfilledAt`, stores the client's own response text). Every mutation invalidates the 30-second journey cache (see [`client-journey.md`](client-journey.md)'s Performance section) so the next `listClientJourneysAction()` call reflects it immediately.
