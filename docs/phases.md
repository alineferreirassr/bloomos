# Phase Engine

`src/core/operationalPlanning/phaseEngine.ts` — v2.0 Checkpoint 27.2, Step 3.

## What it answers

An `ExecutionPhase`'s `order` field is always author-assigned — this engine never recomputes it. `EXECUTION_PHASE_KINDS` covers the spec's 9 named phases: Preparation, Travel, Arrival, Setup, Execution, Quality Review, Cleanup, Completion, Custom.

## `resolvePhaseOrder`

```ts
resolvePhaseOrder(phases): ExecutionPhase[]
```

Sorted by each phase's own explicit `order` field — never re-derived from `kind`. `OperationalPlanDetailView` and every phase-ordered computation (critical path, health) call this before iterating.

## `validatePhaseOrder`

```ts
validatePhaseOrder(phases): PhaseOrderIssue[]  // { phaseId, detail }
```

`DEFAULT_PHASE_ORDER` is a *validation hint only* — the spec's own named phases describe a natural real-world sequence (Preparation → Travel → Arrival → Setup → Execution → Quality Review → Cleanup → Completion), and this function flags when a plan's actual ordering contradicts that sequence. It's a **warning, never a hard block** — a legitimate plan can skip or reorder phases (e.g. no travel phase for an on-site-only event). `"custom"` phases are exempt — they carry no natural position and never trigger this check.

## Consumers

- `operationalConstraintsEngine.ts` — every `validatePhaseOrder` issue becomes an `invalid_phase_order` warning.
- `OperationalPlanDetailView.tsx` — phases render sorted via `resolvePhaseOrder`.
