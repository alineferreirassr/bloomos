# Journey Blocker Engine

`core/clientJourney/journeyBlockerEngine.ts`. Every one of the 17 named blocker types reads an existing field or an already-computed caller-supplied input — never a new calculation duplicating another platform's own logic.

## The 17 named blockers

| Blocker | Trigger | Severity |
|---|---|---|
| `missing_contact_information` | Lead has no email and no phone | high |
| `lead_not_qualified` | Lead status is `new`/`contacted` while the journey is being pushed forward | medium |
| `proposal_incomplete` | The current draft has no services or no pricing | medium |
| `proposal_not_accepted` | A sent proposal exists, isn't rejected, and has no accepted counterpart | medium |
| `contract_missing` | Proposal accepted, no Contract exists | high |
| `contract_unsigned` | Contract exists, isn't declined/cancelled, isn't signed | high |
| `invoice_missing` | Contract signed, no Invoice exists | high |
| `deposit_unpaid` | A deposit is required and unsatisfied | critical |
| `final_balance_unpaid` | The event is completed with an outstanding balance | critical |
| `missing_portal_access` | Journey has reached Welcome or later, no active Client Account | medium |
| `missing_client_documents` | Caller-supplied `requiredDocumentsComplete === false` | medium |
| `missing_approval` | Caller-supplied `pendingApprovalsCount > 0` | medium |
| `missing_event_information` | The focus Event has no date or no guest count | low |
| `missing_operational_plan` | Journey has reached Planning or later, caller-supplied `operationalPlanExists === false` | high |
| `missing_execution_package` | Journey has reached Ready for Service or later, caller-supplied `executionPackageExists === false` | high |
| `client_response_pending` | Caller-supplied `clientResponsePendingCount > 0` (overdue/pending Information Requests) | medium |
| `internal_follow_up_overdue` | Caller-supplied `overdueInternalFollowUpsCount > 0` | medium |

## Exact source record, always

Every blocker carries `sourceModule` and `sourceRecordId` — never a generic "something's wrong" flag. `deposit_unpaid` points at the real Invoice id; `contract_unsigned` at the real Contract id; and so on.

## What this engine deliberately does not detect

`missing_client_documents`, `missing_approval`, `missing_operational_plan`, `missing_execution_package`, `client_response_pending`, and `internal_follow_up_overdue` are all gated behind caller-supplied inputs the module layer either computes from a real source (Information Requests) or currently passes as `null`/`0` because no detector exists yet — disclosed in [`client-journey.md`](client-journey.md)'s own "Known gaps" section rather than fabricated.
