# Worker Ranking Engine

v2.0 Checkpoint 26.1, Step 8. `core/capability/workerRankingEngine.ts`'s `rankWorkers(evaluations)` — a single deterministic, multi-key sort. No randomness; every tie is resolvable, down to a final Worker ID comparison.

## The sort key, in order

1. **Eligibility state priority** — `eligible` (0) < `conditionally_eligible` (1) < `unknown` (2) < `ineligible` (3). An Ineligible worker never ranks above an Eligible one, per the spec's own rule. `unknown` sits between Conditionally Eligible and Ineligible — a worker whose eligibility couldn't be determined is never presented as confidently ready, but a genuine "can't tell" is still ranked above a confirmed "no."
2. **Overall Capability Score** — descending.
3. **Blocking Issue Count** — ascending (fewer real problems ranks higher, relevant mostly among Ineligible workers).
4. **Availability Score** — descending.
5. **Certification Score** — descending.
6. **Skills Match Score** — descending.
7. **Equipment Score** — descending.
8. **Vehicle Score** — descending.
9. **Location Score** — descending.
10. **Worker ID** — ascending, the final deterministic tie-breaker. Two workers with identical everything else always resolve to the same order on every call.

## Rank assignment

Only `eligible` and `conditionally_eligible` workers get a numeric `rank` (1-based, assigned in the sorted order above). `ineligible` and `unknown` workers keep `rank: null` — they're still returned (for the Requirement Detail view's "Ineligible" section) but are never part of the ranked pool, matching the spec's "Ineligible workers may appear in a separate section but must never be ranked above eligible workers."

## Determinism, verified

`workerRankingEngine.test.ts` includes an explicit regression test calling `rankWorkers` twice with identical input and asserting identical output order — the same discipline every other deterministic engine in this checkpoint series carries.
