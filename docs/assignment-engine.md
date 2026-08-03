# Assignment Engine

v2.0 Checkpoint 26, Step 6. Connects a Worker to whatever they're assigned to — a Client, Event, Project, Asset, Vehicle, Equipment, Vendor, or task placeholder — without introducing scheduling, dispatch, or route planning. `core/workforce/assignmentEngine.ts` is the pure validation layer; `modules/workforce/workforceActions.ts`'s `createAssignmentAction`/`endAssignmentAction` are the impure orchestrators that actually write the Assignment row, create a Knowledge Graph relationship, and record a Timeline event.

## The eight assignable types

```ts
const ASSIGNABLE_TYPES = ["client", "event", "project", "asset", "vehicle", "equipment", "vendor", "task_placeholder"] as const;
```

## Honest gaps: `project` and `task_placeholder`

Six of the eight map to a real `KnowledgeNodeType` this codebase already has:

```ts
const ASSIGNABLE_TYPE_TO_NODE_TYPE: Partial<Record<AssignableType, KnowledgeNodeType>> = {
  client: "client",
  event: "event",
  asset: "media_asset",
  vehicle: "vehicle",
  equipment: "equipment",
  vendor: "vendor",
};
```

`project` and `task_placeholder` are named by the spec but BloomOS has no Project entity and no standalone Task entity anywhere in the codebase — the same gap `types/objectives.ts`'s `OBJECTIVE_SCOPES_WITH_NO_NODE` already documented for Objectives' `department`/`project` scopes. Rather than fabricate a node type the Knowledge Graph's own "don't invent entities" discipline forbids, `resolveAssignableNodeType()` returns `null` for these two, and `createAssignmentAction` skips Knowledge Graph relationship creation for them — disclosed here, not silently faked. The Assignment row and its Timeline event are still recorded normally; only the graph edge is honestly omitted.

## Validation

`isAssignmentValid(worker)` blocks two states before any assignment is created:

- `status === "terminated"` — a terminated worker cannot be assigned.
- `status === "on_leave"` — must end their leave first.

This is enforced both in the pure engine (for unit testing) and again in `createAssignmentAction` itself (the real gate).

## What creating an assignment actually does

1. Validates the worker via the two checks above.
2. Writes the `Assignment` row (`assignmentsStore.ts`), defaulting to `status: "active"`.
3. If `resolveAssignableNodeType(assignable_type)` returns a real node type, creates a Knowledge Graph relationship — `worker --assigned_to--> <assignable>` — via `getCoreKnowledgeGraphService().createRelationship(...)`, reusing the existing `"assigned_to"` `RelationshipType` (already defined in `types/knowledgeGraph.ts`, never a new one) and `source: "user_action"`. The store's own exact-duplicate dedup (Step 10.5) means re-assigning the same worker to the same target is a safe no-op, not a duplicate edge.
4. Records an `assignment_created` Timeline event on the worker.

Ending an assignment (`endAssignmentAction`, default `status: "completed"`) stamps `ends_at` and records `assignment_ended` or `assignment_cancelled`.

## Workload

`computeWorkerWorkload(workerId, assignments)` counts a worker's currently-`active` assignments — the only "how busy is this person" signal this checkpoint computes; there is no capacity limit or auto-balancing (that's dispatch, explicitly out of scope).
