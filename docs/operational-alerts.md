# Operational Alert Engine & Alert Lifecycle

`core/operationsCenter/operationalAlertEngine.ts`, `core/operationsCenter/alertLifecycleEngine.ts`, `lib/data/mock/operationalAlertsStore.ts`.

## Alert Engine — 17 named deterministic rules

`detectOperationalSignals(data: SnapshotSourceData)` runs 17 named rules over the same already-fetched bundle the Snapshot Engine reads — never a second fetch, never a recalculation of any source module's own facts. Each rule produces one `OperationalSignal` per exact triggering record (never one signal per aggregate count):

| Category | Rules |
|---|---|
| Dispatch | `assignment_pending`, `assignment_declined`, `assignment_expired` |
| Field Operations | `operation_blocked`, `operation_paused` |
| Route Optimization | `high_delay_risk` |
| Scheduling | `overbooked_schedule`, `recurring_conflict`, `holiday_conflict`, `capacity_exhausted` |
| Allocation | `high_severity_finding` |
| Execution Package | `not_ready` |
| Workforce | `low_worker_availability`, `equipment_unavailable`, `vehicle_unavailable` |
| Executive Decisions | `critical_open` |
| Objectives | `blocked` |

## Exact source record references

Most of these domains have no `KnowledgeNodeType` of their own yet (see [`operations-center.md`](operations-center.md)), so `OperationalSignal.sourceRecordId` — a plain, type-unconstrained id read directly off the triggering record (a Dispatch Assignment's own id, a Field Operation's own id, a Scheduling Finding's own id, and so on) — is what satisfies "each alert references the exact source record." `sourceRef: KnowledgeNodeRef | null` is populated only when the record genuinely has one.

## Alert Lifecycle — 6 states, deterministic and auditable

`AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed" | "escalated" | "expired"`. `alertLifecycleEngine.ts`'s `reconcileAlerts(workspaceId, signals, repository)` is the one function every evaluation run goes through:

1. Every live signal is passed to `upsertAlertFromSignal` — a signal whose `dedupe_key` (`ruleId` + `sourceRecordId`, falling back to `sourceRef`) matches an already-open alert reconciles with it (never a duplicate); otherwise a fresh `open` alert is created.
2. `autoResolveGoneAlerts` resolves every currently-open alert whose `dedupe_key` is absent from this run's live signal set, with the resolution reason `"The underlying condition is no longer present."` — this is what "resolving means the condition is no longer present" means in practice.

**Acknowledging an alert never mutates the source module** — `acknowledgeAlert`/`resolveAlert`/`dismissAlert`/`escalateAlert` in `operationalAlertsStore.ts` only ever change the alert's own record (`status`, `acknowledged_by`/`_at`, `resolved_by`/`_at`/`resolution_reason`, `dismissed_at`, `escalated_at`). Resolving with an explicit reason (`resolveAlert(id, workspaceId, memberId, reason)`) is the "authorized user explicitly closes the alert with a reason" path.

## Comments — `operational_alert` is a real `EntityType`

Rather than build a bespoke comment surface, `operational_alert`/`operational_incident` were added as real `EntityType` values (`core/enums/entityType.ts`), so the existing generic `CommentsPanel`/`getCommentsForOwnerAction`/`createCommentAction` already work against Alerts/Incidents with zero Operations Center-specific comment code.
