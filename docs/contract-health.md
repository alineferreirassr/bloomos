# Contract Health & Readiness

`core/contractPlatform/contractHealthEngine.ts`, `core/contractPlatform/contractReadinessEngine.ts`.

## 7 named health categories (Step 8)

`completeness`, `missing_variables`, `missing_clauses`, `missing_sections`, `proposal_link`, `journey_link`, `client_link` — `CONTRACT_HEALTH_CATEGORIES` in `types/contractPlatform.ts`. Mirrors Business Health's own `categoryFrom*`/"average of non-null scores" pattern (`core/knowledge/businessHealthEngine.ts`, Checkpoint 25) rather than importing it directly, the same parallel-implementation discipline `computeProposalHealth` (Checkpoint 33) established — `HealthCategory` there is a closed 11-item union, not extensible with these 7 Contract-specific categories.

| Category | What it checks |
|---|---|
| `completeness` | Header title, ≥1 section, ≥1 clause, terms, policies, a linked client — 6 checks |
| `missing_variables` | Every `{{key}}` referenced across sections/clauses/terms/policies has a real, non-empty resolved value |
| `missing_clauses` | Every clause `key` the current template marks required is present (resolved from `clauseIds` via `getClausesByIds`, never raw ids) |
| `missing_sections` | Every section `key` the current template marks required is present |
| `proposal_link` | Binary — is a real Proposal resolvable for this contract's event |
| `journey_link` | Binary — is a Client Journey context available for this contract's client |
| `client_link` | Binary — is there a linked client record |

`proposal_link`/`journey_link`/`client_link` are simple binary presence checks — completely distinct from the separate Step 8 task of wiring Proposal Health's own `journey_readiness` metric to a real Client Journey score, which was a bolt-on fix to the *Proposal* Platform's own `proposalPlatformActions.ts`, not part of this engine.

## 8 named readiness states (Step 9)

`ready`, `needs_review`, `missing_variables`, `missing_client`, `missing_proposal`, `missing_sections`, `missing_clauses`, `needs_approval` — `CONTRACT_READINESS_STATES`. A waterfall over already-computed facts, "first unmet requirement wins," the same shape `evaluateProposalReadiness` established:

1. `missing_client` — no linked client
2. `missing_sections` — no document built yet
3. `missing_proposal` — no Proposal resolvable for this event
4. `missing_sections` — a required section is absent
5. `missing_clauses` — a required clause is absent
6. `missing_variables` — the Health Engine's own `missing_variables` category is below 100
7. `needs_approval` — the document's own `status === "review"`
8. `needs_review` — overall health below 70
9. otherwise `ready`

`canPublish` is the spec's own named Can Publish / Cannot Publish — a derived boolean (`state === "ready"`), the same `ProposalReadinessResult.canSend` precedent.

## `needs_approval` is a disclosed proxy

No separate "approval" concept exists on the real `Contract` record for this checkpoint to reuse, so `needs_approval` reuses the Builder's own `documentStatus === "review"` as its trigger — a human explicitly flagged this document for review — disclosed as a proxy, not fabricated.
