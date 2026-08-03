# Client Journey & CRM Experience Platform

`core/clientJourney/*`, `modules/clientJourney/clientJourneyActions.ts`, routed at `/client-journeys` and `/client-journeys/[id]`.

## Core principle

The Client Journey layer **coordinates and explains** state that already lives in Leads, Clients, Proposals, Contracts, Invoices, Events, Documents, the Client Portal, Communication, and Timeline. It never rebuilds CRM, never creates a parallel Lead/Client/Proposal/Contract/Invoice/Event/Document/Communication/Portal system, and — with exactly two disclosed exceptions — never persists anything of its own.

## Storage split

Almost the entire platform is **computed fresh on every read**:

| Computed fresh (never persisted) | Persisted (this checkpoint's own tables) |
|---|---|
| Current stage, progress, health, milestones, requirements, blockers, risks, next best actions, context | `JourneyTransitionRecord` — the manual-override audit log (cancel/lose/restore/reopen/skip/advance) |
| | `JourneyOwnerRecord` — who holds each of the 6 named ownership roles |
| | `ClientInformationRequest` — the one genuinely new client-facing entity |

Persisting a computed duplicate of any journey figure would itself be the forbidden "second source of truth," so the resolver (`journeyStateResolver.ts`) re-derives the current stage from source-module facts on every call. Only the three entities above have state that cannot be re-derived from anything else — the same "persist only what cannot be re-derived" discipline `OperationalAlert`/`OperationalIncident` established in Checkpoint 31.

## Module map

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/clientJourney.ts` | Every shape in this checkpoint — see the individual step docs below |
| Mock stores | `lib/data/mock/{journeyTransitionsStore,journeyOwnersStore,clientInformationRequestsStore}.ts` | The three persisted entities |
| State Resolver | `core/clientJourney/journeyStateResolver.ts` | [`journey-state-resolver.md`](journey-state-resolver.md) |
| Transition Engine | `core/clientJourney/journeyTransitionEngine.ts` | [`journey-transitions.md`](journey-transitions.md) |
| Requirements Engine | `core/clientJourney/journeyRequirementsEngine.ts` | [`journey-requirements.md`](journey-requirements.md) |
| Blocker Engine | `core/clientJourney/journeyBlockerEngine.ts` | [`journey-blockers.md`](journey-blockers.md) |
| Progress Engine | `core/clientJourney/journeyProgressEngine.ts` | [`journey-progress.md`](journey-progress.md) |
| Health Engine | `core/clientJourney/journeyHealthEngine.ts` | [`journey-health.md`](journey-health.md) |
| Next Best Action Engine | `core/clientJourney/nextBestActionEngine.ts` | [`next-best-action.md`](next-best-action.md) |
| Risk Engine | `core/clientJourney/journeyRiskEngine.ts` | 12 named risks, plain elapsed-time/field checks, fully explainable |
| Analytics Engine | `core/clientJourney/journeyAnalyticsEngine.ts` | 11 named metrics, pure aggregation over already-evaluated journeys |
| Information Request Engine | `core/clientJourney/informationRequestEngine.ts` | [`client-information-requests.md`](client-information-requests.md) |
| Timeline Adapter | `core/clientJourney/journeyTimelineAdapter.ts` | Merges already-recorded Timeline entries across every owner a journey touches — records nothing new itself |
| Context Builder | `core/clientJourney/journeyContextEngine.ts` | Deterministic Bloom AI context bundle, assembled from already-computed figures only |
| Executive Integration | `core/clientJourney/journeyExecutiveIntegration.ts` | Translates Blockers/Risks into `OperationalRecommendation`s for Executive Decisions |
| Performance cache | `core/clientJourney/journeyCache.ts` | 30s TTL cache in front of the two O(N) list/analytics reads, invalidated on every mutation |
| Module layer | `modules/clientJourney/clientJourneyActions.ts` | Every server action — see below |
| Dashboards | `/client-journeys`, `/client-journeys/[id]` | [`client-journey-dashboard.md`](client-journey-dashboard.md) |
| Client Portal integration | `modules/clientPortal/getClientPortalJourneySummary.ts` | [`client-journey-portal.md`](client-journey-portal.md) |

## Severity reuse

`JourneySeverity = DecisionPriority` (`critical`/`high`/`medium`/`low`/`informational`) — the same alias-not-reinvention discipline Operations Center established, since Blockers/Risks sit at the same executive altitude as Executive Decisions.

## Exact-source-record, no new entity types

Journey Blockers/Risks reference the exact source module and record id (`sourceModule`/`sourceRecordId`) rather than a generic "something's wrong" flag. The journey itself is never given its own `EntityType` — Timeline/Comments/Notes on a journey are recorded against the subject's own real `lead`/`client` ownership, since a journey is a computed view over that subject, not a new thing. `client_information_request` is the one new `EntityType`, added purely so the existing generic Comments system can attach to a request the same way `operational_alert`/`operational_incident` did in Checkpoint 31.

## Module-layer action summary

`evaluateClientJourneyAction(subjectType, subjectId)` is the one function every other read composes from. `listClientJourneysAction()` and `getJourneyAnalyticsAction()` are the two O(N)-over-the-workspace reads, cached for 30 seconds. `transitionClientJourneyAction`/`assignJourneyOwnerAction`/the four Information Request actions are the platform's only real mutations — every other Next Best Action links out to the real source module rather than performing the action itself.

## Permissions

7 capabilities: `client_journeys.view`/`.manage`/`.assign`/`.transition`, `client_information_requests.view`/`.manage`, `client_journey_sensitive_data.view`. Manager gets everything except the sensitive-data flag; staff gets `client_journeys.view` and `client_information_requests.view` only. As with every prior checkpoint, no action in `clientJourneyActions.ts` checks a permission inline — only `session.kind !== "active"` — permissions exist in `permissionMatrix.ts`/`routeAccess.ts` for UI-level gating.

## Known gaps (disclosed, not hidden)

1. **Two proxy signals, not fabricated facts.** `ProposalDraft` has no "sent"/"viewed" state in this codebase — `reviewed_at` is used as the "presented to client" signal. Discovery/Negotiation (optional stages) read from `Lead.status === "consultation_scheduled"` and a proposal's own `parent_proposal_id`, respectively.
2. **Everything from Follow-Up onward has no source-module field.** BloomOS has no review/testimonial module, so `follow_up`/`review_requested`/`review_received`/`rebooking_opportunity` are reachable only through an explicit, recorded `JourneyTransitionRecord` — the resolver never guesses its way past `closed` on its own.
3. **`criticalSinglePointsOfFailure`-style gaps.** `requiredDocumentsComplete`, `operationalPlanExists`/`executionPackageExists`, `pendingApprovalsCount`, and internal-follow-up counts are accepted as caller-supplied inputs where no real detector exists yet in the module layer — never fabricated, disclosed as `null`/`0` until a future checkpoint wires the real source.
4. **No live authenticated browser verification** — see [`v2-checkpoint-32.md`](v2-checkpoint-32.md).
