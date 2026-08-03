# v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Every prior checkpoint built one commercial or operational system in isolation — Leads, Clients, Proposals, Contracts, Invoices, Events, Documents, the Client Portal, Communication, Timeline. The Client Journey layer **coordinates and explains** all of them into one continuous journey — First Contact through Rebooking — without rebuilding CRM, without creating a parallel Lead/Client/Proposal/Contract/Invoice/Event/Document/Communication/Portal system, and without becoming a second source of truth for any of them.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/clientJourney.ts` | `ClientJourney`/`JourneyStage`(29)/`JourneyStep`(14)/`JourneyBlocker`(17 types)/`JourneyRisk`(12 types)/`NextBestAction`(20 types)/`JourneyTransitionRecord`/`JourneyOwnerRecord`/`ClientInformationRequest` — see [`client-journey.md`](client-journey.md) |
| Mock stores | `lib/data/mock/{journeyTransitionsStore,journeyOwnersStore,clientInformationRequestsStore}.ts` | The only three persisted entities this checkpoint owns |
| State Resolver | `core/clientJourney/journeyStateResolver.ts` | [`journey-state-resolver.md`](journey-state-resolver.md) — derives the current stage purely from source-module facts |
| Transition Engine | `core/clientJourney/journeyTransitionEngine.ts` | [`journey-transitions.md`](journey-transitions.md) — validates every manual override before it's recorded |
| Requirements / Blocker / Progress / Health Engines | `core/clientJourney/{journeyRequirementsEngine,journeyBlockerEngine,journeyProgressEngine,journeyHealthEngine}.ts` | [`journey-requirements.md`](journey-requirements.md), [`journey-blockers.md`](journey-blockers.md), [`journey-progress.md`](journey-progress.md), [`journey-health.md`](journey-health.md) |
| Next Best Action / Risk / Analytics Engines | `core/clientJourney/{nextBestActionEngine,journeyRiskEngine,journeyAnalyticsEngine}.ts` | [`next-best-action.md`](next-best-action.md) — 20/12/11 named items respectively |
| Information Request Engine | `core/clientJourney/informationRequestEngine.ts` | [`client-information-requests.md`](client-information-requests.md) |
| Timeline Adapter / Context Builder / Executive Integration | `core/clientJourney/{journeyTimelineAdapter,journeyContextEngine,journeyExecutiveIntegration}.ts` | Merge existing Timeline entries, assemble deterministic Bloom AI context, translate Blockers/Risks for Executive Decisions — none of the three record or compute anything new |
| Performance cache | `core/clientJourney/journeyCache.ts` | 30s TTL in front of the two O(N) reads, invalidated on every mutation |
| Module layer | `modules/clientJourney/clientJourneyActions.ts` | Evaluate, list, transition, ownership, information requests, analytics, Executive Decisions feed |
| Dashboards | `/client-journeys`, `/client-journeys/[id]` | [`client-journey-dashboard.md`](client-journey-dashboard.md) |
| Client Portal integration | `modules/clientPortal/getClientPortalJourneySummary.ts` | [`client-journey-portal.md`](client-journey-portal.md) |

## Reuse, honored exactly as the stop condition requires

- **Leads, Clients, Proposals, Contracts, Invoices, Events, Documents, Client Portal** — never duplicated. Every figure the Journey shows is read from these modules' own real fields through `gatherJourneyRecords` in the module layer; nothing is refiltered from raw records when a module's own already-computed summary already answers the question (Finance's own `EventFinancialSummary.deposit_paid_minor`/`outstanding_minor` drive every payment-related stage and blocker, never a re-derived total).
- **Lead-to-Client conversion** — the Lead Journey card links to the existing `LeadActions` component's own Convert action; it never reimplements the conversion flow.
- **Executive Decisions** — Blockers/Risks are translated through `journeyExecutiveIntegration.ts` into the existing `OperationalRecommendation` shape and registered as one more `recommendationSources` entry in `executiveDecisionsActions.ts` (`generatedBy: "client_journey_engine"`) — the exact seam every checkpoint since Route Optimization (30) has used, additive, confirmed by the full pre-existing Executive Decisions/Route Optimization/Operations Center test suites still passing unchanged.
- **Knowledge Graph** — the journey itself deliberately gets **no** `EntityType` of its own; Comments/Notes/Timeline on a journey reuse the subject's own real `lead`/`client` ownership. `client_information_request` is the one new `EntityType`, added purely so the existing generic Comments system can attach to it — the same "new persisted entity gets its own owner type" precedent `operational_alert`/`operational_incident` established in Checkpoint 31.
- **Timeline** — every real lifecycle transition this checkpoint owns (`journey_cancelled`/`journey_reopened`, plus `proposal_created`/`proposal_accepted`/`proposal_declined` wired into the real Proposal actions for the first time) records through the existing `recordTimelineActivity`; every pure-read evaluation emits nothing. The Journey Timeline Adapter merges already-recorded entries across every owner a journey touches (`lead`/`client`/`proposal`/`contract`/`invoice`/`event`) rather than building a second Timeline store.
- **Permissions** — `client_journeys.view`/`.manage`/`.assign`/`.transition`, `client_information_requests.view`/`.manage`, `client_journey_sensitive_data.view` follow the exact narrower-manage/broader-view precedent every module in this codebase uses; wired into `permission.ts`, `permissionMatrix.ts` (manager gets all but the sensitive-data flag, staff gets the two `.view` capabilities), and `routeAccess.ts` (`/client-journeys` gated on `client_journeys.view`).
- **No AI, no external forms/email/SMS/signature/payment provider anywhere.** The Bloom AI context bundle (`journeyContextEngine.ts`) is plain template-sentence assembly over already-computed figures, never a generated fact.

## The storage-split design decision, disclosed

Persisting a computed duplicate of the current stage, progress, health, blockers, or risks would itself be the forbidden "second source of truth," so almost the entire platform is computed fresh on every `evaluateClientJourneyAction()` call. Only three entities are genuinely stateful because their state cannot be re-derived from source modules on the next call: `JourneyTransitionRecord` (the manual-override audit log), `JourneyOwnerRecord` (who holds each of the 6 named ownership roles), and `ClientInformationRequest` (the one new client-facing entity).

## The Welcome-stage resolver bug, caught and fixed

An early version of the State Resolver treated "no Contract row exists yet" as equivalent to "no Contract is required," letting a journey skip straight from Proposal Accepted to Welcome before Contract Preparation/Sent/Signed were ever evidenced. This checkpoint's own test suite caught it (`journeyStateResolver.test.ts`, 17 tests) before it shipped; the fix requires an *actual* signed Contract for Welcome, never a merely-absent one — see [`journey-state-resolver.md`](journey-state-resolver.md).

## Known limitations (disclosed, not hidden)

1. **No live authenticated browser verification.** `NEXT_PUBLIC_DATA_MODE=mock` still requires sign-in and this session has no demo credentials; per policy, credentials are never requested in chat. Verified instead through 9 component tests exercising the actual rendered UI against mocked module actions, plus a successful `next build` of all four new routes.
2. **`follow_up`/`review_requested`/`review_received`/`rebooking_opportunity` have no source-module field.** BloomOS has no review/testimonial module; these stages are reachable only through an explicit, recorded manual transition — disclosed in [`journey-state-resolver.md`](journey-state-resolver.md).
3. **`requiredDocumentsComplete`, `operationalPlanExists`/`executionPackageExists`, `pendingApprovalsCount`, and internal-follow-up counts** are accepted as caller-supplied inputs where no real detector exists yet in the module layer; they read as vacuous-satisfied rather than a fabricated blocker.
4. **Filters are not yet persisted as Saved Views.** The Dashboard's Type/Stage filters are local component state only — a future checkpoint's own job to persist.

## Quality gates

- `tsc --noEmit -p .`: clean
- `eslint .`: clean (0 errors; a small number of pre-existing warnings entirely unrelated to Client Journey work)
- `vitest run`: **839/839 test files passing, 7533/7533 tests passing** — fully green, including a clean re-run of the whole suite that confirmed the one earlier `InventoryItemForm.test.tsx` failure was parallel-run flakiness, not a regression (152 new tests across 19 new files for this platform alone: 14 core engine test files, 3 mock store test files, the `clientJourneyActions.ts` integration suite, and 2 dashboard/detail component test files)
- `next build`: succeeds — `/client-journeys` and `/client-journeys/[id]` both compile and appear in the route manifest as dynamic (`ƒ`) routes

## Success criteria, answered

- **Where is this client in the journey?** `ClientJourney.currentStage` — one of 29 named stages, resolved fresh from source-module facts on every read.
- **What has already happened?** `progress.completedStages` and `milestones` (a weighted checklist), plus the merged Journey Timeline across every real owner the journey touches.
- **What is required next?** `nextBestActions` — up to 20 named, deterministically triggered actions, each with its own deep link to the real place to act.
- **What is blocking progress?** `blockers` — 17 named types, each with an exact source module and record id, never a generic flag.
- **Who is responsible?** `owners` — 6 named roles (Primary/Sales/Client Care/Operations/Finance/Document), assignable from the Journey Detail page.
- **What is the client waiting for?** `pendingInformationRequests` (Client Portal) / the Information Requests section (Journey Detail) — the one genuinely new client-facing entity this checkpoint owns.
- **Which commercial record controls the next stage?** Every blocker and requirement result names its exact `sourceModule`/`sourceRecordId` — never an opaque "something's wrong."
- **Which client journeys are at risk?** `risks` — 12 named types, plain elapsed-time/field checks, fully explainable from the description string alone.

The Client Journey Platform coordinates the existing CRM and client-facing systems without replacing any of them — no parallel Lead/Client/Proposal/Contract/Invoice/Event/Document/Communication/Portal/Timeline/Executive Decision/Operational Intelligence system was created, and no external payment/calendar/email/SMS/signature/forms provider was ever connected.
