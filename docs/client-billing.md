# Client Billing Experience

`modules/clientPortal/getClientPortalInvoiceDocument.ts`, `modules/clientPortal/components/ClientPortalInvoiceDocumentSection.tsx`.

## No payments here, by design

This is a read-only view of the prepared document — line items, the payment *schedule* plan, credits/adjustments, deposit due, remaining balance, version history. The real Client Portal Invoice page (`ClientPortalInvoiceDetailView.tsx`, from an earlier Stripe integration phase) already has a real Stripe-backed payment flow, a real "Download Invoice (PDF)" button, and a real Payment History list — none of that is touched or duplicated here. Since a real PDF download already exists, no placeholder PDF button was added — the real feature already covers that spec line more completely than a placeholder would.

## The two-session-mechanism split

Every action resolves a `ClientAccount` via `getCurrentClientAccountContext()` — never the team-member session gate `invoicePlatformActions.ts` uses. The same split `getClientPortalContract.ts` (Checkpoint 34) established.

## Visible only once published

A document is only visible to the client once its own document status reaches `"published"` — the same "never show a client a work-in-progress" rule `getClientPortalContractDocumentAction`'s own gate enforces. Once a new version moves the document back to `"review"`, client access is revoked until it's republished — confirmed by test.

## Named actions (Step 14)

| Action | What it does |
|---|---|
| `getClientPortalInvoiceDocumentAction(invoiceId)` | The client-safe document: header, line items, adjustments, payment schedule, computed pricing (deposit due, remaining balance, grand total, outstanding balance), terms, policies, footer, current/available version numbers |
| `compareClientPortalInvoiceVersionsAction(invoiceId, a, b)` | Read-only version comparison, reusing `compareInvoiceVersions` directly |

`ClientPortalInvoiceDocumentSection.tsx` renders all of the above additively on the existing `ClientPortalInvoiceDetailView.tsx`, below the real commercial-summary card, payment flow, and Payment History that view already had.

## What stays entirely server-side

Internal reasoning (Health category scores, Readiness reasons, document status transitions beyond the current one) stays entirely server-side, the same discipline `getClientPortalContractDocumentAction`'s own doc comment establishes.
