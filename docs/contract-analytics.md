# Contract Analytics

`core/contractPlatform/contractAnalyticsEngine.ts`, `modules/contractPlatform/contractPlatformActions.ts` (`getContractAnalyticsAction`).

## 7 named metrics (Step 11)

Pure aggregation over already-fetched `(Contract, ContractBuilderState | null)` pairs — no store access, no `Date.now()` (the caller injects `evaluatedAt`), matching `computeProposalAnalytics`'s (Checkpoint 33) own structure exactly.

| Metric | Field | How it's computed |
|---|---|---|
| Average Contract Value | `averageContractValue_minor` | Mean of `grandTotal_minor` across every current version's pricing reference |
| Average Revisions | `averageRevisionCount` | Mean of `versions.length - 1` |
| Template Usage | `templateUsage` | Count by `builderTemplateKey` |
| Clause Usage | `clauseUsage` | Count by each real clause id in `clauseIds` |
| Time In Draft | `averageTimeInDraftHours` | Mean of `hoursBetween(created_at, updated_at)`, only for documents that have already left `"draft"` |
| Time To Ready | `averageTimeToReadyHours` | Mean of `hoursBetween(created_at, ready_at)`, only for documents with `ready_at` set |
| Completion Rate | `completionRate` | (published or `ready_at` set) / (documents started) — the document-preparation completion rate, distinct from the real Contract's own commercial `status` |

## Two disclosed proxies

No dedicated "left draft" event is persisted, so:

- **Time In Draft** uses `hoursBetween(created_at, updated_at)` for documents that have already moved past `"draft"` — `updated_at` is the timestamp of the status transition itself, since both `appendVersion` and `setStatus` bump it.
- **Time To Ready** uses the real `ready_at` (set once, the first time [Readiness](contract-health.md) reaches `"ready"`).

Both are disclosed proxies over the closest real signal, never fabricated data.

## Cache

`contractCache.ts` mirrors `proposalCache.ts`'s own 30s TTL, workspace-scoped cache exactly — `listContractSummariesAction`/`getContractAnalyticsAction` evaluate every contract in the workspace on every call, the one genuinely expensive read path here. Every mutation action calls `invalidateContractCache(workspaceId)`.
