# Incident Engine

`core/operationsCenter/incidentEngine.ts`, `lib/data/mock/operationalIncidentsStore.ts`. Never an external incident-management platform — a grouping layer over Alerts this checkpoint already owns.

## When alerts become an incident

`groupCriticalAlerts(alerts)` groups currently-open (`open`/`acknowledged`/`escalated`), **critical**-severity alerts into a single cluster once there are 2 or more happening at once — several simultaneous critical alerts is itself the actionable "incident" condition, distinct from any single alert being escalated. `evaluateOperationsCenterAction` runs this on every evaluation, and only creates a new incident when no existing open incident already covers the exact same alert-id set (`incident.source_alert_ids` is a superset of the group) — so re-running the evaluation never spawns duplicate incidents for the same still-live cluster.

## `buildIncidentFromAlerts` — assembling the record

- **`title`/`description`** — the single alert's own title/description when the group has exactly one member; otherwise a summary naming the count and number of distinct categories involved.
- **`severity`** — the highest severity present across the grouped alerts (`critical` > `high` > `medium` > `low` > `informational`).
- **`source_alert_ids`** — every grouped alert's own id.
- **`related_field_operation_ids`/`related_route_plan_ids`** — populated from `source_record_id` **only** for alerts whose category genuinely names that exact entity (`field_operations` alerts carry a Field Operation id; `route_optimization` alerts carry a Route Plan id). `related_dispatch_order_ids`/`related_worker_ids`/`related_vehicle_ids`/`related_equipment_ids` stay empty this checkpoint — `dispatch` alerts carry an *assignment* id (not the order id), and `workforce` alerts are aggregate-level with no single record id, so rather than guess wrong these fields are left honestly empty until a future pass threads the real relationship through.

## Lifecycle — 3 states

`IncidentStatus = "open" | "acknowledged" | "resolved"`. `setIncidentStatusAction(id, status, resolutionNotes?)` is the one mutation surface, stamping `acknowledged_at`/`resolved_at` and recording the matching named Timeline event (`operational_incident_acknowledged`/`operational_incident_resolved`).

## Full field list

`id`, `workspace_id`, `title`, `description`, `severity`, `status`, `source_alert_ids`, `related_dispatch_order_ids`, `related_field_operation_ids`, `related_route_plan_ids`, `related_worker_ids`, `related_vehicle_ids`, `related_equipment_ids`, `owner_member_id`, `resolution_notes`, `created_at`, `acknowledged_at`, `resolved_at`, `updated_at` — every field the spec's own Step 7 names.
