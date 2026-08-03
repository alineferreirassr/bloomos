# Invoice & Billing Platform

`types/invoicePlatform.ts`, `core/invoicePlatform/`, `modules/invoicePlatform/invoicePlatformActions.ts`.

## The core discipline: reuse the real `Invoice`, never replace it

`Invoice` (`types/invoice.ts`) and `Payment` (`types/payment.ts`) are already real, Supabase-backed entities with their own migrations, repositories, and UI — the whole commercial lifecycle (`status`, `issueInvoice`/`sendInvoice`/`markInvoiceViewed`/`voidInvoice`/`archiveInvoice`, and `applyPaymentToInvoice` deriving `paid_minor`/`balance_minor` on every successful `Payment`) stays exactly as it was. Nothing in this checkpoint duplicates it, and nothing in this checkpoint ever marks money as received — that stays the real `Payment` ledger's own job.

Every new type this checkpoint introduces attaches to an existing `Invoice.id` as an **additive layer**: the human-curated document (template, line items, adjustments, a payment-schedule *plan*, terms, policies) that gets built, versioned, compared, and prepared — never the real commercial record. Unlike the Contract Platform (Checkpoint 34), which needed an indirect `event_id`-based lookup for its Proposal link, `Invoice` already carries both `event_id` and `contract_id` as direct nullable fields — only the Proposal link still needs the indirect, shared-`event_id` resolution, since no direct Proposal FK exists.

## Core principle, honored literally

This is **not** Stripe, Square, PayPal, ACH, QuickBooks, or Xero. It prepares invoices only. Real payment processing, automatic charging, invoice emails, PDF generation, and receipts are all deferred to a future External Integrations phase — see [`v2-checkpoint-35.md`](v2-checkpoint-35.md).

## Storage split — only 2 new persisted entities

Mirroring the "persist only what cannot be re-derived" discipline every prior checkpoint has followed:

| Entity | Store | Why persisted |
|---|---|---|
| `InvoiceTemplate` | `invoiceTemplatesStore.ts` | A reusable library — 10 system templates ship pre-seeded, workspaces may add custom ones. |
| `InvoiceBuilderState` | `invoiceBuilderStore.ts` | The mutable shell around append-only `InvoiceVersion` history — the one genuinely new per-invoice record. |

Everything else — `InvoiceSnapshot`, `InvoicePricingBreakdown`, `InvoiceHealth`, `InvoiceReadinessResult`, `InvoiceAnalyticsSnapshot`, `InvoiceComparisonResult`, `InvoiceSummary`, `InvoiceDetail` — is computed fresh on every read by a pure engine, never stored redundantly.

## `InvoiceLineItem` vs `InvoiceAdjustment`

The spec's own Step 4 (Line Item Engine) lists Discounts/Credits/Adjustments alongside Services/Packages/Products, while Step 1 also names a separate `InvoiceAdjustment` type and Step 7 a whole separate Credit & Adjustment Engine. Resolved by narrowing `InvoiceLineItemKind` to 9 kinds (`service`/`package`/`product`/`fee`/`travel`/`rental`/`labor`/`discount`/`tax_placeholder`) and giving `InvoiceAdjustment` its own dedicated array on the snapshot with 6 named sub-kinds (`credit`/`manual_adjustment`/`refund_placeholder`/`service_credit`/`invoice_credit`/`balance_carry_forward`), each processed by its own [Credit & Adjustment Engine](billing-engine.md).

## The `InvoiceBuilderState`/`InvoiceVersion`/`InvoiceSnapshot` shape

Mirrors `ContractBuilderState`/`ContractVersion`/`ContractSnapshot` (Checkpoint 34) exactly: a mutable shell (`InvoiceBuilderState`) holds `current_version_id` and an append-only `versions: InvoiceVersion[]` array; each `InvoiceVersion` freezes an `InvoiceSnapshot` by value (header, sections, line items, adjustments, payment schedule, computed pricing, terms, policies, footer) — never a live reference. See [`invoice-versioning.md`](invoice-versioning.md).

## Module map

| Module | Responsibility |
|---|---|
| `core/invoicePlatform/lineItemEngine.ts` | Step 4 — line item construction + grouping |
| `core/invoicePlatform/creditAdjustmentEngine.ts` | Step 7 — [`billing-engine.md`](billing-engine.md) |
| `core/invoicePlatform/installmentEngine.ts` | Step 6 — [`installment-engine.md`](installment-engine.md) |
| `core/invoicePlatform/billingEngine.ts` | Step 5 — [`billing-engine.md`](billing-engine.md) |
| `core/invoicePlatform/invoiceBuilderEngine.ts` | Steps 3, 8 — snapshot assembly + versioning — [`invoice-builder.md`](invoice-builder.md), [`invoice-versioning.md`](invoice-versioning.md) |
| `core/invoicePlatform/invoiceComparisonEngine.ts` | Step 9 — 8-category structural diff |
| `core/invoicePlatform/invoiceHealthEngine.ts` | Step 10 — [`invoice-health.md`](invoice-health.md) |
| `core/invoicePlatform/invoiceReadinessEngine.ts` | Step 11 — Can Publish / Cannot Publish |
| `core/invoicePlatform/invoiceAnalyticsEngine.ts` | Step 13 — [`invoice-analytics.md`](invoice-analytics.md) |
| `core/invoicePlatform/invoiceKnowledgeGraphEngine.ts` | Step 16 — Knowledge Graph edge builders |
| `core/invoicePlatform/invoiceExecutiveIntegration.ts` | Step 17 — translation to `OperationalRecommendation[]` |
| `core/invoicePlatform/invoiceCache.ts` | Performance — 30s TTL cache |
| `modules/invoicePlatform/invoicePlatformActions.ts` | The module layer — every server action, session-gated |
| `modules/clientPortal/getClientPortalInvoiceDocument.ts` | Step 14 — [`client-billing.md`](client-billing.md) |

## Reuse, honored exactly as the stop condition requires

- **The Invoice entity itself** — `Invoice`/`Payment` are untouched as types and as tables; every real action (`issueInvoice`, `applyPaymentToInvoice`, etc.) keeps working exactly as before. `paidToDate_minor`/`outstandingBalance_minor` in `InvoicePricingBreakdown` reuse the real `Invoice.paid_minor`, always caller-supplied, never recomputed by this checkpoint's own engines.
- **CRM/Client/Event/Contract** — read straight from the existing `Invoice.client_id`/`event_id`/`contract_id`; only `contract_id` and `client_id` are direct FKs, resolved without indirection.
- **Proposal** — no direct FK exists between `Invoice` and the Proposal Platform (Checkpoint 33), so the link is resolved indirectly via the shared `event_id` (`getLatestProposalForEvent`), the same pattern Contract Platform established.
- **Knowledge Graph** — 4 of 8 named relationship types are live edges (`invoice_related_client`, `invoice_related_contract`, `invoice_related_proposal`, `invoice_related_document`); `invoice_contains_line_item`/`invoice_version_of`/`invoice_supersedes`/`invoice_related_journey` are disclosed reserved vocabulary, since `InvoiceLineItem` has no library node identity and `Invoice` has no second-row version chain.
- **Executive Decisions** — `invoiceRecommendationsForExecutiveDecisions()` is one more `recommendationSources` entry, the exact seam Checkpoint 33/34 established — 7 named recommendation rules.
- **Timeline** — reused directly via `recordTimelineActivity`; see [`invoice-versioning.md`](invoice-versioning.md)'s Timeline section for the exact new/reused event split.
- **Comments/Notes/Search** — the existing `"invoice"` `EntityType` is reused directly; no new EntityType was needed since `Invoice` is already a real persisted row.
- **No AI, no PDF, no payment processing, no automatic charging anywhere.** The Billing/Installment Engines are deterministic arithmetic over caller-supplied line items and schedule kinds, never invented figures.

## Known limitations

See [`v2-checkpoint-35.md`](v2-checkpoint-35.md).
