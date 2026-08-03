# Journey Progress Engine

`core/clientJourney/journeyProgressEngine.ts`.

## Weighting — documented, not equal-split

Progress is weighted by business significance, not an equal 1/N split across stages:

- Preparation/administrative stages (drafting, sending) carry a modest weight (2-4).
- The 5 stages that represent a genuine commitment — **Proposal Accepted**, **Contract Signed**, **Deposit Paid**, **Service Completed**, **Closed** — carry a heavier weight (8-10), since reaching one of these is what actually de-risks the engagement, not merely administrative progress.
- Optional stages (**Discovery**, **Negotiation**) are excluded from both the numerator and denominator of the core percentage — never reaching one is not incomplete progress, it's a skipped optional step.
- Everything from **Follow-Up** onward is an *extension* of a Closed journey, not part of reaching Closed, so it's excluded from the core percentage the same way.

`CORE_PROGRESS_STAGES` is the exported list of the 21 stages that make up the weighted denominator (every stage from New Lead through Closed except the 5 optional ones — Discovery, Negotiation are the only two that overlap that range).

## Fields

- `overallPercentage` — `round(completedWeight / totalWeight * 100)` over `CORE_PROGRESS_STAGES` only.
- `currentStageProgress` — the ratio of met requirements for the current stage (from the Requirements Engine); `100` when no requirements are defined for that stage.
- `completedStages`/`remainingRequiredStages` — every core stage at or before/after the current rank; `remainingRequiredStages` is empty once the journey is terminal.
- `optionalStages` — the 5 named optional stages, always.
- `skippedStages` — optional stages whose rank is behind the current stage (legitimately bypassed, not a gap).
- `blockedStages` — merged in separately by `withBlockedStages()` from the Blocker Engine's own output, deduped; this engine never re-detects blockers itself.

## Milestones

`computeJourneyMilestones` returns one entry per `CORE_PROGRESS_STAGES` item with its own weight and a `completed` flag — the same list the Dashboard/Detail page render as a checklist.
