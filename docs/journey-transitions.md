# Journey Transition Engine

`core/clientJourney/journeyTransitionEngine.ts`, persisted via `lib/data/mock/journeyTransitionsStore.ts`.

## What it validates

The current stage for every non-terminal, non-post-closed journey is always recomputed fresh by the State Resolver — this engine never overrides that. What it validates is every *manual* action a team member can take on a journey before it is ever written to a `JourneyTransitionRecord`, satisfying the spec's own explicit prohibition on "arbitrary stage mutation without validation":

| Request kind | Produces | Validation |
|---|---|---|
| `advance` | `allowed` or `blocked` | Target must be ahead of the current stage; every requirement the Requirements Engine already evaluated for that target must be met |
| `skip_optional` | `skipped_optional` or `blocked` | Every stage strictly between current and target must be one of the 5 named optional stages |
| `cancel` | `cancelled` or `blocked` | Blocked only when the journey is already terminal |
| `lose` | `lost` or `blocked` | Blocked once the journey has already reached Closed or later |
| `restore` | `restored` or `blocked` | Only valid from `lost` or `cancelled` |
| `reopen` | `reopened` or `blocked` | Target must be earlier than the current stage |

## What gets recorded

Every `JourneyTransitionRecord` carries `previousStage`, `newStage`, `trigger`, `sourceRecordId`, `actingMemberId`, and — for a blocked attempt — `blockingRules`, the exact list of unmet requirement labels or the exact non-optional stage names that would have been skipped. A blocked attempt is still recorded: it never silently disappears, it's visible in the journey's own transition history as an explained no-op.

## The one place this feeds the State Resolver

`transitionClientJourneyAction` in the module layer records `journey_cancelled`/`journey_reopened` Timeline events for the two transition types that have no other natural owner (`cancel`/`reopen`). The State Resolver's own short-circuit for `cancelled`/`lost` and its post-closed continuation logic both read the *latest* recorded transition — so a manual override is durable across re-evaluations without ever being persisted as a duplicate of the stage itself.
