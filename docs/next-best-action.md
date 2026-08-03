# Next Best Action Engine

`core/clientJourney/nextBestActionEngine.ts`. Purely deterministic: every one of the 20 named actions is triggered by a real current stage or a real, already-detected Blocker — nothing here scores or prioritizes anything Executive Decisions already owns.

## The 20 named actions and their triggers

| Action | Trigger | Priority |
|---|---|---|
| Send first-contact message | Lead status is `new` | medium |
| Complete qualification | Lead status is `contacted`/`welcome_guide_sent`/`consultation_scheduled` | medium |
| Schedule discovery placeholder | Current stage is Qualified | low |
| Finish proposal | Current stage is Proposal Preparation | medium |
| Send proposal | A draft proposal exists, unreviewed | high |
| Follow up on proposal | `proposal_not_accepted` blocker present | high |
| Create contract | `contract_missing` blocker present | high |
| Send contract | A Contract exists, unsent | high |
| Request signature | `contract_unsigned` blocker present | critical |
| Create invoice | `invoice_missing` blocker present | high |
| Send invoice | An Invoice exists, unsent | high |
| Follow up on deposit | `deposit_unpaid` blocker present | critical |
| Activate Client Portal | `missing_portal_access` blocker present | medium |
| Send welcome message | Current stage is Welcome | medium |
| Request missing information | `missing_client_documents` blocker present | medium |
| Prepare service instructions | Current stage is Planning | medium |
| Request final payment | `final_balance_unpaid` blocker present | critical |
| Send completion message | Current stage is Service Completed/Closed | low |
| Request review | Journey is Closed, no review requested yet | low |
| Create rebooking opportunity | Stage is Review Received or Closed, no rebooking offered yet | low |

## Every action's shape

Each `NextBestAction` carries `reason`, `priority` (a `JourneySeverity`), `sourceStage`, `requiredPermission` (always `client_journeys.manage` — executing the underlying real action is gated by the *other* module's own permission, this field only gates seeing/acting on the suggestion from the Journey surface), a `deepLink` to the subject's real record, and the exact related subject/source record.

## Feeds Executive Decisions, never replaces it

This engine's own output is translated into `OperationalRecommendation`s by `journeyExecutiveIntegration.ts` and registered as one more `recommendationSources` entry in `executiveDecisionsActions.ts` — the same seam every prior checkpoint's own findings engine uses. It is explicitly **not** a second Executive Decision Engine: nothing here re-scores or re-prioritizes an Executive Decision itself.
