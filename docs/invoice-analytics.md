# Invoice Analytics

`core/invoicePlatform/invoiceAnalyticsEngine.ts`, `modules/invoicePlatform/invoicePlatformActions.ts` (`getInvoiceAnalyticsAction`).

## 7 named metrics (Step 13)

Pure aggregation over already-fetched `InvoiceBuilderState[]` — no store access, no `Date.now()` (the caller injects `evaluatedAt`), matching `computeContractAnalytics`'s (Checkpoint 34) own structure exactly.

| Metric | Field | How it's computed |
|---|---|---|
| Average Invoice | `averageInvoice_minor` | Mean of `grandTotal_minor` across every current version |
| Average Deposit | `averageDeposit_minor` | Mean of `depositDue_minor` |
| Average Balance | `averageBalance_minor` | Mean of `remainingBalance_minor` |
| Average Discount | `averageDiscount_minor` | Mean of `abs(discountsTotal_minor)` |
| Average Credit | `averageCredit_minor` | Mean of the `credit`/`service_credit`/`invoice_credit` adjustment total per invoice — the same 3-kind grouping the [Comparison Engine](invoice-versioning.md) uses, excluding `manual_adjustment`/`refund_placeholder`/`balance_carry_forward` |
| Average Installments | `averageInstallments` | Mean of `paymentSchedule.length` |
| Invoice Count | `totalInvoices` | Every invoice in the workspace, with or without a built document |
| Outstanding Balance | `outstandingBalance_minor` | **Sum**, not average, of `outstandingBalance_minor` across every invoice — a running workspace total, reusing each snapshot's own `paidToDate_minor`-derived figure rather than recomputing it |

`draftCount`/`reviewCount`/`publishedCount`/`archivedCount` bucket by `InvoiceBuilderState.status`.

## Cache

`invoiceCache.ts` mirrors `contractCache.ts`'s own 30s TTL, workspace-scoped cache exactly — `listInvoiceSummariesAction`/`getInvoiceAnalyticsAction` evaluate every invoice in the workspace on every call, the one genuinely expensive read path here. Every mutation action calls `invalidateInvoiceCache(workspaceId)`.
