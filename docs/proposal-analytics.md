# Proposal Analytics

`core/proposalPlatform/proposalAnalyticsEngine.ts`.

## 10 named metrics, pure aggregation

`computeProposalAnalytics(inputs: ProposalAnalyticsInput[], evaluatedAt)` is a pure aggregation over already-fetched `(ProposalDraft, ProposalBuilderState | null)` pairs — no store access, no `Date.now()` (the caller injects `evaluatedAt`), matching every other Analytics engine in this codebase (`journeyAnalyticsEngine.ts`, Checkpoint 32).

| Metric | Field(s) | Computation |
|---|---|---|
| Acceptance Rate | `acceptanceRate` | accepted / (accepted + declined) — decided proposals only, `0` with zero denominator |
| Average Proposal Value | `averageProposalValue_minor` | mean grand total across builder states with a current version |
| Average Time To Accept | `averageTimeToAcceptHours` | mean hours from `generated_at` to `reviewed_at`, `null` when nothing has been accepted |
| Revision Count | `averageRevisionCount` | mean `versions.length - 1` per proposal |
| Template Usage | `templateUsage` | count by `templateKey` of the current version |
| Package Usage | `packageUsage` | count by package id across current versions' `packageIds` |
| Add-on Usage | `addonUsage` | count by add-on id across current versions' `addonIds` |
| Average Discount | `averageDiscountPercent` | mean `discountAmount/subtotal` across proposals with a real discount applied |
| Average Deposit | `averageDepositPercent` | mean `depositDue/grandTotal` across proposals with a positive grand total |
| Conversion Rate | `conversionRate` | accepted / every proposal ever created — the funnel-wide view |

## Acceptance Rate vs. Conversion Rate — two real metrics, not a duplicate

Both are named separately in the spec and computed from the same underlying counts, but they answer different questions: Acceptance Rate is "of the proposals someone has actually decided on, how many said yes" (denominator = decided only); Conversion Rate is "of every proposal this workspace has ever generated, how many became a yes" (denominator = everything). Neither is fabricated — they're the same accepted-count numerator over two legitimately different denominators.

## Tested

10 tests cover the empty-workspace zero case, accepted/declined counting, both rate calculations independently, document-status counting, sent/viewed counting, average value, template/package/add-on usage tallying, revision counting, and the `null` time-to-accept case.
