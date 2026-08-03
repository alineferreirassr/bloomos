# Stripe Integration — v2 Checkpoint 43 delta

Checkpoint 23 already built the real `StripeProvider`, connection flow, and webhook route (`docs/v2-checkpoint-23-*` once written — that checkpoint's own documentation and final report remain a separate, still-pending task, tracked independently of Checkpoint 43). This file covers only what Checkpoint 43 itself changed for Stripe.

## What changed

Checkpoint 43's own repository audit (Step 0) found one real gap in Checkpoint 23's payment trigger wiring: `types/automation.ts`'s `AUTOMATION_TRIGGER_TYPES` already listed `payment.received`, `payment.failed`, `deposit.paid`, `balance.paid`, and `refund.issued`, and `webhookProcessing.ts` already dispatched them — but only `invoicePaidTrigger` had a matching Workflow Builder node in `modules/workflow/nodes/triggerNodes.ts`. A workspace could not build a workflow that started from "a deposit was paid" or "a refund was issued," even though the underlying automation trigger already fired correctly.

Checkpoint 43 closes that one gap: `depositPaidTrigger`, `balancePaidTrigger`, `paymentFailedTrigger`, and `refundIssuedTrigger` were added as `makeTriggerNode(...)` exports and registered in the exported `triggerNodes` array. No change to `StripeProvider`, the connection flow, the webhook route, or `webhookProcessing.ts` itself — those are Checkpoint 23's own surface, verified working and left untouched per this checkpoint's "extend, don't duplicate or rebuild" discipline.

## Scope note

Full Stripe integration documentation (provider adapter, connection flow, Checkout/Payment Links/Invoices/Refunds, webhook reconciliation) belongs to Checkpoint 23's own final report, which remains paused pending live sandbox credential verification (see the project's own task tracker). Checkpoint 43 does not complete that pending item — it only closes the one Workflow trigger-node gap described above.
