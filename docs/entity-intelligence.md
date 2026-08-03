# Entity Intelligence (v2 Checkpoint 24, Step 15)

"Every entity gains a complete 360° workspace" (spec). `getEntityIntelligenceData.ts` composes existing per-module getters plus this checkpoint's own Timeline/Comments engines — it never re-derives their data, and it is not a rebuild of any entity's own detail page.

## What it composes

For a given `(ownerType, ownerId)`:

- **Title/subtitle** — resolved via the entity's own existing lookup function (`getClientById`, `getLeadById`, `getEventById`, `getVendorById`, `getInvoiceById`, `getProposalsRepository().getProposalById`) — never a new query.
- **Timeline** — `aggregateActivity({ workspaceId, ownerType, ownerId })`, the exact same call `EntityTimelinePanel` makes (see `docs/communication-timeline.md`).
- **Comment count** — `getCoreCommentsService().getCommentsForOwner()`.
- **Risk score / band** — **only for `ownerType === "event"`**, reusing Checkpoint 21's own per-event health score from `getOperationsDashboardData().eventHealthScores` (looked up by event id; `null` if the event isn't in that list's "upcoming events" window). No other entity type has an existing health-scoring engine, so `riskScore`/`riskBand` are honestly `null` for Client/Lead/Vendor/Invoice/Proposal — never a fabricated number.
- **Upcoming action count** — pending Reminders tied to this owner (`mockReminderRepository.listRemindersForOwner`).
- **Recent change count** — Timeline entries within the last 7 days.
- **Relationship score** — always `null` this checkpoint. See Known Limitations.

## Supported entity types

`ENTITY_INTELLIGENCE_SUPPORTED_TYPES` (`types/communication.ts`) lists the 6 types with a real title-resolution lookup: `client`, `lead`, `event`, `vendor`, `invoice`, `proposal`. Any other `EntityType` can still get a bare Timeline + Comments composition (every entity type supports those two, universally), just not the fuller title/subtitle/risk-score treatment this list implies.

## Where it's wired

`EntityTimelinePanel` and `CommentsPanel` (the two pieces of Entity Intelligence with real UI this checkpoint) are mounted on Client and Event detail pages. A dedicated, single `EntityIntelligencePanel` component composing *all* of `getEntityIntelligenceData`'s fields (Overview/Timeline/Comments/Messages/Files/Related Records/AI Insights as one tabbed 360° view, per the spec's own Step 15 wording) was not built this session — see the checkpoint-level report's Known Limitations for the honest scope line between "the data function exists and is tested" and "a single consolidated 360° UI renders all of it."

## Why "Relationship Score" is `null`

The spec's Step 15 asks for a Relationship Score alongside a Risk Score. Checkpoint 23's own Client Intelligence already computes a client segmentation (`isVip`/`isReturning`/`isInactive`) from real lifetime-value and event-count data — but that's a categorical segmentation, not a 0–100 score, and it exists only for `client`, not any other entity type. Rather than invent a fabricated numeric score by mapping VIP→100/Returning→60/One-time→30 (a made-up scale with no real basis), `relationshipScore` is left honestly `null` everywhere this checkpoint. A future checkpoint that wants a real Relationship Score should design it deliberately, the same care Checkpoint 23's Business Health Score received, rather than retrofit one under this checkpoint's own time budget.
