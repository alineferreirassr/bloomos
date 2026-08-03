# Notification Health Engine

`core/notifications/notificationHealthEngine.ts` — Checkpoint 41, Step 6. Same category-score composite pattern `core/search/searchHealthEngine.ts` (Checkpoint 40) established, following `types/businessHealth.ts`'s `{score, issues, notApplicableReason}` `HealthCategoryScore` contract via the notification-specific `NotificationHealthCategoryScore`.

## Categories

| Category | What it measures |
|---|---|
| `delivery_readiness` | Fraction of `NotificationChannel`s with a real provider registered (`isChannelConfigured()`) — `25%` by default, since only `in_app` is ever "configured" without a real provider |
| `template_coverage` | Fraction of `NotificationKind`s with an active `NotificationTemplate` |
| `routing_health` | Verifies the real "exactly one recipient" invariant `createInAppNotification` enforces at write time — a non-zero count is a data-integrity regression, not a normal state; `notApplicable` with zero notifications |
| `preference_health` | Fraction of workspace members who've ever called `updatePreferences` (vs. still on `defaultPreferences()`) |
| `configuration_health` | Fraction of the 5-setting workspace-level notification configuration surface (`notificationsSection.ts`) with an explicit stored value rather than sitting on its default |

`overallScore` is the average of every non-null category. Every issue becomes a `NotificationFinding` with a severity of `critical` (score < 50), `warning` (< 80), or `info`.

## Business Health integration

`communication_health` (`types/businessHealth.ts`) was `notApplicable` through Checkpoint 40 — "Checkpoint 24's Communication Platform data is not wired into the Knowledge Graph." This checkpoint closes that gap the same way `workflow_readiness`/`search_health` closed theirs: `core/knowledge/businessHealthEngine.ts`'s `ComputeBusinessHealthInput` gained an optional `notificationHealth?: NotificationHealthReport | null`; `businessHealthActions.ts` now computes it for real and passes it in.

Honestly scoped: `communication_health` reflects the Notification domain specifically, not the whole Communication Platform — Comments/Presence/Internal Messaging still have no Knowledge Graph wiring of their own. A future checkpoint closing *that* gap should extend this composite, not duplicate it.

## Executive Decisions integration

`core/notifications/executiveIntegration.ts`'s `notificationHealthToRecommendations()`/`notificationHealthRecommendationSource()` mirror `core/search/executiveIntegration.ts` exactly — every finding becomes an `OperationalRecommendation` with `nodeType: "workspace"` (Notification Health is workspace-wide, never per-record). `modules/notifications/notificationPlatformActions.ts`'s `notificationRecommendationsForExecutiveDecisions()` is the `xRecommendationsForExecutiveDecisions()`-convention function wired into `executiveDecisionsActions.ts`'s own `recommendationSources` array.
