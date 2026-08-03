# Journey Requirements Engine

`core/clientJourney/journeyRequirementsEngine.ts`. Requirement sets are defined for exactly the 7 stages the spec itself names in its own worked examples — every check reads an existing field or an already-computed input, never a new calculation.

## The 7 gated stages

| Stage | Requirements |
|---|---|
| Qualified | Lead information complete, Service interest recorded, Budget range recorded where available, Contact permission confirmed where applicable |
| Proposal Sent | Proposal exists, Proposal has client, Proposal has services, Proposal has pricing, Proposal is in sendable state |
| Contract Sent | Accepted proposal exists, Contract exists, Required clauses exist, Client information is complete |
| Contract Signed | Signature status completed, Required signers completed, Audit trail exists |
| Invoice Sent | Invoice exists, Client exists, Invoice total is valid, Due date exists |
| Welcome | Proposal accepted, Contract signed where required, Deposit paid where required, Client portal account ready |
| Ready for Service | Required documents complete, Required payments complete, Event or project ready, Operational requirements complete |

Every other stage returns an empty requirement list — it is evidenced directly by the State Resolver instead, so this engine never duplicates that logic for stages the spec didn't ask it to gate.

## Disclosed proxies

- **Proposal sendable state** — the same `reviewed_at` proxy the State Resolver uses.
- **Required clauses exist** — no dedicated clause list exists on `Contract` in this codebase; a non-empty `description` is treated as clauses present.
- **Required signers completed** — `Contract` tracks one aggregate `signature_status`, not a per-signer list, so this check is the same signal as "Signature status completed."
- **Client portal account ready** — always reports `met: true`; portal readiness is checked at the Portal Activated stage itself, not treated as a gate for entering Welcome.
- **Operational requirements complete** — reuses a caller-supplied `operationalReadinessScore` (never recalculated here) against an 80-point threshold; `null` (no plan evaluated yet) reads as satisfied rather than a fabricated failure.
- **Required documents complete** — reuses a caller-supplied `requiredDocumentsComplete` flag; `null` (not evaluated by the caller) reads as satisfied.
