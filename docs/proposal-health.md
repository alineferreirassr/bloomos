# Proposal Health Engine

`core/proposalPlatform/proposalHealthEngine.ts`.

## 7 named categories, mirroring Business Health's own pattern

`completeness`, `pricing_health`, `content_health`, `required_sections`, `required_pricing`, `template_health`, `journey_readiness` — the exact 7 Step 10 names. `computeProposalHealth` mirrors `computeBusinessHealth`'s own `categoryFrom*`/"average of non-null scores" pattern (`core/knowledge/businessHealthEngine.ts`, Checkpoint 25) — a parallel implementation rather than a shared function, since `HealthCategory` there is Business Health's own closed 11-item union, not extensible with these 7 Proposal-specific categories.

| Category | What it checks |
|---|---|
| Completeness | header title, hero headline, ≥1 section, ≥1 pricing line, terms, policies, a linked client — 7 checks |
| Pricing Health | pricing lines exist, grand total > 0, a deposit is configured |
| Content Health | ratio of sections carrying at least one block with real content |
| Required Sections | ratio of the current template's own required sections actually present |
| Required Pricing | binary — real pricing lines and a non-zero grand total |
| Template Health | 100 if a real template was used, 60 if built freehand |
| Journey Readiness | passes through an already-computed Client Journey health score |

Every category scores `null` (never fabricated) with a `notApplicableReason` when there's genuinely nothing to evaluate yet — e.g. every category before any version exists, or Required Sections when no template was selected.

## `journey_readiness` — composed, never recalculated

The one category this engine doesn't compute itself: it accepts an already-computed Client Journey health score as input (`journeyReadinessScore: number | null`), the same "compose, don't duplicate" discipline every cross-checkpoint integration in this codebase follows. This checkpoint's own module layer currently passes `null` (no live call site wires Journey health into a Proposal evaluation yet) — disclosed, not fabricated.

## Overall score

The average of every category whose score isn't `null` — `0` only when every category is inapplicable (i.e. no document has ever been built).
