# Invoice Health & Readiness

`core/invoicePlatform/invoiceHealthEngine.ts`, `core/invoicePlatform/invoiceReadinessEngine.ts`.

## 7 named health categories (Step 10)

`completeness`, `pricing_health`, `schedule_health`, `required_fields`, `client_link`, `proposal_link`, `contract_link` — `INVOICE_HEALTH_CATEGORIES` in `types/invoicePlatform.ts`. Mirrors Business Health's own `categoryFrom*`/"average of non-null scores" pattern (`core/knowledge/businessHealthEngine.ts`, Checkpoint 25) rather than importing it directly — the same parallel-implementation discipline `computeContractHealth` (Checkpoint 34) established, since `HealthCategory` there is a closed 11-item union, not extensible with these 7 Invoice-specific categories.

| Category | What it checks |
|---|---|
| `completeness` | Header title, ≥1 line item, terms, policies, footer text — 5 checks |
| `pricing_health` | Grand total > 0, discounts don't exceed the line items subtotal, currency is a valid 3-letter code — 3 checks |
| `schedule_health` | Not applicable when no schedule exists; otherwise `scheduleMatchesTotal` (100 if matched, 50 if not — see [`installment-engine.md`](installment-engine.md)) |
| `required_fields` | The real `Invoice.issue_date`/`due_date` are both set — checked here since they live on the real entity, never the document snapshot |
| `client_link` | Binary — is there a linked client record |
| `proposal_link` | Binary — is a real Proposal resolvable for this invoice's event |
| `contract_link` | Binary — is a real Contract resolvable via `Invoice.contract_id` |

`required_fields` was caught and fixed during authoring — an initial draft hardcoded a fabricated always-100 pass whenever a snapshot existed, with no real check behind it. Fixed before it shipped by threading the real `invoiceIssueDate`/`invoiceDueDate` into the engine's input and checking them genuinely.

Overall score is the average of every non-`null` category score.

## 8 named readiness states (Step 11)

`ready`, `needs_review`, `missing_client`, `missing_proposal`, `missing_contract`, `missing_pricing`, `missing_schedule`, `missing_terms` — `INVOICE_READINESS_STATES`. A waterfall over already-computed facts, "first unmet requirement wins," the same shape `evaluateContractReadiness` established:

1. `missing_client` — no linked client
2. `missing_pricing` — no document built yet, or the grand total is zero
3. `missing_schedule` — no payment schedule set
4. `missing_terms` — terms are empty
5. `missing_proposal` — no Proposal resolvable for this event
6. `missing_contract` — no Contract linked
7. `needs_review` — overall health below 70
8. otherwise `ready`

`canPublish` is the spec's own named Can Publish / Cannot Publish — a derived boolean (`state === "ready"`).

## A disclosed, stricter-than-the-real-entity bar

The real `Invoice`'s own doc comment explicitly states a standalone transaction with no Event, Contract, or Proposal on record is "a legitimate Invoice." Despite that, `evaluateInvoiceReadiness` unconditionally requires both a linked Proposal and a linked Contract to reach `"ready"` — a deliberate, disclosed design decision mirroring Contract Platform's own unconditional Proposal requirement. This is this checkpoint's own Document layer's "ready to publish" signal being intentionally stricter than what the real entity itself requires — not a requirement to use the Invoice Platform at all. A standalone invoice with no Proposal or Contract remains fully usable through the real `Invoice` entity's own existing lifecycle; it simply never reaches this checkpoint's own `"ready"` state.
