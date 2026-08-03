# Invoice Versioning & Comparison

`core/invoicePlatform/invoiceBuilderEngine.ts` (versioning), `core/invoicePlatform/invoiceComparisonEngine.ts`.

## Never overwrite

`InvoiceBuilderState.versions` is append-only — `appendVersion` (`invoiceBuilderStore.ts`) always adds a new `InvoiceVersion` and repoints `current_version_id`, never mutates or removes an existing one. `restoreVersion` only repoints `current_version_id` back at an earlier version; the version list itself is never trimmed or reordered.

## Draft → Review → Published → Archived → Restored → Compared

`INVOICE_DOCUMENT_STATUSES = ["draft", "review", "published", "archived"]`.

- **First version** always leaves the document in `"draft"` (`nextStatusAfterVersion`).
- **A later version created while already `"published"`** moves the document to `"review"` — a real edit is happening on top of what may already be under review, so it never silently stays `"published"`. The same "never silently overwrite what was already prepared" precedent `nextStatusAfterVersion` established for Proposal (Checkpoint 33) and Contract (Checkpoint 34).
- **Publish** (`publishInvoiceVersionAction`) sets status to `"published"`.
- **Archive** (`archiveInvoiceDocumentAction`) sets status to `"archived"` and records `archived_at`.
- **Restore** (`restoreInvoiceVersionAction`) repoints to an earlier version and moves status back to `"review"`.
- **Compare** (`compareInvoiceVersionsAction`) is read-only — no status change.

## `ready_at`

Set the first time [Readiness](invoice-health.md) reaches `"ready"` (`markInvoiceReadyAction` → `mockInvoiceBuilderRepository.markReady`) — idempotent, never cleared or overwritten once set, even if a later edit regresses readiness.

## 10 named Timeline events (Step 12)

`invoice_created`/`invoice_updated`/`invoice_issued`/`invoice_sent`/`invoice_viewed`/`invoice_partially_paid`/`invoice_paid`/`invoice_overdue`/`invoice_voided`/`invoice_archived`/`invoice_restored` **already exist** — real, wired events from an earlier, foundational Finance phase. Adding a second set for this checkpoint's own Document layer would be a fabricated duplicate, not a reused fact.

The 10 genuinely new events, deliberately disambiguated with an `invoice_document_*` prefix (or otherwise distinct names) so they never collide with the 11 real events above:

| Event | Fires when |
|---|---|
| `invoice_document_version_created` | Every `createInvoiceVersionAction` call |
| `invoice_document_published` | `publishInvoiceVersionAction` |
| `invoice_document_archived` | `archiveInvoiceDocumentAction` |
| `invoice_document_restored` | `restoreInvoiceVersionAction` |
| `invoice_document_compared` | `compareInvoiceVersionsAction` |
| `invoice_document_ready` | `markInvoiceReadyAction`, only the first time `ready_at` is set |
| `invoice_linked_to_proposal` | The first version, if a Proposal is resolvable for the event |
| `invoice_linked_to_contract` | The first version, if `Invoice.contract_id` is set |
| `invoice_installments_scheduled` | Any version whose snapshot has a non-empty payment schedule |
| `invoice_credit_applied` | Any version whose snapshot's adjustments include a `credit`/`service_credit`/`invoice_credit` entry |

## 8 named diff categories (Step 9)

`amounts`, `line_items`, `terms`, `installments`, `credits`, `discounts`, `notes`, `policies` — `INVOICE_DIFF_CATEGORIES`. `compareInvoiceVersions(versionA, versionB)` diffs:

- **`amounts`** — 5 named pricing fields (Grand Total, Subtotal, Deposit Due, Remaining Balance, Outstanding Balance)
- **`line_items`** — id-set + amount changes, excluding `discount`-kind items (those are their own category)
- **`discounts`** — only `discount`-kind line items
- **`credits`** — only `credit`/`service_credit`/`invoice_credit` adjustment kinds, explicitly excluding `manual_adjustment`/`refund_placeholder`/`balance_carry_forward` (confirmed by test — a manual adjustment never surfaces as a "credit" change)
- **`installments`** — id-set changes in the payment schedule
- **`terms`/`notes`/`policies`** — plain text changes

Returns a flat `InvoiceDiffEntry[]` plus a `hasChanges` boolean.
