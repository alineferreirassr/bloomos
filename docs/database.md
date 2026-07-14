# Database

This document defines the data model for BloomOS. It is a design reference, written ahead of any live Supabase connection — no schema here has been applied to a real database yet. Terminology follows `BLOOMOS_BIBLE.md`; if they ever disagree, the Bible wins and this file gets corrected.

## Principles

- **Multi-tenant-ready, not multi-tenant-active.** Every core table carries a `workspace_id` column from day one, even though the MVP runs a single tenant (Amoré Bloom). This avoids a painful retrofit later. See `BLOOMOS_BIBLE.md` §7 for what a Workspace is.
- **UUID primary keys** everywhere, generated server-side.
- **Timestamps on everything:** `created_at`, `updated_at` (and `deleted_at` for soft deletes where reversibility matters — e.g. Clients, Events, Contracts).
- **Status/stage as constrained enums**, not free text, so the lifecycle in `docs/workflows.md` is enforced at the data layer.
- **No business data lives only in the frontend.** Mock data during MVP development mirrors this schema exactly, so swapping in Supabase later is a data-source change, not a rewrite.

## MVP entities

### `workspaces`
The schema representation of a Workspace (`BLOOMOS_BIBLE.md` §7) — one row per business operating on BloomOS. Reserved for multi-tenancy readiness. In the MVP, exactly one row exists (Amoré Bloom).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| created_at | timestamptz | |

### `leads`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| first_name | text | |
| last_name | text | |
| email | text | |
| phone | text | nullable |
| instagram | text | nullable |
| source | text | how they found the business — curated options in `modules/leads/constants.ts`, not a canonical enum |
| event_type | text | nullable — curated options in `modules/leads/constants.ts` |
| event_date | date | nullable |
| location | text | nullable |
| budget_min | numeric | nullable |
| budget_max | numeric | nullable |
| message | text | nullable |
| status | enum | `new`, `contacted`, `welcome_guide_sent`, `consultation_scheduled`, `qualified`, `proposal_sent`, `converted`, `lost`, `archived` — canonical values and transition rules live in `core/workflows/leadWorkflow.ts`, not duplicated here |
| assigned_to | text | nullable — team member name; becomes a real FK once a Team module and auth exist |
| converted_client_id | uuid | nullable FK → clients, set on conversion |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable, set when status becomes `archived` |

### `notes`
Shared by Leads and Clients — one polymorphic table (`owner_type` + `owner_id`) rather than a separate `lead_notes` and `client_notes` table, so the shape doesn't duplicate itself as more owner types are added.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces — see "Polymorphic ownership" below for why every read/write scopes by this in addition to owner_type/owner_id |
| owner_type | enum | `lead`, `client`, `event` |
| owner_id | uuid | references leads.id, clients.id, or events.id, depending on owner_type — **not** a database-enforced FK; see below |
| title | text | |
| content | text | |
| category | enum | `general`, `special_request`, `preference`, `relationship_detail`, `allergy`, `accessibility`, `dietary_restriction`, `communication`, `internal_alert`, `idea`, `reminder`, `problem` |
| priority | enum | `low`, `normal`, `high`, `critical` |
| is_pinned | boolean | pinned notes surface first on the Lead/Client detail page |
| attachments | jsonb | metadata-only placeholders (`id`, `file_name`, `file_type`, `size_bytes`) — no real file storage until Supabase Storage is connected |
| created_by | text | actor name; becomes a real FK once auth exists |
| created_at / updated_at | timestamptz | |

### `timeline_activities`
Shared by Leads and Clients — one polymorphic, append-only table (`owner_type` + `owner_id`). Every entry is written through one shared mechanism (`recordTimelineActivity`), never constructed by hand — see `docs/workflows.md`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces — see "Polymorphic ownership" below for why every read/write scopes by this in addition to owner_type/owner_id |
| owner_type | enum | `lead`, `client`, `event` |
| owner_id | uuid | references leads.id, clients.id, or events.id, depending on owner_type — **not** a database-enforced FK; see below |
| type | enum | `lead_created`, `lead_updated`, `status_changed`, `note_added`, `note_pinned`, `note_unpinned`, `welcome_guide_sent`, `lead_archived`, `lead_converted`, `client_created`, `client_updated`, `tags_changed`, `vip_status_changed`, `communication_preference_changed`, `client_archived`, `client_restored`, `event_created`, `event_updated`, `lifecycle_stage_changed`, `priority_changed`, `checklist_item_created`, `checklist_item_completed`, `checklist_template_applied`, `schedule_item_created`, `schedule_item_updated`, `event_archived`, `event_restored`, `event_cancelled`, `event_completed` |
| description | text | human-readable summary |
| actor | text | who/what performed the action |
| timestamp | timestamptz | |
| metadata | jsonb | nullable — e.g. `{ from, to }` on a status change, `{ client_id }` on conversion |

#### Polymorphic ownership: no normal foreign key is possible

`notes.owner_id`, `timeline_activities.owner_id`, `checklist_items.owner_id`, and `schedule_items.owner_id` each point at one of several possible target tables depending on the row's `owner_type` — a single column referencing more than one target table. Postgres (and Supabase) cannot express that as one `FOREIGN KEY` constraint; a normal FK targets exactly one table. This is a deliberate tradeoff to avoid duplicating the same architecture per owner type (`lead_notes`/`client_notes`/`event_notes`, `event_checklist_items`/`employee_checklist_items`/etc.) as more owner types are added — `checklist_items` and `schedule_items` were built polymorphic from the start specifically so Team Management, Vendors, Inventory, and Vehicles can adopt them later without a schema change, not just Events.

Because referential integrity and workspace isolation can't be guaranteed by a FK here, both are enforced elsewhere instead:

- **Data layer (now):** every read/write in `lib/data/index.ts` derives `workspace_id` from the owning record and filters by `workspace_id` **and** `owner_type`/`owner_id` together — never `owner_id` alone. A note, timeline, checklist, or schedule row is only ever reachable through its actual owner's own workspace.
- **Supabase RLS (once connected):** row-level security policies must independently re-check `workspace_id` against the authenticated user's workspace, and validate that `owner_id` actually exists in the table named by `owner_type`, on every `SELECT`/`INSERT`/`UPDATE`. A `CHECK` constraint can validate `owner_type IN ('lead','client','event', ...)`, but the owner's existence and workspace match must be enforced by RLS policy logic (or trigger-based validation) rather than a FK.

Checklist assignment (`assigned_type`/`assigned_id`/`assigned_name`) is a second, smaller instance of the same pattern, prepared ahead of the Employee/Vendor modules that will eventually populate `assigned_id` for real.

### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| originating_lead_id | uuid | nullable FK → leads — manually-created Clients have no originating Lead |
| first_name | text | |
| last_name | text | |
| email | text | |
| phone | text | nullable |
| instagram | text | nullable |
| preferred_contact_method | enum | nullable — `email`, `phone`, `text`, `whatsapp`, `instagram` |
| partner_name | text | nullable |
| relationship_status | text | nullable — curated options in `modules/clients/constants.ts`, not a canonical enum |
| important_dates | jsonb | array of `{ id, label, date }` — custom/ad-hoc dates beyond the fixed couple-info milestones below |
| address / city / state / zip_code | text | nullable |
| source | text | nullable — how they originally came in; curated options in `modules/clients/constants.ts` |
| tags | text[] | |
| internal_status | enum | `active`, `planning`, `past_client`, `inactive`, `archived` — canonical values live in `core/enums/clientStatus.ts` |
| is_returning | boolean | true once they have more than one event |
| how_they_met / first_date / relationship_anniversary / engagement_date / wedding_date | text/date | nullable couple-info milestones |
| favorite_colors / favorite_flowers / favorite_music / favorite_food / favorite_drinks / preferred_style / disliked_elements | text | nullable couple-info preferences |
| allergies / accessibility_needs / dietary_restrictions / preferred_communication_time | text | nullable — internal-only, never exposed to a future Client Portal |
| do_not_call / surprise_event_confidentiality | boolean | internal-only operational flags |
| emergency_contact_name / emergency_contact_phone | text | nullable |
| is_vip | boolean | VIP / high-priority flag |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable, set when internal_status becomes `archived` |

### `events`
The operational center of BloomOS — the record tying a Client to a specific engagement, carrying its own independent status and lifecycle_stage state machines (`core/workflows/eventWorkflow.ts`; the earlier `lead`/`consultation`/.../`completed` single-stage model below in `docs/workflows.md` predates this and is superseded by the two-state-machine design — see the note under "MVP note on stage coverage").

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| client_id | uuid | FK → clients — **required**; an Event cannot exist without a Client |
| originating_lead_id | uuid | nullable — preserved from the Client's own `originating_lead_id` when relevant; not required for a manually created Event |
| title | text | e.g. "Malibu Sunset Proposal" |
| event_type | enum | `proposal`, `anniversary`, `birthday`, `picnic`, `hotel_decoration`, `romantic_setup`, `private_dinner`, `engagement`, `micro_wedding`, `bridal_shower`, `baby_shower`, `elopement`, `styled_shoot`, `branding`, `photoshoot`, `other` — `core/enums/eventType.ts` |
| status | enum | `draft`, `inquiry`, `awaiting_contract`, `awaiting_deposit`, `confirmed`, `planning`, `ready`, `in_progress`, `completed`, `cancelled`, `archived` — `core/enums/eventStatus.ts`; `completed`/`cancelled`/`archived` are terminal, reachable only via their own dedicated action |
| lifecycle_stage | enum | `intake`, `proposal`, `booking`, `planning`, `preparation`, `setup`, `execution`, `live_event`, `breakdown`, `post_event`, `closed` — `core/enums/eventLifecycleStage.ts`; independent of `status`, never inferred from it |
| event_date / start_time / end_time / timezone | date/time/text | all nullable until confirmed |
| location_name / address / city / state / zip_code | text | nullable |
| latitude / longitude | numeric | nullable — no real maps integration yet |
| guest_count | integer | nullable |
| budget_min / budget_max | numeric | nullable |
| package_name / theme / color_palette | text | nullable |
| surprise_event | boolean | |
| confidentiality_notes / accessibility_notes / dietary_notes | text | nullable — internal-only |
| weather_plan / backup_location | text | nullable — no Weather API integration yet |
| internal_summary | text | nullable |
| assigned_owner | text | nullable — team member name; becomes a real FK once a Team Management module and auth exist |
| priority | enum | `low`, `normal`, `high`, `urgent`, `critical` — `core/enums/eventPriority.ts` |
| created_at / updated_at | timestamptz | |
| archived_at / completed_at / cancelled_at | timestamptz | nullable, set by their respective dedicated action |

### `checklist_items`
Reusable across owner types the same way `notes`/`timeline_activities` are — `owner_type` + `owner_id`, not Event-specific, even though "event" is the only real owner today. See "Polymorphic ownership" below.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | `lead`, `client`, `event` (shared `EntityType`) — only `event` populated today |
| owner_id | uuid | references the owning row — **not** a database-enforced FK; see "Polymorphic ownership" |
| title | text | |
| description | text | nullable |
| category | enum | `planning`, `client`, `venue`, `decor`, `flowers`, `photography`, `video`, `food_beverage`, `transportation`, `team`, `inventory`, `finance`, `legal`, `weather`, `setup`, `cleanup`, `post_event`, `other` |
| priority | enum | `low`, `normal`, `high`, `critical` — reuses the existing Note priority scale, not the Event priority scale (which has a fifth "urgent" tier) |
| status | enum | `pending`, `in_progress`, `blocked`, `completed`, `cancelled` |
| due_date | date | nullable |
| completed_at | timestamptz | nullable |
| assigned_type | enum | `employee`, `vendor`, `client`, `unknown` — generalized assignment; no Employee/Vendor table exists yet |
| assigned_id | uuid | nullable — references the assignee once Employee/Vendor tables exist; always null today |
| assigned_name | text | nullable — free-text display name in the meantime |
| sort_order | integer | |
| created_at / updated_at | timestamptz | |

### `schedule_items`
The day-of run-of-show. Generalized the same way as `checklist_items` — `owner_type` + `owner_id` instead of a plain `event_id` — so Employee/Vendor/Inventory/Vehicle/Client schedules can reuse this table later without a redesign.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | `lead`, `client`, `event` (shared `EntityType`) — only `event` populated today |
| owner_id | uuid | references the owning row — **not** a database-enforced FK; see "Polymorphic ownership" |
| title | text | |
| description | text | nullable |
| start_time / end_time | time | nullable |
| location | text | nullable |
| assigned_to | text | nullable — free-text; not generalized to assigned_type/id/name (only `checklist_items` assignment was, per the refinement scope) |
| category | enum | `arrival`, `delivery`, `setup`, `vendor`, `client`, `surprise`, `ceremony`, `photography`, `video`, `food_beverage`, `cleanup`, `departure`, `other` |
| status | enum | `planned`, `confirmed`, `completed`, `delayed`, `cancelled` |
| sort_order | integer | |
| created_at / updated_at | timestamptz | |

### `contracts`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| event_id | uuid | FK → events |
| status | enum | `draft`, `sent`, `signed`, `cancelled` |
| total_amount | numeric | |
| signed_at | timestamptz | nullable |
| file_path | text | nullable — path into the future `contracts` Supabase Storage bucket (`docs/integrations.md`); no upload capability exists until Supabase is connected |
| created_at / updated_at | timestamptz | |

### `payments`
Finance module: deposits and subsequent payments against a contract.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| contract_id | uuid | FK → contracts |
| type | enum | `deposit`, `installment`, `balance`, `refund` |
| amount | numeric | |
| status | enum | `pending`, `paid`, `failed`, `refunded` |
| due_date | date | nullable |
| paid_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

## Relationships

```
workspaces 1—* leads
workspaces 1—* clients
workspaces 1—* events
leads 1—* notes                    (owner_type = 'lead')
leads 1—* timeline_activities      (owner_type = 'lead')
clients 1—* notes                   (owner_type = 'client')
clients 1—* timeline_activities     (owner_type = 'client')
events 1—* notes                    (owner_type = 'event')
events 1—* timeline_activities      (owner_type = 'event')
events 1—* checklist_items          (owner_type = 'event')
events 1—* schedule_items           (owner_type = 'event')
leads 1—0/1 clients        (via clients.originating_lead_id)
clients 1—* events                  (event.client_id — required)
leads 1—0/1 events                  (via events.originating_lead_id, optional)
events 1—0/1 contracts
contracts 1—* payments
```

## Post-MVP tables (not created yet)

Anticipated, not implemented: `inventory_items`, `suppliers`, `team_members`, `event_team_assignments`, `vehicles`, `client_portal_access`, `automations`, `automation_runs`, `emails`, `gallery_media`, `feedback`, `knowledge_base_articles`. When these ship, `checklist_items.owner_type`/`schedule_items.owner_type` and `checklist_items.assigned_type` are expected to gain `employee`/`vendor`/`inventory`/`vehicle` values rather than needing new tables — that reuse is the reason those two tables were generalized ahead of time. These will be specified in detail when their phase (see `ROADMAP.md`) begins.

## Supabase-specific notes

- Row-Level Security (RLS) is designed alongside the schema but **enabled only once Supabase is actually connected** with real credentials — see `docs/permissions.md`.
- Enum values above are the intended constraint; whether they're implemented as Postgres `enum` types or `check` constraints is an implementation decision made at connection time, not before.
