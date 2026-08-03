# v2.0 Checkpoint 26 — Mobile Workforce Platform Foundation

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Checkpoint 26 adds a new domain — field workforce — to BloomOS: Workers, Teams, Availability, Skills/Certifications, Assignments, Mobile Sessions, an Offline queue, Location snapshots, an Equipment registry, and a Vehicle registry. Per the spec's own stop condition, this is explicitly a **foundation**: no scheduling, no dispatch, no route optimization, no maps, no GPS history, no workforce automation. Every engine here is a pure function over already-fetched data; every store follows the same mock-only `let`-array-plus-`resetXStore()` convention this checkpoint series has used since Checkpoint 25.6.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/workforce.ts` | Worker/Team/Skill/Certification/Availability/Assignment/MobileSession/OfflineQueueEntry/LocationSnapshot/Equipment/Vehicle/Scorecard — see [`workforce.md`](workforce.md) |
| Worker Registry | `lib/data/mock/workersStore.ts` | CRUD, archive/restore |
| Team Registry | `lib/data/mock/teamsStore.ts` | CRUD, membership |
| Availability Store | `lib/data/mock/availabilityStore.ts` | Append-only window log |
| Assignment Registry | `lib/data/mock/assignmentsStore.ts` | Worker ↔ assignable target |
| Mobile Session Registry | `lib/data/mock/mobileSessionsStore.ts` | Session lifecycle |
| Offline Queue Store | `lib/data/mock/offlineQueueStore.ts` | Queued-while-offline records, infra only |
| Location Store | `lib/data/mock/locationStore.ts` | Latest-snapshot-only per worker |
| Equipment Registry | `lib/data/mock/equipmentStore.ts` | CRUD, assignment |
| Vehicle Registry | `lib/data/mock/vehiclesStore.ts` | CRUD, assignment |
| Core accessors | `core/workforce/index.ts` | One `getCoreXService()` per store |
| Team Engine | `core/workforce/teamEngine.ts` | Capacity, membership validation, availability aggregation — see [`workforce.md`](workforce.md) |
| Availability Engine | `core/workforce/availabilityEngine.ts` | See [`availability.md`](availability.md) |
| Skills Engine | `core/workforce/skillsEngine.ts` | Skill summaries, expiring certifications, team coverage |
| Assignment Engine | `core/workforce/assignmentEngine.ts` | See [`assignment-engine.md`](assignment-engine.md) |
| Mobile Session Engine | `core/workforce/mobileSessionEngine.ts` | See [`mobile-foundation.md`](mobile-foundation.md) |
| Offline Engine | `core/workforce/offlineEngine.ts` | See [`offline-foundation.md`](offline-foundation.md) |
| Location Engine | `core/workforce/locationEngine.ts` | See [`location-foundation.md`](location-foundation.md) |
| Equipment Engine | `core/workforce/equipmentEngine.ts` | See [`equipment.md`](equipment.md) |
| Vehicle Engine | `core/workforce/vehicleEngine.ts` | See [`vehicles.md`](vehicles.md) |
| Workforce Timeline Engine | `core/workforce/workforceTimelineEngine.ts` | 22 named Timeline events across Worker/Team/Assignment/Equipment/Vehicle/Mobile Session lifecycle |
| Workforce Scorecard Engine | `core/workforce/workforceScorecardEngine.ts` | The workspace-level rollup the dashboard reads |
| Module layer | `modules/workforce/workforceActions.ts` | The single orchestrator; resolves the session once, delegates to every engine above |
| Dashboard | `modules/workforce/components/WorkforceDashboardView.tsx` at `/assets/workforce` | KPIs, active/on-leave workers, equipment/vehicle utilization, expiring certifications, full roster |

## Reuse, honored exactly as the stop condition requires

- **Knowledge Graph** — Workers, Teams, Equipment, and Vehicles became first-class Knowledge Graph nodes this checkpoint by extending `ENTITY_TYPES` (`core/enums/entityType.ts`) with `"worker"`, `"team"`, `"equipment"`, `"vehicle"` — automatically flowing into `KnowledgeNodeType` (`types/knowledgeGraph.ts`'s `[...ENTITY_TYPES, ...]` spread, unchanged). The Assignment Engine reuses the existing `"assigned_to"` `RelationshipType` and `getCoreKnowledgeGraphService().createRelationship()` — no new relationship type, no second graph.
- **Timeline** — every lifecycle transition (worker created/archived/restored, availability changed, team created/updated/membership changed/archived, assignment created/ended/cancelled, equipment/vehicle created/status-changed/assigned, mobile session started/ended) records through the exact same `recordTimelineActivity` function every other checkpoint uses, guarded by the same `ENTITY_TYPE_SET` check `knowledgeGraphActions.ts` established.
- **Audit** — the Timeline *is* this codebase's audit trail; no second audit log was introduced.
- **Permissions** — the module layer resolves the session via `resolveMemberSessionSnapshot()`, the same gate every other action in this codebase uses. `"workforce.view"`/`"workforce.manage"` were added to `core/enums/permission.ts` and `lib/team/permissionMatrix.ts` following the exact `assets.view`/`assets.manage` precedent.
- **No AI, no randomness anywhere** — every computed value (availability status, workload, utilization, scorecard) is a disclosed pure function over already-fetched data.

## Executive Integration — scoped deliberately, not partially forgotten

The spec's Step 12 named "Executive Integration," and this checkpoint delivers the parts consistent with its own stop condition ("Build only the reusable operational foundation that future checkpoints will extend"):

- Workers/Teams/Equipment/Vehicles are real, queryable Knowledge Graph nodes (above).
- Every lifecycle event is a real Timeline entry, the same audit trail Business Health/Objectives/Executive Decisions all read from.
- Permissions are real and enforced at the module boundary.

What this checkpoint does **not** do: wire workforce data into Business Health's `overallScore`, Objectives' completion tracking, or the Executive Decision Priority Engine's live scoring. Doing so would mean inventing a workforce-readiness formula this spec never defined, which the series' own "do not create another recommendation/scoring engine" discipline forbids without a dedicated spec (the same discipline that made the Checkpoint 25.7 Closing Fix necessary before *that* wiring was added). Workers being real Knowledge Graph nodes is what lets a future checkpoint add that wiring later without any of this checkpoint's shape changing.

## Known limitations (disclosed, not hidden)

1. **`project` and `task_placeholder` assignments never create a Knowledge Graph relationship.** Neither has a real `KnowledgeNodeType` in this codebase — same "don't fabricate a node type" gap `types/objectives.ts` already documented for its own `department`/`project` scopes. The Assignment row and Timeline event are still recorded honestly; only the graph edge is skipped. See [`assignment-engine.md`](assignment-engine.md).
2. **Equipment/Vehicle assignment has two write paths that don't fully reconcile.** `createAssignmentAction` (Assignment Engine, creates a Knowledge Graph edge) and `assignEquipmentAction`/`assignVehicleAction` (registry-level, dashboard-facing, updates `assigned_worker_id`/`status` directly) can both assign the same worker to the same equipment/vehicle without erroring, but only the former creates a graph relationship. Disclosed in [`equipment.md`](equipment.md)/[`vehicles.md`](vehicles.md) as reasonable follow-up work, not silently unified.
3. **Offline Foundation and Location Foundation are genuinely infrastructure-only.** No sync, no conflict resolution, no GPS history, no routing — exactly as the stop condition requires, but worth restating: `OfflineQueueEntry.status` never leaves `"pending"` in this checkpoint, and `LocationSnapshot` keeps no history at all.
4. **Business Health / Objectives / Executive Decisions do not yet consume workforce data**, per "Executive Integration — scoped deliberately" above.
5. **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead through the full quality-gate suite below.

## Quality gates

- `tsc --noEmit`: clean
- `eslint`: 0 errors, 17 pre-existing warnings unrelated to this work
- `vitest run`: **6098/6098 tests passing** across 653 files (117 new tests across 22 files for this platform alone)
- `next build`: succeeds, including the new `/assets/workforce` route

## Success criteria, answered

- **Who is available right now?** `availabilitySummary`/`resolveCurrentAvailability` — the Workforce Dashboard's "Available Now" KPI and Active Workers list.
- **What is each worker assigned to?** The Assignment Registry, queryable by worker via `listAssignmentsForWorker`.
- **What equipment/vehicles are in use?** `equipmentUtilization`/`vehicleUtilization` on the dashboard.
- **Whose certifications are expiring?** `findExpiringCertifications`, surfaced on the dashboard within a 30-day window.
- **Can a future checkpoint build real scheduling/dispatch/routing on top of this?** Yes — Workers/Teams/Assignments/Equipment/Vehicles are all real, queryable, Knowledge-Graph-connected entities with a real Timeline trail; nothing here needs to be re-architected to add scheduling logic on top.

Stop condition honored throughout: no scheduling, no dispatch, no route optimization, no maps, no GPS history, no workforce automation. Every reusable piece (Knowledge Graph, Timeline, Permissions, Audit) is composed, never duplicated.
