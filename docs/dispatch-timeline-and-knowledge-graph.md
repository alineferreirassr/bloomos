# Dispatch Timeline Engine / Knowledge Graph Engine

`src/core/dispatch/{dispatchTimelineEngine,dispatchKnowledgeGraphEngine}.ts` — v2.0 Checkpoint 28, Steps 9-10.

## Dispatch Timeline Engine — the 7 named events

`dispatch_created`, `dispatch_assignment_created`, `assignment_accepted`, `assignment_declined`, `dispatch_cancelled`, `dispatch_archived`, `queue_updated`. Pure `{ type, description }` builders; `dispatchActions.ts` calls them only on a real transition — `buildDispatchOrderAction` emits `dispatch_created` + one `dispatch_assignment_created` per assignment; `respondToAssignment` emits `assignment_accepted`/`assignment_declined` (only for those two transitions) plus `queue_updated` for every transition it handles (`assigned`/`pending`/`accepted`/`declined`/`expired`/`cancelled`); `setDispatchOrderStatusAction` emits `dispatch_cancelled`/`dispatch_archived`. The pure-read `evaluateDispatchOrderAction`/`evaluateDispatchPlatformHealthAction` emit nothing, so viewing an order or the dashboard never spams the Timeline.

### A real naming collision, caught and fixed

`"assignment_created"` already existed in `core/enums/timelineActivityType.ts` — Checkpoint 26's own Workforce Assignment Engine (Worker → Client/Event/Project/etc.) had claimed it first. Dispatch's own version was renamed to `"dispatch_assignment_created"` in the const array, the labels record, `dispatchTimelineEngine.ts`'s `assignmentCreatedEvent` function, and its test — confirmed via grep that `assignment_accepted`/`assignment_declined`/`dispatch_created`/`dispatch_cancelled`/`dispatch_archived`/`queue_updated` had no other collisions.

## Knowledge Graph Integration — 3 live relationships, 4 reserved

`dispatch_order`, `dispatch_assignment`, `dispatch_batch`, `dispatch_queue` are registered in `RelationshipType` but never emitted — `DispatchOrder`/`DispatchAssignment`/`DispatchBatch` have no node identity of their own, the same discipline `ExecutionPackage`/`OperationalPlan` held to before them.

`assigned_worker`, `assigned_vehicle`, `assigned_equipment` **are** live — the first genuinely new live edges since Operational Planning's `produces_deliverable`, because unlike `ExecutionPackage`/`Allocation`/`OperationalPlan`, a Worker/Vehicle/Equipment **is** a real `KnowledgeNodeType` per the existing `RESOURCE_TYPE_TO_NODE_TYPE` mapping:

```ts
buildAssignedResourceRelationship(orderContext: KnowledgeNodeRef | null, resourceType: ResourceType, resourceId: string): DispatchRelationshipSpec | null
```

Returns `null` when the order has no real context node, or when `resourceType` isn't one of the 3 the spec names — **Team and Vendor assignments deliberately get no edge**, since the spec's own named relationship list only includes worker/vehicle/equipment. The source node is always the Dispatch Order's own context node, reused from its Execution Package's `ExecutionContext.context` (Dispatch Orders themselves have no context field — reserved vocabulary, matching `dispatch_order`'s own reserved status) — `dispatchActions.ts`'s `persistAssignedResourceRelationship`/`resolveOrderContext` do this resolution, never fabricating a node.

This is a **3-live/4-reserved** ratio — the inverse discipline from Execution Package's own 0-live/8-reserved, because Dispatch's assignments genuinely point at real, already-existing nodes, unlike the plain-record aggregation Execution Package performs.
