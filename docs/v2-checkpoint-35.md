# v2.0 Checkpoint 35 — Invoice & Billing Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Checkpoint 34 (Contract Management Platform) built the platform that prepares a Contract for signature. This checkpoint does the equivalent for an Invoice: templates, a builder, line items, deterministic billing/installment/credit arithmetic, versioning, comparison, health, readiness, analytics, and a client-facing billing experience — all layered additively on top of the existing real `Invoice`/`Payment` entities without ever duplicating them, and explicitly **not** Stripe, Square, PayPal, ACH, QuickBooks, or Xero.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/invoicePlatform.ts` | `InvoiceTemplate`/`InvoiceLineItem`/`InvoiceAdjustment`/`InvoiceInstallment`/`InvoiceSnapshot`/`InvoiceVersion`/`InvoiceBuilderState`/`InvoiceHealth`/`InvoiceReadinessResult`/`InvoiceAnalyticsSnapshot`/`InvoiceComparisonResult`/`InvoiceSummary`/`InvoiceDetail` — see [`invoice-platform.md`](invoice-platform.md) |
| Mock stores | `lib/data/mock/{invoiceTemplatesStore,invoiceBuilderStore}.ts` | The 2 persisted entities this checkpoint owns |
| Line Item Engine | `core/invoicePlatform/lineItemEngine.ts` | [`invoice-builder.md`](invoice-builder.md) |
| Billing + Credit/Adjustment Engines | `core/invoicePlatform/{billingEngine,creditAdjustmentEngine}.ts` | [`billing-engine.md`](billing-engine.md) |
| Installment Engine | `core/invoicePlatform/installmentEngine.ts` | [`installment-engine.md`](installment-engine.md) |
| Builder + Versioning | `core/invoicePlatform/invoiceBuilderEngine.ts` | [`invoice-builder.md`](invoice-builder.md), [`invoice-versioning.md`](invoice-versioning.md) |
| Comparison Engine | `core/invoicePlatform/invoiceComparisonEngine.ts` | 8-category structural diff |
| Health / Readiness Engines | `core/invoicePlatform/{invoiceHealthEngine,invoiceReadinessEngine}.ts` | [`invoice-health.md`](invoice-health.md) |
| Analytics Engine | `core/invoicePlatform/invoiceAnalyticsEngine.ts` | [`invoice-analytics.md`](invoice-analytics.md) |
| Knowledge Graph / Executive integration | `core/invoicePlatform/{invoiceKnowledgeGraphEngine,invoiceExecutiveIntegration}.ts` | Pure translation, no second graph or decision engine |
| Performance cache | `core/invoicePlatform/invoiceCache.ts` | 30s TTL in front of the two O(N) reads |
| Module layer | `modules/invoicePlatform/invoicePlatformActions.ts` | Every server action, session-gated |
| Dashboard + Detail | `modules/invoicePlatform/components/{InvoiceDashboardView,InvoiceDetailView}.tsx`, routed at `/invoices`, `/invoices/[id]` | [`invoice-dashboard.md`](invoice-dashboard.md), [`invoice-detail.md`](invoice-detail.md) |
| Client Portal | `modules/clientPortal/getClientPortalInvoiceDocument.ts`, `modules/clientPortal/components/ClientPortalInvoiceDocumentSection.tsx` | [`client-billing.md`](client-billing.md) |

## Reuse, honored exactly as the stop condition requires

- **The Invoice entity itself** — `Invoice`/`Payment` (real, Supabase-backed) are untouched as types and as tables; every real action (`issueInvoice`, `applyPaymentToInvoice`, etc.) keeps working exactly as before. `paidToDate_minor`/`outstandingBalance_minor` always reuse the real `Invoice.paid_minor`, never recomputed.
- **CRM/Client/Event/Contract** — read straight from the existing `Invoice.client_id`/`event_id`/`contract_id`, both `client_id` and `contract_id` being direct FKs (unlike Contract Platform's own indirect Proposal lookup, which Invoice still needs since no direct Proposal FK exists).
- **Proposal** — resolved indirectly via the shared `event_id` (`getLatestProposalForEvent`), the same pattern Contract Platform established.
- **Knowledge Graph** — 4 of 8 named relationship types are live edges (`invoice_related_client`, `invoice_related_contract`, `invoice_related_proposal`, `invoice_related_document`); `invoice_contains_line_item`/`invoice_version_of`/`invoice_supersedes`/`invoice_related_journey` are disclosed reserved vocabulary.
- **Executive Decisions** — `invoiceRecommendationsForExecutiveDecisions()` is one more `recommendationSources` entry — 7 named rules (Invoice Ready, Invoice Missing Contract, Invoice Missing Proposal, Outstanding Balance, Invoice Needs Review, Large Discount, High Value Invoice).
- **Timeline** — `invoice_created`/`invoice_updated`/`invoice_issued`/`invoice_sent`/`invoice_viewed`/`invoice_partially_paid`/`invoice_paid`/`invoice_overdue`/`invoice_voided`/`invoice_archived`/`invoice_restored` (already real, wired events from an earlier Finance phase) are explicitly not duplicated; 10 new, disambiguated `invoice_document_*`-prefixed events cover this checkpoint's own Document lifecycle.
- **Permissions** — 8 named capabilities (`invoice_templates.view`/`.manage`, `invoice_builder.view`/`.manage`, `invoice_versions.view`/`.manage`, `invoice_adjustments.manage`, `invoice_billing.manage`), the same narrower-manage/broader-view split Proposal/Contract Platform established. A new `/invoices` route entry was added to `routeAccess.ts`, gated by `invoice_builder.view`, since (unlike Contract's own `/contracts`) no such route existed before this checkpoint.
- **Comments/Notes/Search** — the existing `"invoice"` `EntityType` is reused directly.
- **No AI, no PDF generation, no real payment processing, no automatic charging, no invoice emails anywhere.**

## A correctness bug found and fixed during this checkpoint

`invoiceHealthEngine.ts`'s `required_fields` category was initially implemented as a hardcoded always-100 pass whenever a snapshot existed — a fabricated, non-functional check with no real validation behind it. Caught during self-review before it was tested or shipped, and fixed by threading the real `Invoice.issue_date`/`due_date` into the engine's own input (`invoiceIssueDate`/`invoiceDueDate`) and checking them genuinely — the same "no fabricated data" discipline this session has held to throughout. Confirmed correct by test (`invoiceHealthEngine.test.ts` — "flags required_fields when the real invoice's issue/due dates are missing").

## Known limitations (disclosed, not hidden)

1. **The in-app Builder is a compact form, not a drag-and-drop canvas.** A first version populates one section with freeform line item rows and defaults the payment schedule to a single `final_payment` installment equal to the computed total. Every field it submits flows through the same tested `CreateInvoiceVersionInput` pipeline a richer editor would use.
2. **`/invoices`/`/invoices/[id]` are genuinely new routes, distinct from the real Finance module's own `/finance/invoices`.** This is a deliberate design decision, not an oversight — the spec's own Step 19/20 explicitly instruct "Create: /invoices" / "Create: /invoices/[id]," and no such route existed before this checkpoint, unlike Contract Platform's `/contracts`. The two routes compose the real Finance Invoice data but never duplicate it.
3. **No live authenticated browser verification against the real Supabase-backed session** — `NEXT_PUBLIC_DATA_MODE` was temporarily flipped to `mock` for local verification only, then flipped back to `supabase` and the dev server stopped once verification finished. No shared or remote infrastructure was touched. Both desktop and mobile viewports were verified live for the Dashboard; the Detail page's full interactive create-version flow (template select → line item entry → submit → real computed pricing/health/readiness) was verified live on desktop, with mobile confirmed via static render.

## Quality gates

- `tsc --noEmit -p .`: clean.
- `eslint .`: clean (0 errors; 17 pre-existing warnings across other, untouched modules — React Hook Form `watch()` compiler-skip notices and one unused-var warning, none introduced by this checkpoint).
- `vitest run` (full repository): **876 test files, 7901/7902 tests passing.** The 1 failure is pre-existing and unrelated to this checkpoint: `src/lib/data/finance/mockRepository.reports.test.ts` ("nets a reversed entry to zero movement" — the same disclosed, pre-existing failure the two prior checkpoints' own final reports flagged, confirmed still failing identically in isolation). That file was never touched by this checkpoint. 16 new/extended test files / 139 tests for this checkpoint alone (10 core engine files, the module-layer integration suite, the Dashboard/Detail component suites, and the Client Portal invoice suite), plus 1 existing Client Portal component test file extended with new mocks for the additive Document section.
- `next build`: succeeds — `/invoices` and `/invoices/[id]` both compile as new dynamic routes.
- Browser verification: desktop (1440×900) and mobile (375×812) both confirmed live against `NEXT_PUBLIC_DATA_MODE=mock` for the Dashboard; the Detail page's create-version flow verified live on desktop, static-rendered on mobile.

## Success criteria, answered

- **Managing invoices, deposits, installments, balances, credits, billing history, and payment preparation** — [`billing-engine.md`](billing-engine.md), [`installment-engine.md`](installment-engine.md).
- **10 named templates** — [`invoice-templates.md`](invoice-templates.md).
- **Deterministic billing arithmetic, no AI** — [`billing-engine.md`](billing-engine.md).
- **Measuring document health and readiness** — 7 + 8 named states culminating in a real Can Publish / Cannot Publish gate — [`invoice-health.md`](invoice-health.md).
- **Extending the Client Portal** — 2 named read-only actions, no payments — [`client-billing.md`](client-billing.md).
- **Feeding Executive Decisions** — 7 named recommendation rules, translated through the existing seam, never a second decision engine.

No parallel Finance, CRM, Timeline, Client Journey, Documents, Communication, Business Health, or Knowledge Graph system was created — and no Stripe, Square, PayPal, Apple Pay, Google Pay, ACH, QuickBooks, Xero, real payment processing, automatic charging, invoice emails, Gmail/Outlook/Google Calendar, PDF generation, receipts, refund processing, bank integration, or payment gateway API was ever connected.
