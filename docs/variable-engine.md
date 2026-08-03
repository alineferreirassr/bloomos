# Variable Engine

`core/contractPlatform/variableEngine.ts`.

## The first real resolver for `mergeFields.ts`

`modules/contracts/mergeFields.ts`'s pre-existing `MERGE_FIELDS` registry (from the Contracts Foundation phase) disclosed its own scope in its own doc comment: "nothing parses a template, substitutes a value, or renders anything — that's explicitly out of scope for this phase." This checkpoint fills exactly that gap. `mergeFields.ts` was extended with 6 new keys the spec's own Step 5 names that weren't already present (`proposal_total`, `deposit`, `company_name`, `address`, `phone`, `email`) rather than building a second, competing registry.

## 9 named placeholders (Step 5)

| Key | Source |
|---|---|
| `client_name` | The linked Client's full name (`getFullName`) |
| `event_date` | The linked Event's `event_date`, `Intl`-formatted |
| `proposal_total` | The linked Proposal's `grandTotal_minor`, `Intl.NumberFormat` currency-formatted |
| `deposit` | The linked Proposal's `depositDue_minor` |
| `remaining_balance` | The linked Proposal's `remainingBalance_minor` |
| `company_name` | The workspace's own display name |
| `address` | The linked Client's `address` |
| `phone` | The linked Client's `phone` |
| `email` | The linked Client's `email` |

Deterministic — no AI, no invented values. A variable with no real source value resolves to an empty string, disclosed as a real (if empty) resolution rather than a fabricated one.

## `ContractVariableClient` — a deliberately narrow fixture

`resolveContractVariables` reads only 5 fields off a `Client` (`first_name`, `last_name`, `address`, `phone`, `email`), so its input type is `Pick<Client, "first_name" | "last_name" | "address" | "phone" | "email">` rather than the full ~40-field `Client` record. A full `Client` object satisfies this type structurally, so real call sites pass it through unchanged; test fixtures never need to assemble a full `Client` just to resolve 5 fields.

## Substitution and extraction

- `substituteVariables(text, variables)` — replaces every `{{key}}` occurrence with its resolved value; an unresolved key (no matching variable) is left untouched rather than silently dropped, so a missing variable stays visible instead of hidden.
- `extractVariableKeys(text)` — every `{{key}}` a piece of text references, deduplicated. Powers the [Health Engine](contract-health.md)'s "Missing Variables" category (finds every placeholder referenced across sections/clauses/terms/policies with no real resolved value) and the Client Portal's document view (substitutes into every section block, clause, term, and policy before it ever reaches a client).
