# Journey Health Engine

`core/clientJourney/journeyHealthEngine.ts`.

## Composition — reused, not recalculated

9 of the 10 named components are a documented penalty over the Blocker Engine's own already-detected blockers — each blocker type maps to exactly one component (`BLOCKER_TYPE_TO_COMPONENT`), so nothing is double-counted, and the penalty is a plain severity-weighted subtraction from 100:

| Severity | Penalty |
|---|---|
| critical | 30 |
| high | 20 |
| medium | 10 |
| low | 5 |
| informational | 0 |

Multiple blockers mapped to the same component stack (subtracted, floored at 0) — e.g. both `deposit_unpaid` and `final_balance_unpaid` map to `paymentHealth`.

| Component | Fed by blocker type(s) |
|---|---|
| `leadHealth` | `missing_contact_information`, `lead_not_qualified` |
| `proposalHealth` | `proposal_incomplete`, `proposal_not_accepted` |
| `contractHealth` | `contract_missing`, `contract_unsigned` |
| `invoiceHealth` | `invoice_missing` |
| `paymentHealth` | `deposit_unpaid`, `final_balance_unpaid` |
| `communicationHealth` | `internal_follow_up_overdue` |
| `portalHealth` | `missing_portal_access` |
| `planningHealth` | `missing_client_documents`, `missing_approval`, `missing_event_information`, `missing_operational_plan`, `missing_execution_package` |
| `clientResponseHealth` | `client_response_pending` |

`operationalReadiness` is the one component reused **verbatim** from a caller-supplied score (Operational Planning/Execution Package's own readiness, never recalculated here) — vacuous-100 when `null` (no plan exists yet, which reads as "nothing to be unready about," not a failure).

## Overall score

`overallJourneyHealth` is the **unweighted average of all 10 components** — the same "no single input feeds more than one composition slot" discipline the Operations Center Health Engine established in Checkpoint 31.
