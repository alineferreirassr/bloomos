# Allocation Domain — Types

`src/types/allocation.ts` — v2.0 Checkpoint 27.1, Step 1.

## What this checkpoint answers

Capability (26.1) determines **WHO** is eligible. Scheduling (27) determines **WHEN** work can happen. Resource Allocation determines **WHICH combination of resources** should perform the work — planning only. Dispatch (a future checkpoint) determines **WHO is actually sent**. This checkpoint builds planning, nothing else.

## The four persisted entities

| Entity | Purpose | Never |
|---|---|---|
| `AllocationRequest` | "I need N of this resource type, by this time, optionally matching a capability requirement." | Duplicates `CapabilityRequirement` — a request's capability need is a reference (`capability_requirement_id`), never a re-declared skill/certification list. |
| `Allocation` | One proposal for a request — a specific `strategy`'s candidate selection. Multiple `Allocation`s can share a `group_id` (Proposal A/B/C) for comparison. | Reserves anything. Draft/proposed/approved/failed/archived — never "reserved," "dispatched," or "in progress." |
| `ResourceBundle` | A reusable template (e.g. "Photography Crew") — `BundleEngine` translates it into requirement lines. | Selects a resource itself. |
| `DependencyRule` | Reusable registry data: "a Drone requires a certified operator." | A per-request requirement — that's what `AllocationRequirementLine.capability_requirement_id` is for. |

## Resource types — 7, with an honest node mapping

```ts
RESOURCE_TYPES = ["worker", "team", "equipment", "vehicle", "asset", "vendor", "custom"]
```

`worker`/`team`/`equipment`/`vehicle`/`vendor` map to real `KnowledgeNodeType`s. `asset`/`custom` do not — `RESOURCE_TYPES_WITH_NO_NODE` documents this explicitly (Checkpoint 25's DAM already uses `"media_asset"` for a different concept). A relationship touching an asset/custom resource resolves to `null`, never a fabricated node.

## Allocation Strategies — 7, all deterministic

`highest_capability`, `lowest_cost`, `balanced_workload`, `least_busy`, `preferred_team`, `preferred_worker`, `custom`. Every strategy is a total order with a `resource_id` tie-break — see [`allocation-engine.md`](allocation-engine.md). `lowest_cost` is honestly a no-op (falls back to `score`): no cost/rate field exists anywhere in Workforce/Equipment/Vehicle/Vendor.

## Computed-only shapes (never persisted)

`AllocationScores`, `AllocationValidationResult`, `AllocationExplanation`, `AllocationComparisonResult`, `ResourcePoolSnapshot`, `AllocationFinding` — all re-derived on demand, the same "computed, never stored" discipline `SchedulingScores`/`CapabilityScores` established. `AllocationResult` bundles `{ allocation, scores, validation, explanation }` — the shape every module-layer action that touches a proposal returns.

## `AllocationCandidate` — the one array every downstream engine reads

```ts
interface AllocationCandidate {
  resource_type: ResourceType;
  resource_id: string;
  requirement_line_index: number;
  selected: boolean;
  rejection_reason: string | null;  // populated only when selected: false
  is_fallback: boolean;
  fallback_tier: number | null;     // null for primary, 1/2/... for backups
}
```

`is_fallback`/`fallback_tier` stay `false`/`null` on every proposal `AllocationEngine` builds — nothing is "in use" yet at planning time. They exist as a hook for a future re-resolution/escalation flow (a real primary becoming unavailable and a backup taking over), which this checkpoint deliberately doesn't build.
