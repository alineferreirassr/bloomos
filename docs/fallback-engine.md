# Fallback Engine

`src/core/allocation/fallbackEngine.ts` — v2.0 Checkpoint 27.1, Step 9.

## What it answers

For a single-quantity requirement line, who's primary and who backs them up — and if the primary becomes unavailable, who's next?

## `buildFallbackChain`

```ts
buildFallbackChain(requirementLineIndex, primary, alternatives, maxBackups = 2): FallbackChain
```

Pure and deterministic — the ordering of `alternatives` (who's backup 1 vs. backup 2) is decided entirely by the caller (`AllocationEngine`'s own capability-score ranking), never by this file. Only the first `maxBackups` alternatives become a real tiered backup; the rest are still recorded as unselected `AllocationCandidate`s with a real rejection reason, just outside the formal chain.

## `resolveActiveResource` / `needsEscalation` / `isFallbackInUse`

```ts
resolveActiveResource(chain, unavailableResourceIds): ResolvedFallback | null
needsEscalation(chain, unavailableResourceIds): boolean
isFallbackInUse(resolved): boolean
```

Walks primary, then each backup tier in order, returning the first resource *not* in `unavailableResourceIds`. `null` means every resource in the chain is unusable — escalation is needed. `isFallbackInUse` is `true` only when the resolved resource has a real `tier` (not the primary).

## Why `is_fallback` stays `false` on every initial proposal

`AllocationEngine.buildAllocationProposal` always selects the top-ranked *eligible* candidate — by construction, the eligible pool never contains an "unavailable" primary, so there's nothing to fall back from yet. `FallbackChain`s built at proposal time are a plan, not a record of something that already happened. `is_fallback`/`fallback_tier` on a persisted `AllocationCandidate` are a hook this checkpoint deliberately leaves for a future re-resolution/escalation flow — genuinely detecting "the primary just became unavailable, promote the backup" is a Dispatch-era concern, out of scope for planning.

## Consumers

- `allocationEngine.ts` — builds one `FallbackChain` per `quantity: 1` line.
- `allocationExplanationEngine.ts` — accepts `fallbackChains` for API symmetry, but the actual "was a fallback used" signal always comes from each candidate's own `is_fallback`/`fallback_tier`.
