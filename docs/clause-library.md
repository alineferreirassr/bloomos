# Clause Library

`lib/data/mock/contractClausesStore.ts`, `types/contractPlatform.ts` (`ContractClause`).

## 15 named clauses (Step 4)

`payment_terms`, `cancellation_policy`, `reschedule_policy`, `refund_policy`, `force_majeure`, `privacy`, `confidentiality`, `liability`, `intellectual_property`, `photo_release`, `video_release`, `travel_policy`, `damage_policy`, `late_payment`, `custom_clause` — `CONTRACT_CLAUSE_KEYS` in `types/contractPlatform.ts`. 14 system clauses ship pre-seeded (every key except `custom_clause`, which exists so a workspace's own custom clauses share the closed key union without inventing new keys).

Each clause's `bodyText` may itself contain `{{variable}}` placeholders — the [Variable Engine](variable-engine.md) substitutes into clause text exactly like any other block, e.g. the seeded `payment_terms` clause references `{{client_name}}`, `{{proposal_total}}`, `{{deposit}}`, `{{remaining_balance}}`, and `{{event_date}}`.

`isOptional` is the spec's own named "Optional Clauses" concept — a clause a template marks optional can be included or excluded per contract without being removed from the library.

## `id` vs. `key`

A clause has both a real `id` (the row) and a semantic `key` (its category, from `CONTRACT_CLAUSE_KEYS`). `ContractSnapshot.clauseIds` always holds real `id`s, since a workspace can have several custom clauses that all share `key: "custom_clause"`. Wherever a category-level check is needed — the Health Engine's `presentClauseKeys`, a template's `defaultClauseKeys` — the caller resolves each id to its `.key` first via `getCoreContractClausesService().getClausesByIds()`, never comparing raw ids to semantic keys.

## Repository

`mockContractClausesRepository` — `listClauses(workspaceId, includeArchived?)`, `getClauseById(id)`, `getClausesByIds(ids)`, `createCustomClause(workspaceId, actor, input)`, `archiveClause(id)`. Accessed via `getCoreContractClausesService()`.
