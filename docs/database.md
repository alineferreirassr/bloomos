# Database

This document defines the data model for BloomOS. Most of it is a design reference, written ahead of any live Supabase connection for the tables it covers. The exceptions are the **Supabase Foundation** (`profiles`, `workspaces`, `workspace_members`), the **Leads**, **Clients**, **Events**, and **Contracts** modules (`leads`, `clients`, `events`, `checklist_items`, `event_schedule_items`, `contracts`, `contract_templates`, `contract_exhibits`, `notes`, `timeline_activities`), and the **Media Library** (`media_assets`) — these tables have real, ordered SQL migrations under `supabase/migrations/`, applied to a live, connected Supabase project (see `docs/integrations.md`). Every other table in this document (Finance, Documents, etc.) remains mock-only; no migration exists for them yet. Terminology follows `BLOOMOS_BIBLE.md`; if they ever disagree, the Bible wins and this file gets corrected.

## Principles

- **Multi-tenant-ready, not multi-tenant-active.** Every core table carries a `workspace_id` column from day one, even though the MVP runs a single tenant (Amoré Bloom). This avoids a painful retrofit later. See `BLOOMOS_BIBLE.md` §7 for what a Workspace is.
- **UUID primary keys** everywhere, generated server-side.
- **Timestamps on everything:** `created_at`, `updated_at` (and `deleted_at` for soft deletes where reversibility matters — e.g. Clients, Events, Contracts).
- **Status/stage as constrained enums**, not free text, so the lifecycle in `docs/workflows.md` is enforced at the data layer.
- **No business data lives only in the frontend.** Mock data during MVP development mirrors this schema exactly, so swapping in Supabase later is a data-source change, not a rewrite.

## Supabase Foundation

The three tables below have real, applied SQL migrations (`supabase/migrations/`, 8 files, ordered) — see `docs/integrations.md` for connection status and `docs/permissions.md` for the RLS policies layered on top of each. The **Leads** module (`leads`, `notes`, `timeline_activities` — 5 further migrations) is also live; see the "Leads" and "Notes"/"timeline_activities" entries under "MVP entities" below, each marked accordingly.

### `profiles`
One row per Supabase Auth user (`auth.users.id`). Provisioned automatically by a `handle_new_user()` trigger on `auth.users` insert — application code never inserts a profile directly.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, FK → auth.users, on delete cascade |
| full_name | text | nullable |
| email | text | |
| avatar_url | text | nullable — expected to point at the `avatars` Storage bucket once real upload exists |
| created_at / updated_at | timestamptz | |

### `workspaces`
The schema representation of a Workspace (`BLOOMOS_BIBLE.md` §7) — one row per business operating on BloomOS. The MVP *UI* assumes a single active Workspace per session (`CURRENT_WORKSPACE_ID`, `core/constants/workspace.ts`), but this table and `workspace_members` below already support a user belonging to several.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| slug | text | unique |
| created_by | uuid | FK → auth.users |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable — soft delete, matching every other archivable entity in this schema |

### `workspace_members`
Join table between `auth.users` and `workspaces`, carrying role and status. Unique on (`workspace_id`, `user_id`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces, on delete cascade |
| user_id | uuid | FK → auth.users, on delete cascade |
| role | enum | `owner`, `admin`, `manager`, `team`, `viewer` — `core/enums/workspaceRole.ts` |
| status | enum | `active`, `invited`, `suspended` — `core/enums/workspaceMemberStatus.ts`. A `suspended` member fails every RLS membership check (see `docs/permissions.md`) without needing a separate "disabled account" concept |
| created_at / updated_at | timestamptz | |

No signup flow or Workspace-creation UI exists yet — the first owner/admin account and its Workspace row are created manually via the Supabase Dashboard/SQL once real credentials exist (see `docs/integrations.md`), not through application code.

## MVP entities

### `leads` — **live** (`supabase/migrations/20260716100000_leads.sql`)
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

### `notes` — **live for `owner_type` in `('lead', 'client', 'event')`** (`supabase/migrations/20260716100100_notes.sql`, widened by `20260717100100_notes_timeline_client_owner_type.sql` and `20260718100300_notes_timeline_event_owner_type.sql`)
Shared by Leads, Clients, and Events — one polymorphic table (`owner_type` + `owner_id`) rather than a separate `lead_notes`/`client_notes`/`event_notes` table, so the shape doesn't duplicate itself as more owner types are added. The live Supabase table's `owner_type` CHECK constraint allows `'lead'`, `'client'`, and `'event'` — every other owner type (Contract, Invoice, Payment, Expense, Document, DocumentFolder) still runs its note-taking on the mock store. Each future owner type's own migration phase must widen this constraint further, exactly as `core/enums/entityType.ts` grew one value per mock-phase.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces — see "Polymorphic ownership" below for why every read/write scopes by this in addition to owner_type/owner_id |
| owner_type | enum | `lead`, `client`, `event`, `contract` |
| owner_id | uuid | references leads.id, clients.id, events.id, or contracts.id, depending on owner_type — **not** a database-enforced FK; see below |
| title | text | |
| content | text | |
| category | enum | `general`, `special_request`, `preference`, `relationship_detail`, `allergy`, `accessibility`, `dietary_restriction`, `communication`, `internal_alert`, `idea`, `reminder`, `problem` |
| priority | enum | `low`, `normal`, `high`, `critical` |
| is_pinned | boolean | pinned notes surface first on the Lead/Client detail page |
| attachments | jsonb | metadata-only placeholders (`id`, `file_name`, `file_type`, `size_bytes`) — no real file storage until Supabase Storage is connected |
| created_by | text | actor name; becomes a real FK once auth exists |
| created_at / updated_at | timestamptz | |

### `timeline_activities` — **live for `owner_type` in `('lead', 'client', 'event')`** (`supabase/migrations/20260716100200_timeline_activities.sql`, widened by `20260717100100_notes_timeline_client_owner_type.sql` and `20260718100300_notes_timeline_event_owner_type.sql`)
Shared by Leads, Clients, and Events — one polymorphic, append-only table (`owner_type` + `owner_id`). Every entry is written through one shared mechanism (`recordTimelineActivity` in mock mode, `insertTimelineActivity` per-repository in Supabase mode), never constructed by hand — see `docs/workflows.md`. The live Supabase table's `owner_type` CHECK constraint allows `'lead'`, `'client'`, and `'event'`, and its `type` CHECK constraint allows the 8 Lead activity types plus `lead_converted`, the 7 Client activity types, and the 13 Event/Checklist/Schedule activity types (`event_created`, `event_updated`, `lifecycle_stage_changed`, `priority_changed`, `checklist_item_created`, `checklist_item_completed`, `checklist_template_applied`, `schedule_item_created`, `schedule_item_updated`, `event_archived`, `event_restored`, `event_cancelled`, `event_completed`). Both constraints widen per module as each one's own migration phase adds real Supabase-backed activity.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces — see "Polymorphic ownership" below for why every read/write scopes by this in addition to owner_type/owner_id |
| owner_type | enum | `lead`, `client`, `event`, `contract` |
| owner_id | uuid | references leads.id, clients.id, events.id, or contracts.id, depending on owner_type — **not** a database-enforced FK; see below |
| type | enum | `lead_created`, `lead_updated`, `status_changed`, `note_added`, `note_pinned`, `note_unpinned`, `welcome_guide_sent`, `lead_archived`, `lead_converted`, `client_created`, `client_updated`, `tags_changed`, `vip_status_changed`, `communication_preference_changed`, `client_archived`, `client_restored`, `event_created`, `event_updated`, `lifecycle_stage_changed`, `priority_changed`, `checklist_item_created`, `checklist_item_completed`, `checklist_template_applied`, `schedule_item_created`, `schedule_item_updated`, `event_archived`, `event_restored`, `event_cancelled`, `event_completed`, `contract_created`, `contract_updated`, `contract_sent`, `contract_viewed`, `contract_signed`, `contract_declined`, `contract_cancelled`, `contract_completed`, `contract_archived`, `contract_restored` |
| description | text | human-readable summary |
| actor | text | who/what performed the action |
| timestamp | timestamptz | |
| metadata | jsonb | nullable — e.g. `{ from, to }` on a status change, `{ client_id }` on conversion |

#### Polymorphic ownership: no normal foreign key is possible

`notes.owner_id`, `timeline_activities.owner_id`, `checklist_items.owner_id`, and `schedule_items.owner_id` each point at one of several possible target tables depending on the row's `owner_type` — a single column referencing more than one target table. Postgres (and Supabase) cannot express that as one `FOREIGN KEY` constraint; a normal FK targets exactly one table. This is a deliberate tradeoff to avoid duplicating the same architecture per owner type (`lead_notes`/`client_notes`/`event_notes`/`contract_notes`, `event_checklist_items`/`employee_checklist_items`/etc.) as more owner types are added — `checklist_items` and `schedule_items` were built polymorphic from the start specifically so Team Management, Vendors, Inventory, and Vehicles can adopt them later without a schema change, not just Events; `notes`/`timeline_activities` gained `contract` as a fourth `owner_type` value for the same reason (Contracts reuse the shared architecture rather than introducing a dedicated `contract_notes` table — see `docs/workflows.md`).

Because referential integrity and workspace isolation can't be guaranteed by a FK here, both are enforced elsewhere instead:

- **Data layer:** every read/write (mock or Supabase) derives `workspace_id` from the owning record and filters by `workspace_id` **and** `owner_type`/`owner_id` together — never `owner_id` alone. A note, timeline, checklist, or schedule row is only ever reachable through its actual owner's own workspace.
- **Supabase RLS (live for `leads`/`clients`/`events`/`checklist_items`/`event_schedule_items`/`notes`/`timeline_activities`):** `is_workspace_member(workspace_id)` gates every policy — see `docs/permissions.md`. A `CHECK` constraint validates `owner_type IN ('lead', 'client', 'event')` today (widening per module as each migrates), but the owner row's actual existence isn't independently re-validated by policy logic or a trigger in this phase — the data layer's own "fetch the owner first, derive `workspace_id` from it" discipline is what keeps a note/timeline row's `owner_id` honest, not the database. Tightening this (e.g., a trigger validating `owner_id` exists in the table named by `owner_type`) is a documented future improvement, not yet built.

Checklist assignment (`assigned_type`/`assigned_id`/`assigned_name`) is a second, smaller instance of the same pattern, prepared ahead of the Employee/Vendor modules that will eventually populate `assigned_id` for real.

### `clients` — **live** (`supabase/migrations/20260717100000_clients.sql`)
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

Indexes (`supabase/migrations/20260717100400_clients_indexes_and_constraints.sql`): `(workspace_id)`, `(workspace_id, internal_status)`, `(workspace_id, created_at desc)`, a partial `(workspace_id, is_vip) where is_vip = true`, a `gin` index on `tags`, and `(originating_lead_id)`.

#### Lead → Client conversion — **live** (`supabase/migrations/20260717100500_lead_to_client_conversion.sql`)

`leads.converted_client_id` now carries a real `FOREIGN KEY` → `clients.id` (added in this migration, once `clients` existed to reference — it was a bare nullable `uuid` before). `clients.originating_lead_id` carries a `UNIQUE` constraint (nulls are distinct in Postgres, so any number of directly-created Clients with no originating Lead are unaffected) — a database-level guarantee that a second Client can never point at the same converted Lead.

Conversion itself is a single Postgres function, `public.convert_lead_to_client(p_lead_id uuid, p_actor text) returns jsonb`, called via `supabase.rpc(...)` from `lib/data/conversion/supabaseConversionRepository.ts`:

- `security invoker` (the default, not `security definer`) — every statement inside the function runs with the calling user's own privileges, so RLS on `leads`, `clients`, and `timeline_activities` still applies exactly as if the caller had issued those statements directly. No `service_role` is needed or used.
- `select ... for update` locks the Lead row for the function's implicit transaction, so a concurrent duplicate-conversion attempt blocks until the first commits, then observes `status = 'converted'` and is rejected — this is what makes duplicate-conversion prevention atomic rather than a check-then-act race, on top of the `UNIQUE` constraint above.
- Rejects (via `raise exception ... using errcode = 'P0001'`, surfaced by the repository as a `DataResult` failure, not a thrown error) a not-found Lead, an already-converted Lead, or an **archived** Lead. Any rejection rolls back everything the function has done so far — a Postgres function body is always one transaction — so a rejected conversion never leaves a half-created Client or a partially-updated Lead behind.
- Field-copy semantics mirror `modules/leads/services/LeadConversionService.ts` (the mock implementation, left untouched — mock mode still uses it via `lib/data/conversion/mockConversionRepository.ts`) exactly: only `workspace_id`, `first_name`, `last_name`, `email`, `phone`, `instagram`, and `source` are copied from the Lead; every other Client field defaults (`internal_status = 'active'`, `is_returning = false`, `tags = '{}'`, all preference/relationship fields null/false). No Event is created.
- Records exactly two `timeline_activities` rows: `lead_converted` on the Lead (`metadata: { client_id }`) and `client_created` on the Client (`metadata: { originating_lead_id }`).

`lib/data/conversion/` holds this pair (`mockConversionRepository.ts` / `supabaseConversionRepository.ts`) behind the same `selectRepository()` pattern as every other module — it lives in its own directory rather than under `leads/` or `clients/` since it spans both.

### `events` — **live** (`supabase/migrations/20260718100000_events.sql`)
The operational center of BloomOS — the record tying a Client to a specific engagement, carrying its own independent status and lifecycle_stage state machines (`core/workflows/eventWorkflow.ts`; the earlier `lead`/`consultation`/.../`completed` single-stage model below in `docs/workflows.md` predates this and is superseded by the two-state-machine design — see the note under "MVP note on stage coverage"). `start_time`/`end_time` are stored as plain `text` ("HH:MM"), not a Postgres `time` type — the app does its own lexicographic string comparison and expects to read back exactly the string it wrote.

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

### `checklist_items` — **live for `owner_type = 'event'`** (`supabase/migrations/20260718100100_checklist_items.sql`)
Reusable across owner types the same way `notes`/`timeline_activities` are — `owner_type` + `owner_id`, not Event-specific, even though "event" is the only real owner today. See "Polymorphic ownership" below. Unlike `notes`/`timeline_activities`, rows here ARE physically deleted (`deleteChecklistItem`) — the "can't delete a completed item" rule is a data-layer check, not a database constraint, same division of responsibility as every other business rule in this schema.

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

### `schedule_items` — live table named `event_schedule_items` (`supabase/migrations/20260718100200_event_schedule_items.sql`)
The day-of run-of-show. Generalized the same way as `checklist_items` — `owner_type` + `owner_id` instead of a plain `event_id` — so Employee/Vendor/Inventory/Vehicle/Client schedules can reuse this table later without a redesign. The live Postgres table is named `event_schedule_items`, not `schedule_items` — chosen so a future generic (non-Event) schedule table could exist as plain `schedule_items` without a collision; the TS domain type stays `EventScheduleItem` and the mock store stays `lib/data/mock/scheduleStore.ts`, both unchanged. Like `checklist_items` (and unlike `notes`/`timeline_activities`), rows here are physically deleted (`deleteScheduleItem`) — with no completed-item delete guard, unlike checklist items.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | `lead`, `client`, `event` (shared `EntityType`) — only `event` populated today |
| owner_id | uuid | references the owning row — **not** a database-enforced FK; see "Polymorphic ownership" |
| title | text | |
| description | text | nullable |
| start_time / end_time | text | nullable — "HH:MM", same rationale as `events.start_time`/`end_time` above |
| location | text | nullable |
| assigned_to | text | nullable — free-text; not generalized to assigned_type/id/name (only `checklist_items` assignment was, per the refinement scope) |
| category | enum | `arrival`, `delivery`, `setup`, `vendor`, `client`, `surprise`, `ceremony`, `photography`, `video`, `food_beverage`, `cleanup`, `departure`, `other` |
| status | enum | `planned`, `confirmed`, `completed`, `delayed`, `cancelled` |
| sort_order | integer | |
| created_at / updated_at | timestamptz | |

#### Default checklist template application — **live** (`supabase/migrations/20260718100700_apply_default_event_checklist.sql`)

`public.apply_default_event_checklist(p_event_id uuid, p_items jsonb, p_description text, p_actor text) returns jsonb` — the Supabase equivalent of the mock's internal `applyDefaultChecklistTemplate()`. Inserts every template item and records exactly one summarized `checklist_template_applied` timeline entry as a single atomic operation (Postgres function bodies are always one transaction), called via `supabase.rpc(...)` from `lib/data/events/supabaseRepository.ts` only when `DEFAULT_CHECKLIST_TEMPLATES` has an entry for the new Event's `event_type` — exactly like the mock's `createEvent()`. `security invoker` (not `security definer`), the same rationale as `convert_lead_to_client`: every insert is still checked against the caller's own `checklist_items`/`timeline_activities` RLS policies, no `service_role` needed. Item validation (`checklistItemSchema`) happens in TypeScript before the RPC is ever called, mirroring the mock's "validate everything first, write nothing on failure" behavior — the function itself does not re-validate.

### `media_assets` — **live for `owner_type` in `('lead', 'client', 'event')`** (`supabase/migrations/20260719100000_media_assets.sql`)

The Shared Media Library — a single, generic, polymorphic attachment system every module (current and future) attaches files through via `owner_type`/`owner_id`, the same shape as `notes`/`timeline_activities`/`checklist_items`. Deliberately independent of the `documents` table below: this table represents **storage objects only** (name, MIME type, size, checksum, storage location, version) and carries **no business-specific fields** — no category, folder, visibility, or workflow status. `document` is one of this table's supported owner types (a future Document row can own attached media), not the other way around — a future Documents migration is expected to become a consumer of this table for its actual file storage, rather than owning `storage_*`/`checksum`/version columns itself the way the mock-only design below still does.

Versioning is **in-place**, not a row chain: `replaceMediaAssetVersion` updates the same row's `version`/`checksum`/`file_size`/`mime_type` rather than inserting a new row. The storage path embeds the version number (`{workspace_id}/{owner_type}/{owner_id}/{media_asset_id}/v{version}/{stored_filename}`), so a prior version's bytes are never overwritten in Storage even though only the latest metadata row is kept. Soft delete only (`archived_at`), reversible via `restoreMediaAsset` — no `deleted_at`, no physical `DELETE` from the app.

Checksums are real SHA-256 digests of actual file bytes (`src/lib/media/checksum.ts`, Web Crypto `crypto.subtle`), unlike the `documents` table's older placeholder hash below. `width`/`height` are populated by a best-effort image-dimension-detection hook (`src/lib/media/imageMetadata.ts`) that fails soft (`null`) for non-images or unsupported environments; `duration` and image optimization are reserved fields/hooks, not populated yet — see "Future extensions" below.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | `lead`, `client`, `event` — only these have a live parent table; see "Future extensions" |
| owner_id | uuid | references the owning row — **not** a database-enforced FK; see "Polymorphic ownership" above |
| original_filename | text | as uploaded, unnormalized |
| stored_filename | text | normalized, storage-safe (lowercased extension, unsafe characters stripped) |
| storage_bucket | text | always `media-assets` today — a dedicated bucket, not the `documents` bucket (see `docs/permissions.md`) |
| storage_path | text | `{workspace_id}/{owner_type}/{owner_id}/{media_asset_id}/v{version}/{stored_filename}` |
| mime_type | text | |
| extension | text | lowercase, no dot |
| file_size | bigint | bytes; `> 0` |
| checksum | text | `sha256:<hex>` |
| width / height | integer | nullable — image dimensions, best-effort |
| duration | numeric | nullable — reserved for future video/audio duration detection |
| version | integer | `> 0`, default `1`; incremented in place by `replaceMediaAssetVersion` |
| uploaded_by | uuid | nullable, FK → `auth.users` |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable — soft delete, reversible |

#### Future extensions (additive, not built)

Confirmed against every future capability requested for this foundation — none require changing this table's existing columns, only new nullable columns or new companion tables added later:

- **Folder organization** — a future `media_folders` table + a nullable `folder_id` column.
- **Image galleries / attachment ordering** — a future nullable `sort_order` column.
- **Derived previews/thumbnails** — a future nullable `parent_media_asset_id` self-reference (+ optional `derived_kind`); a thumbnail is just another `media_assets` row.
- **Storage quotas** — `workspace_id` + `file_size` already support `SUM(file_size) WHERE workspace_id = X AND archived_at IS NULL` today; a future formal quota is a separate `workspace_storage_quotas` table.
- **AI indexing/search** — a future nullable generated `tsvector` column, or a separate `media_asset_embeddings` table keyed on `id`.
- **File version history** — the storage path already preserves every prior version's bytes (see above); every upload/replace/archive/restore also logs a Timeline entry against the owning entity (`media_asset_uploaded`/`media_asset_version_replaced`/`media_asset_archived`/`media_asset_restored`, with old/new checksum and version in `metadata`), giving a durable audit trail a future `media_asset_versions` table could even be backfilled from.
- **Multiple attachments per record, drag-and-drop uploads, bulk uploads** — already supported today (no schema or repository change needed): nothing enforces one row per `(owner_type, owner_id)`, and uploads operate on one `Blob` regardless of how the UI collects it.

### `contracts` — **live** (`supabase/migrations/20260720100100_contracts.sql`)
Closes the commercial cycle: Lead -> Client -> Event -> Contract -> Invoice (future) -> Payments (future). Reusable across every Workspace — nothing here is designed around a single business. `client_id` is required; `event_id` is deliberately nullable — a Contract can stand on its own (e.g. a retainer) ahead of or without a dedicated Event record. Replaces the earlier draft/sent/signed/cancelled sketch below with the actual shipped model (`core/workflows/contractWorkflow.ts`).

Fourth business module migrated to Supabase — same repository pattern as Leads/Clients/Events (`lib/data/contracts/`), bundling Contracts, Contract Templates, Contract Exhibits, and Contract Notes/Timeline into one repository pair. Invoices/Payments/Expenses/Documents remain entirely mock-only; see "Supabase-specific notes" below for the resulting known limitation.

`status` and `signature_status` are two independent state machines, the same pattern as `events.status`/`events.lifecycle_stage` — `status` is the contract's overall commercial lifecycle; `signature_status` is specifically about the e-signature process and can reach `partially_signed`, a state `status` has no equivalent for. Neither is inferred from the other.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| client_id | uuid | FK → clients — **required** |
| event_id | uuid | nullable FK → events |
| template_id | uuid | nullable FK → contract_templates |
| contract_number | text | workspace-scoped and generated uniquely (`CT-{year}-{sequence}`); a real unique index (`contracts_workspace_number_unique`) is the durable collision guarantee in Supabase mode — see "Contract numbering" below |
| title | text | |
| description | text | nullable |
| status | enum | `draft`, `review`, `ready`, `sent`, `viewed`, `signed`, `completed`, `expired`, `cancelled`, `archived`, `declined` — `core/enums/contractStatus.ts`; `sent`/`viewed`/`signed`/`completed`/`expired`/`cancelled`/`archived`/`declined` are reachable only via their own dedicated data-layer action, never the plain status setter; only `draft`/`review`/`ready` remain freely inter-transitionable through it |
| signature_status | enum | `unsigned`, `sent`, `viewed`, `partially_signed`, `signed`, `declined`, `expired`, `cancelled` — `core/enums/signatureStatus.ts` |
| version | integer | starts at 1, incremented on every content edit (`updateContract`) |
| version_history | jsonb | array of `{ version, title, description, total_value, deposit_amount, recorded_at }` snapshots taken immediately before each edit overwrites them — the model's minimal version history; no separate versions table. Preserved exactly in Supabase mode as a `jsonb` column (not a separate table) — see "Version history" below |
| effective_date / expiration_date | date | nullable |
| signed_at / sent_at / viewed_at / declined_at / cancelled_at / archived_at | timestamptz | nullable, set by their respective dedicated action |
| total_value | numeric | nullable |
| deposit_required | boolean | |
| deposit_amount | numeric | nullable — required when `deposit_required` is true, forbidden otherwise (schema-enforced) |
| remaining_balance | numeric | nullable — derived as `total_value - deposit_amount` on every create/update, not independently editable |
| currency | text | 3-letter code, uppercased |
| notes | text | nullable — plain internal free-text field (mirrors `events.internal_summary`), separate from the shared `notes` table a Contract also owns via `owner_type = 'contract'` |
| created_at / updated_at | timestamptz | |

### `contract_templates` — **live, read-only** (`supabase/migrations/20260720100000_contract_templates.sql`)
A reusable contract body a Contract can be created from. Workspace-scoped, reusable across Workspaces. No editor, HTML rendering, or PDF generation exists yet — `body` is plain text containing `{{merge_field}}` placeholders (see "Merge fields" below); nothing parses or renders them yet. Created before `contracts` in migration order since `contracts.template_id` references it. RLS grants **select only** — no insert/update/delete policy exists, since the current public API has no create/update path; the migration deliberately seeds no rows.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| name | text | |
| description | text | nullable |
| category | enum | `event_agreement`, `vendor_agreement`, `rental_agreement`, `photography_release`, `venue_rental`, `custom`, `other` — `core/enums/contractTemplateCategory.ts` |
| body | text | plain text with `{{merge_field}}` placeholders |
| version | integer | |
| active | boolean | inactive templates are excluded when `activeOnly` is requested; still readable individually |
| created_at / updated_at | timestamptz | |

### `contract_exhibits` — **live** (`supabase/migrations/20260720100200_contract_exhibits.sql`)
A named attachment/appendix to a Contract (e.g. Payment Schedule, Cancellation Policy, Rental Terms, Damage Waiver, Photo Release, Custom Attachment) — model support only this phase; no real file upload here (`document_id` stays a null placeholder — the future Media Library integration, `docs/database.md`'s `media_assets` section, is expected to populate it). Locking enforcement for closed/signed Contracts is a UI-layer concern, not replicated as a data-layer or DB constraint — same division of responsibility as `checklist_items`/`event_schedule_items`.

Unlike the polymorphic tables (`notes`/`timeline_activities`/`checklist_items`), this is a true single-parent child of `contracts` — `contract_id` is a real, non-polymorphic foreign key (`on delete cascade`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces — carried redundantly (not derived only through `contract_id`) so RLS can gate on it directly without a join, same pattern as `checklist_items`/`event_schedule_items` |
| contract_id | uuid | FK → contracts, `on delete cascade` |
| title | text | |
| description | text | nullable |
| display_order | integer | |
| document_id | uuid | nullable — placeholder for the future Media Library integration; always null today |
| created_at / updated_at | timestamptz | |

Rows here ARE physically deleted (`deleteContractExhibit`) — same precedent as `checklist_items`/`event_schedule_items`.

#### Contract numbering — live

`public.generate_contract_number(p_workspace_id uuid) returns text` (`supabase/migrations/20260720100700_generate_contract_number_function.sql`) proposes the next workspace-scoped `CT-{year}-{sequence}` number using the same algorithm as the mock's `generateContractNumber()`. `security invoker` — the SELECT inside is still governed by the caller's own `contracts` RLS policy. The function only *proposes* a candidate; the durable collision guarantee is the `contracts_workspace_number_unique` unique index (`workspace_id`, `contract_number`) from `20260720100500_contracts_indexes_and_constraints.sql` — `lib/data/contracts/supabaseRepository.ts` retries generation+insert (up to 5 attempts) on a `23505` unique-violation, so concurrent requests can never persist duplicate numbers.

#### Version history — live

Preserved exactly as designed in the mock — `contracts.version_history` is a `jsonb` array column, not a separate table. `updateContract` appends a pre-image snapshot and increments `version` on every call in both mock and Supabase mode; no redesign.

#### Merge fields

`modules/contracts/mergeFields.ts` is the centralized registry of `{{key}}` placeholders a `contract_templates.body` may reference: `client_name`, `partner_name`, `event_date`, `event_location`, `contract_total`, `deposit_amount`, `remaining_balance`, `workspace_name`. Architecture only — nothing parses a template or substitutes a value yet; this exists so a future renderer and template editor share one list of valid fields instead of each re-deciding what a placeholder means.

### Money model

Every persisted monetary value across `invoices`/`payments`/`expenses` is an **integer minor-unit amount** (e.g. $1,250.00 is stored as `125000`), never a float — floats can't represent currency exactly and drift across repeated arithmetic. `lib/money.ts` is the single place this arithmetic happens (`formatMoney`, `calculateBalance`, `calculatePercentage`, safe `addMinor`/`subtractMinor`/`sumMinor`); no other module computes money totals ad hoc. `MINOR_UNIT_EXPONENT` (currently 2, i.e. cents) is centralized so a future 0- or 3-decimal currency only needs one constant changed. `contracts.total_value`/`contracts.deposit_amount` predate this model and remain plain major-unit numbers — every Finance summary that folds a Contract value into a `*_minor` total converts it through `majorToMinor()` rather than assuming it's already minor-unit; this is a known, deliberate seam, not an oversight.

### `invoices`
Continues the commercial cycle a Contract closes: Lead → Client → Event → Contract → Invoice → Payments → Expenses → Profit. `client_id` is required; `event_id` and `contract_id` are both nullable — a standalone Invoice (e.g. a one-off transaction with no Event or Contract on record) is legitimate. When set, `event_id`/`contract_id` must belong to the same `client_id` and `workspace_id` (data-layer validated).

Unlike `contracts.status`, there is no plain status setter — every non-`draft` value is reached through its own dedicated data-layer action (`issueInvoice`, `sendInvoice`, `markInvoiceViewed`, `markInvoiceOverdue`, `voidInvoice`, `archiveInvoice`, `restoreInvoice`) or automatically when a successful Payment is applied (`partially_paid`/`paid` — see `applyPaymentToInvoice` in `lib/data/index.ts`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| client_id | uuid | FK → clients — **required** |
| event_id | uuid | nullable FK → events |
| contract_id | uuid | nullable FK → contracts |
| invoice_number | text | workspace-scoped and generated uniquely (`INV-{year}-{sequence}`), collision-checked on every creation/duplication |
| title | text | |
| description | text | nullable |
| status | enum | `draft`, `issued`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `voided`, `archived` — `core/enums/invoiceStatus.ts` / `core/workflows/invoiceWorkflow.ts` |
| issue_date / due_date | date | nullable |
| subtotal_minor / tax_minor / discount_minor | integer | minor units; `discount_minor` cannot exceed `subtotal_minor` (schema-enforced) |
| total_minor | integer | derived as `subtotal_minor + tax_minor - discount_minor` on every create/update, not independently editable |
| paid_minor / balance_minor | integer | derived by `applyPaymentToInvoice` from every linked, currently-counting Payment (net of refunds) each time one changes — never written directly by a caller |
| currency | text | 3-letter code, uppercased |
| notes | text | nullable — plain internal free-text field, separate from the shared `notes` table an Invoice also owns via `owner_type = 'invoice'` |
| sent_at / viewed_at / paid_at / overdue_at / voided_at / archived_at | timestamptz | nullable, set by their respective dedicated action |
| created_at / updated_at | timestamptz | |

### `payments`
A single money movement — collected from a Client (`deposit`, `installment`, `final_payment`, `full_payment`, `retainer`) or paid back to one (`refund`, `reimbursement`, `adjustment`). `invoice_id` is nullable: a Payment may exist without an Invoice (e.g. a deposit collected before one is issued, or a standalone cash transaction), but always belongs to a `client_id` and `workspace_id`. When `invoice_id` is set, workspace/client consistency is validated and a `succeeded` Payment updates that Invoice's `paid_minor`/`balance_minor`/`status` through `applyPaymentToInvoice` — never written directly.

`amount_minor` is always positive, including for `payment_type: "refund"` rows — see "Refund model" below. **Never stores card numbers, bank account numbers, or any other sensitive payment credential** — `reference` is a free-text field for a check number, provider transaction id, or similarly non-sensitive identifier only. No payment-provider (Stripe/Square/PayPal/bank) integration exists; `payment_method` values are labels only.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| invoice_id | uuid | nullable FK → invoices |
| client_id | uuid | FK → clients — **required** |
| event_id | uuid | nullable FK → events |
| contract_id | uuid | nullable FK → contracts |
| payment_type | enum | `deposit`, `installment`, `final_payment`, `full_payment`, `retainer`, `reimbursement`, `refund`, `adjustment`, `other` — `core/enums/paymentType.ts` |
| status | enum | `pending`, `processing`, `succeeded`, `failed`, `partially_refunded`, `refunded`, `cancelled` — `core/enums/paymentStatus.ts` / `core/workflows/paymentWorkflow.ts`. Only `succeeded`/`partially_refunded`/`refunded` count toward an Invoice's paid total (the money actually collected net of what's since gone back) |
| payment_method | enum | `cash`, `check`, `bank_transfer`, `ach`, `credit_card`, `debit_card`, `zelle`, `venmo`, `paypal`, `stripe`, `square`, `other` — `core/enums/paymentMethod.ts`; labels only, no provider connected |
| amount_minor | integer | minor units, always positive |
| currency | text | 3-letter code |
| reference | text | nullable — non-sensitive identifier only (check number, provider transaction id) |
| transaction_date | date | |
| received_at / failed_at / refunded_at | timestamptz | nullable, set by their respective dedicated action |
| notes | text | nullable |
| document_id | uuid | nullable — placeholder for the future Documents module (a payment confirmation or receipt); always null today |
| created_at / updated_at | timestamptz | |

#### Refund model

Refunds are represented as an ordinary `payments` row with `payment_type = "refund"` rather than a second ledger — one authoritative approach, not two competing ones. `refundPayment(originalPaymentId, amountMinor)` creates this new row (status `succeeded` immediately, `amount_minor` always positive) and moves the *original* Payment's own `status` to `partially_refunded` or `refunded` depending on whether anything refundable remains. The refundable ceiling is the original Payment's `amount_minor` minus every prior refund already issued against it (tracked via `reference`, since a refund has no dedicated foreign key back to the Payment it refunds) — requesting more than that fails outright. If the original Payment was linked to an Invoice, that Invoice is recomputed through `applyPaymentToInvoice` immediately, so its `paid_minor`/`balance_minor`/`status` reflect the refund without a separate step.

### `expenses`
A cost the business incurs — Event-specific (`event_id` set), a general business expense (`event_id`/`client_id` both null), or supplier/team-related. `supplier_id` and `team_member_id` are forward-looking placeholders only — no Supplier or Team module exists yet, so neither is validated against a real table.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| event_id | uuid | nullable FK → events |
| client_id | uuid | nullable FK → clients |
| contract_id | uuid | nullable FK → contracts |
| supplier_id | uuid | nullable — placeholder; future Supplier module, unvalidated today |
| team_member_id | uuid | nullable — placeholder; future Team module, unvalidated today |
| category | enum | `decor`, `flowers`, `rentals`, `venue`, `photography`, `video`, `food_beverage`, `transportation`, `printing`, `supplies`, `inventory`, `team_payroll`, `supplier_payment`, `marketing`, `software`, `insurance`, `taxes`, `fees`, `travel`, `refund`, `reimbursement`, `miscellaneous` — `core/enums/expenseCategory.ts` |
| status | enum | `planned`, `approved`, `due`, `paid`, `reimbursed`, `cancelled`, `archived` — `core/enums/expenseStatus.ts` / `core/workflows/expenseWorkflow.ts` |
| description | text | |
| amount_minor | integer | minor units, always positive |
| currency | text | 3-letter code |
| transaction_date | date | |
| due_date | date | nullable |
| paid_at / reimbursed_at | timestamptz | nullable, set by their respective dedicated action |
| reimbursable | boolean | marks an Expense a team member or supplier fronted and expects to be paid back for — distinct from `status: "reimbursed"`, which is *whether* that reimbursement has actually happened |
| reference | text | nullable |
| notes | text | nullable |
| document_id | uuid | nullable — placeholder for the future Documents module (a receipt or reimbursement proof); always null today |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable |

### `documents`

The single shared file system for BloomOS — every module (Client, Event, Contract, Contract Exhibit, Invoice, Payment, Expense, and the Workspace itself) attaches files through this one polymorphic table rather than a per-module upload system. **Phase 1 is metadata only**: `storage_provider`/`storage_bucket`/`storage_path` describe where a real file would live, but no binary upload, base64 content, or real storage connection exists yet — every row today has `storage_provider = 'mock'`. See `docs/integrations.md` for the planned Supabase Storage integration and `lib/documentFile.ts` for the centralized file-name/size/path rules.

`owner_type`/`owner_id` is the authoritative owner (same polymorphic pattern as `notes`/`timeline_activities` — see "Polymorphic ownership" above), practically restricted to `workspace`, `client`, `event`, `contract`, `invoice`, `payment`, `expense` today (`supplier`, `inventory_item`, `team_member` are reserved for future modules and not yet real `owner_type` values). The seven typed reference columns (`contract_exhibit_id` … `expense_id`) are for cross-module navigation/lookup only — e.g. "every Document referencing this Invoice" — and never replace or duplicate `owner_type`/`owner_id`.

**Versioning** is a `parent_document_id` + `version` chain, not a snapshot array like `contracts.version_history`: the first version of a file is its own chain root (`parent_document_id = null`, `version = 1`); every later version's `parent_document_id` points at that same root. Exactly one row in a chain has `is_latest_version = true` at any time — `createDocumentVersion` (`lib/data/index.ts`) is the only place that invariant is written: it marks the prior latest version `superseded` and writes both rows in a single batch, so a reader never observes a moment with zero or two "latest" versions. A version's `title`/`visibility`/`expires_at` may be overridden per version; `category` cannot — a chain always keeps the category its first version was uploaded with.

**Soft deletion**: `status = 'deleted'` (with `deleted_at` set) never physically removes the row, the same reversibility precedent as Clients/Events/Contracts.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | practically `workspace`, `client`, `event`, `contract`, `invoice`, `payment`, `expense` (see above) |
| owner_id | uuid | references the table named by `owner_type` — **not** a database-enforced FK; see "Polymorphic ownership" above |
| folder_id | uuid | nullable FK → document_folders — must belong to the same `owner_type`/`owner_id` as this Document |
| title | text | user-facing name; auto-generated from `file_name` when not supplied |
| description | text | nullable |
| category | enum | `contract`, `signed_contract`, `exhibit`, `proposal`, `invoice`, `receipt`, `payment_confirmation`, `expense_receipt`, `reimbursement_proof`, `moodboard`, `inspiration`, `floor_plan`, `event_schedule`, `checklist`, `photo`, `video`, `identification`, `insurance`, `license`, `tax`, `policy`, `waiver`, `report`, `internal`, `other` — `core/enums/documentCategory.ts` |
| status | enum | `draft`, `active`, `superseded`, `expired`, `archived`, `deleted` — `core/enums/documentStatus.ts` / `core/workflows/documentWorkflow.ts` |
| visibility | enum | `internal`, `client`, `team`, `client_and_team`, `restricted` — `core/enums/documentVisibility.ts`. **Metadata only** — no authentication or access enforcement reads it yet; see `docs/permissions.md` |
| file_name | text | normalized (safe-character, lowercase-extension) system file name |
| original_file_name | text | the file name as originally given, unnormalized |
| file_extension | text | lowercase, no dot; must be in the allowed list (see below) |
| mime_type | text | validated for consistency with `file_extension` where practical |
| size_bytes | integer | positive; validated against a per-file-type limit (see below) |
| storage_provider | enum | `mock`, `supabase`, `s3`, `local`, `other` — `core/enums/storageProvider.ts`. Always `mock` today |
| storage_bucket | text | placeholder bucket name; no real bucket exists |
| storage_path | text | architecture only — always relative (no leading `/`) and free of `..` traversal |
| checksum | text | nullable — a deterministic placeholder derived from file name + size (`calculateMockChecksum`), not a hash of real file bytes, since none exist yet |
| version | integer | starts at 1 for a chain root |
| is_latest_version | boolean | exactly one `true` per version chain |
| parent_document_id | uuid | nullable — null for a chain root, otherwise the chain root's id |
| contract_exhibit_id / event_id / client_id / contract_id / invoice_id / payment_id / expense_id | uuid | all nullable — typed cross-references, see above |
| uploaded_by | text | nullable — actor name; becomes a real FK once auth exists |
| uploaded_at | timestamptz | |
| expires_at | timestamptz | nullable; when set, must be after `uploaded_at` |
| archived_at / deleted_at | timestamptz | nullable, set by `archiveDocument`/`softDeleteDocument` |
| created_at / updated_at | timestamptz | |

**File limits** (`lib/documentFile.ts`): allowed extensions are `pdf`, `doc`, `docx`, `xls`, `xlsx`, `csv`, `txt`, `jpg`, `jpeg`, `png`, `webp`, `heic`, `mp4`, `mov`, `zip`. `exe`, `dmg`, `pkg`, `app`, `js`, `sh`, `bat`, `cmd` are explicitly blocked regardless of MIME type. Size limits by category: images 25MB, PDFs 50MB, office documents 50MB, videos 500MB, archives 100MB, fallback 25MB.

### `document_folders`

A named container Documents can be filed into, scoped to a single `owner_type`/`owner_id` (a folder never spans multiple owners — the same owner the Documents inside it have). Folders nest via `parent_folder_id`; a root-level folder has `parent_folder_id = null`. `core/workflows/documentFolderWorkflow.ts` centralizes cycle prevention (`wouldCreateFolderCycle`) and cross-Workspace/cross-owner move rules (`canMoveFolder`) — a folder can never become its own ancestor, and `moveDocumentFolder` refuses to move a folder to a different Workspace or owner. Archiving (`archived_at`) is shallow — it does not cascade to child folders or the Documents inside.

Reusable folder-name templates (`modules/documents/constants/folderTemplates.ts`, one each for Client/Event/Contract/Finance) can be applied on demand via `applyDefaultFolderTemplate()` — never auto-created globally. Application is one atomic batch operation: every folder name is validated first, the whole batch is written in a single call, and exactly one summarized `document_folder_template_applied` Timeline entry is recorded on the owner's own timeline — not one `document_folder_created` entry per generated folder, the same atomicity precedent as `checklist_template_applied`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | same practical set as `documents.owner_type` |
| owner_id | uuid | references the table named by `owner_type` — not a database-enforced FK |
| parent_folder_id | uuid | nullable FK → document_folders (self-referential) |
| name | text | |
| description | text | nullable |
| sort_order | integer | non-negative |
| visibility | enum | `internal`, `client`, `team`, `client_and_team`, `restricted` — a default new Documents in the folder may inherit at creation time, never an override of a Document's own visibility |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable |

### Derived Event financial status

`modules/finance/eventFinancialStatus.ts`'s `EventFinancialStatus` (`no_contract`, `awaiting_invoice`, `awaiting_deposit`, `deposit_partial`, `deposit_paid`, `balance_due`, `paid_in_full`, `overdue`, `refunded`, `cancelled`) is **never persisted** — it's derived on every read from an Event's Contracts/Invoices/Payments (`getEventFinancialStatus` in `lib/data/index.ts`), the same "don't store what you can compute" precedent as `contracts.remaining_balance`. It lives outside `core/enums/` deliberately: every other enum there is the intended value set of a real column; this one has no column at all.

## Relationships

```
workspaces 1—* leads
workspaces 1—* clients
workspaces 1—* events
workspaces 1—* contracts
workspaces 1—* contract_templates
workspaces 1—* invoices
workspaces 1—* payments
workspaces 1—* expenses
leads 1—* notes                    (owner_type = 'lead')
leads 1—* timeline_activities      (owner_type = 'lead')
clients 1—* notes                   (owner_type = 'client')
clients 1—* timeline_activities     (owner_type = 'client')
events 1—* notes                    (owner_type = 'event')
events 1—* timeline_activities      (owner_type = 'event')
events 1—* checklist_items          (owner_type = 'event')
events 1—* schedule_items           (owner_type = 'event')
contracts 1—* notes                 (owner_type = 'contract')
contracts 1—* timeline_activities   (owner_type = 'contract')
contracts 1—* contract_exhibits
invoices 1—* notes                  (owner_type = 'invoice')
invoices 1—* timeline_activities    (owner_type = 'invoice')
payments 1—* notes                  (owner_type = 'payment')
payments 1—* timeline_activities    (owner_type = 'payment')
expenses 1—* notes                  (owner_type = 'expense')
expenses 1—* timeline_activities    (owner_type = 'expense')
workspaces 1—* documents            (owner_type = 'workspace')
clients 1—* documents               (owner_type = 'client')
events 1—* documents                (owner_type = 'event')
contracts 1—* documents             (owner_type = 'contract')
invoices 1—* documents              (owner_type = 'invoice')
payments 1—* documents              (owner_type = 'payment')
expenses 1—* documents              (owner_type = 'expense')
documents 1—* notes                 (owner_type = 'document')
documents 1—* timeline_activities   (owner_type = 'document')
workspaces 1—* document_folders     (owner_type = 'workspace')
clients 1—* document_folders        (owner_type = 'client')
events 1—* document_folders         (owner_type = 'event')
contracts 1—* document_folders      (owner_type = 'contract')
invoices 1—* document_folders       (owner_type = 'invoice')
payments 1—* document_folders       (owner_type = 'payment')
expenses 1—* document_folders       (owner_type = 'expense')
document_folders 1—0/* documents    (document.folder_id — optional)
document_folders 1—0/* document_folders (document_folder.parent_folder_id — optional, self-referential)
document_folders 1—* notes          (owner_type = 'document_folder')
document_folders 1—* timeline_activities (owner_type = 'document_folder')
documents 1—0/* documents           (document.parent_document_id — version chain, optional)
contract_exhibits 1—0/* documents   (document.contract_exhibit_id — optional)
leads 1—0/1 clients        (via clients.originating_lead_id, and back via leads.converted_client_id — both real FKs as of the Clients migration)
clients 1—* events                  (event.client_id — required)
clients 1—* contracts               (contract.client_id — required)
clients 1—* invoices                (invoice.client_id — required)
clients 1—* payments                (payment.client_id — required)
clients 1—0/* expenses              (expense.client_id — optional)
leads 1—0/1 events                  (via events.originating_lead_id, optional)
events 1—0/* contracts              (contract.event_id — optional)
events 1—0/* invoices               (invoice.event_id — optional)
events 1—0/* payments               (payment.event_id — optional)
events 1—0/* expenses               (expense.event_id — optional)
contract_templates 1—0/* contracts  (contract.template_id — optional)
contracts 1—0/* invoices            (invoice.contract_id — optional)
contracts 1—0/* payments            (payment.contract_id — optional)
contracts 1—0/* expenses            (expense.contract_id — optional)
invoices 1—0/* payments             (payment.invoice_id — optional)
```

## Post-MVP tables (not created yet)

Anticipated, not implemented: `inventory_items`, `suppliers`, `team_members`, `event_team_assignments`, `vehicles`, `client_portal_access`, `team_portal_access`, `automations`, `automation_runs`, `emails`, `gallery_media`, `feedback`. When these ship, `checklist_items.owner_type`/`schedule_items.owner_type` and `checklist_items.assigned_type` are expected to gain `employee`/`vendor`/`inventory`/`vehicle` values rather than needing new tables — that reuse is the reason those two tables were generalized ahead of time; `documents.owner_type` is expected to gain `supplier`/`inventory_item`/`team_member` the same way. These will be specified in detail when their phase (see `ROADMAP.md`) begins. The former single `knowledge_base_articles` placeholder has been split into two separate, independent future modules — see `team_kb_articles` and `client_kb_articles` below.

### `invitations` (planned, not created)

Ahead of Client Portal/Team Portal implementation — see `docs/permissions.md`'s "Client and Team Portal invitations" section for the full flow and rules (never a temporary password; single-use Supabase Auth invitation link only) and `docs/workflows.md`'s "Invitation lifecycle" for the status state machine. Sketched here for shape only — column names/types are not final until that phase begins.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| email | text | recipient |
| name | text | recipient's display name |
| portal_type | enum | `client`, `team` — never both on one invitation |
| role | text | the role to grant on acceptance |
| permissions | jsonb | nullable — finer-grained grant beyond `role`, if needed |
| related_client_id | uuid | nullable — links to a `clients` row (Client Portal invitations); `clients` is now live, so this can be a real FK once `invitations` itself is built |
| related_team_member_id | uuid | nullable — links to a future `team_members` row (Team Portal invitations) |
| status | enum | `invited`, `sent`, `accepted`, `expired`, `revoked` — see `docs/workflows.md` |
| invited_by | uuid | FK → auth.users — the owner/admin who created the invitation |
| expires_at | timestamptz | |
| created_at / updated_at | timestamptz | |
| accepted_at / revoked_at | timestamptz | nullable |

Sending, resending, and revoking requires the Supabase Auth Admin API (`service_role`) — the one narrow, server-only exception to this codebase's "no service-role client anywhere" rule, detailed in `docs/permissions.md`.

`documents` now exists (see above) — `contract_exhibits.document_id`, `payments.document_id`, and `expenses.document_id` remain nullable placeholder columns that a real Document's id can be written into via the placeholder attachment helpers (`attachDocumentToContractExhibit`, `attachDocumentToPayment`, `attachDocumentToExpense`, and their Invoice/Event/Client counterparts) — metadata-only linking, no real binary upload. These helpers are additive: they never rewrite an existing `document_id` automatically, and no seed data populates them yet.

Future Client Portal and Team Portal access (both listed above as not-yet-implemented) are expected to read `documents.visibility`/`document_folders.visibility` once real authentication exists — see `docs/permissions.md`.

### `team_kb_articles` (planned, not created — Future Phase, after Documents)

**Team Knowledge Base** — a private, internal-only knowledge center for Amoré Bloom team members: Company Rules, Employee Handbook, Team Policies, SOPs, Decoration/Proposal-Setup/Hotel-Decoration/Luxury-Picnic procedures, Photography Guidelines, Customer Service Standards, Emergency Procedures, Cleaning Checklist, Inventory Instructions, Internal Announcements, Team Training/Video Tutorials, FAQ for Employees. This is a deliberately **independent module** — never merged into `documents` (Documents are files; this is structured, versioned, read-tracked educational content, a different concept entirely), `clients`, `contracts`, or the future `team_members` table. Reserved here for shape only; nothing below is final and nothing is implemented.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| category | text | curated set (e.g. Company Rules, SOPs, Decoration Guidelines) — not finalized |
| title | text | |
| body | text/jsonb | rich text; exact storage format (markdown vs. a structured rich-text document) not decided |
| tags | text[] | |
| status | enum | `draft`, `published` — a `draft` article is never visible to any team member regardless of role |
| featured | boolean | |
| author_id | uuid | FK → auth.users |
| version | integer | version-history mechanism (full-snapshot table vs. append-only diff) not decided |
| created_at / updated_at | timestamptz | |
| published_at | timestamptz | nullable |

Expected future companions, not designed yet: a read-tracking table (`user_id` × `article_id` × `read_at`), and image/PDF/video attachments via the existing `documents`/Storage foundation (attached to an article, never duplicating file storage). Role permissions are expected to reuse `workspace_members.role`/`has_workspace_role()` (`docs/permissions.md`), not a new permission system. Visibility: authenticated internal team members only, once real role-scoped access exists — never exposed to the future Client Portal.

### `client_kb_articles` (planned, not created — Future Phase, after Team Knowledge Base)

**Client Knowledge Base** — a self-service, client-facing knowledge base: Frequently Asked Questions, Payment/Cancellation/Rescheduling/Refund Policies, Event Preparation Guide, Welcome Guide, How the Process Works, Timeline Expectations, Contract Explanation, Delivery Information, After Your Event, Contact Information. Also an **independent module** — never merged into `documents`, `clients`, or `team_kb_articles` above (different audience, different visibility model gated by the future Client Portal, and a different feature set — voting, "related"/"popular" article surfacing — that the Team Knowledge Base has no need for).

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| category | text | curated set (e.g. FAQ, Policies, Event Preparation) — not finalized |
| title | text | |
| body | text/jsonb | rich text — same open storage-format question as `team_kb_articles` |
| status | enum | `draft`, `published` — a `draft` article is never visible to the future Client Portal |
| featured | boolean | |
| related_article_ids | uuid[] | nullable — manually curated "related articles," not computed/inferred |
| helpful_count / not_helpful_count | integer | future helpful/not-helpful voting; simple counters in this sketch, no per-user vote uniqueness designed yet |
| created_at / updated_at | timestamptz | |
| published_at | timestamptz | nullable |

Search for both modules is expected to be Postgres full-text search (`tsvector`/`to_tsquery`) over `title`/`body`, not a separate search service — consistent with this codebase's existing "no third-party service until there's a real need" posture. Visibility: clients only, gated by the future Client Portal (`docs/permissions.md`'s "Client and Team Portal invitations" section) — never available to an anonymous visitor, and never merged with the internal Team Knowledge Base above.

### Notification Center (planned, not created — Future Phase, after Client Knowledge Base, before Settings)

The intended single source of truth for every internal and external notification across BloomOS, so future modules publish events into this system rather than each implementing its own notification logic. Nothing below is final and nothing is implemented — reserved for shape only. Four tables sketched, deliberately kept separate rather than one wide table, since each has an independent lifecycle:

#### `notifications` (planned, not created)

One row per notification instance actually generated for a recipient.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| recipient_user_id | uuid | nullable FK → auth.users — internal recipient |
| recipient_client_id | uuid | nullable FK → clients — external/client recipient; exactly one of `recipient_user_id`/`recipient_client_id` set, never both |
| type | enum | `information`, `success`, `warning`, `error`, `reminder`, `announcement` |
| event_key | text | e.g. `lead_created`, `payment_received`, `contract_signed` — the internal/client event catalog, not finalized |
| title | text | |
| body | text | |
| related_entity_type | text | polymorphic, same discipline as `notes`/`timeline_activities`'s `owner_type`/`owner_id` (see "Polymorphic ownership" above) — e.g. `lead`, `client`, `contract`, `payment` |
| related_entity_id | uuid | nullable — no database-enforced FK, same rationale as every other polymorphic owner in this schema |
| deep_link | text | nullable — where the notification should navigate to when opened |
| priority | enum | not finalized |
| is_read / read_at | boolean / timestamptz | |
| is_archived / archived_at | boolean / timestamptz | soft-dismiss, distinct from delete |
| scheduled_for | timestamptz | nullable — future-dated/recurring notifications; recurrence mechanism not designed |
| created_at | timestamptz | |

#### `notification_templates` (planned, not created)

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | nullable — a workspace-level override of a global default template, if that's how templating ends up working; not decided |
| event_key | text | matches `notifications.event_key` |
| channel | enum | `in_app`, `email`, `sms`, `push`, `slack`, `discord`, `whatsapp` — not all implemented immediately |
| subject_template | text | nullable — channels without a subject (SMS, push) leave this null |
| body_template | text | |
| enabled | boolean | admin enable/disable per template |
| created_at / updated_at | timestamptz | |

#### `notification_preferences` (planned, not created)

Per-recipient, per-event, per-channel opt-in/opt-out.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| user_id | uuid | nullable FK → auth.users |
| client_id | uuid | nullable FK → clients — exactly one of `user_id`/`client_id` set, same pattern as `notifications` above |
| event_key | text | |
| channel | enum | same set as `notification_templates.channel` |
| enabled | boolean | |

#### `notification_deliveries` (planned, not created)

One row per channel-delivery attempt for a given notification — separate from `notifications` itself since one notification can fan out to multiple channels, each with its own delivery outcome.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| notification_id | uuid | FK → notifications |
| channel | enum | same set as `notification_templates.channel` |
| status | enum | `pending`, `sent`, `delivered`, `failed` — not finalized |
| attempted_at | timestamptz | |
| delivered_at | timestamptz | nullable |
| error_message | text | nullable |

**Architecture rule**: notifications are never expected to be hardcoded inside an individual module — every module is expected to publish an event (an `event_key` + related entity), and the Notification Center alone decides who receives it, which channel(s) are used, and which template renders it. This keeps notification logic centralized rather than duplicated per module, the same centralization principle already applied to Notes/Timeline (`getNotesByOwner`/`recordTimelineActivity`) and Documents (the shared file system every module attaches to) elsewhere in this schema.

### Automation Center (planned, not created — Future Phase, after Notification Center)

The intended orchestration engine of BloomOS: every business module emits events, the Automation Center listens and decides what happens automatically, and business modules never contain automation logic directly. Nothing below is final and nothing is implemented — reserved for shape only. Six tables sketched:

#### `automation_workflows` (planned, not created)

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| name | text | |
| description | text | nullable |
| trigger_event_key | text | the business-module event that starts this workflow (e.g. `lead_created`, `invoice_paid`, `contract_signed`) — same event-catalog concept as Notification Center's `event_key`, not necessarily the same catalog |
| status | enum | `draft`, `active`, `inactive` — not finalized |
| version | integer | referenced by `automation_runs.workflow_version` below, so a run can be traced to the exact workflow definition that produced it even after later edits |
| created_by | uuid | FK → auth.users |
| created_at / updated_at | timestamptz | |

#### `automation_steps` (planned, not created)

Ordered steps belonging to a workflow — the workflow model (conditions, filters, variables, delays, wait-until, branching, loops, approval steps, manual review) is not designed yet, so `config`/`conditions` are placeholders for whatever structure that ends up needing, not a final shape.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workflow_id | uuid | FK → automation_workflows |
| step_order | integer | |
| action_type | text | e.g. `create_notification`, `send_email`, `create_timeline_entry`, `assign_user`, `update_record`, `generate_document`, `webhook` — catalog not finalized |
| config | jsonb | action-specific parameters; shape undecided |
| conditions | jsonb | nullable — branching/filter logic; shape undecided |
| delay | interval | nullable |
| created_at / updated_at | timestamptz | |

#### `automation_runs` (planned, not created)

One row per workflow execution.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workflow_id | uuid | FK → automation_workflows |
| workspace_id | uuid | FK → workspaces |
| trigger_event_key | text | |
| related_entity_type / related_entity_id | text / uuid | polymorphic, same discipline as `notifications.related_entity_type`/`related_entity_id` above — no database-enforced FK |
| execution_mode | enum | `immediate`, `scheduled`, `recurring`, `manual` |
| status | enum | e.g. `pending`, `running`, `succeeded`, `failed`, `retrying` — not finalized |
| triggered_by | uuid | nullable FK → auth.users — set only for `manual` executions |
| workflow_version | integer | the `automation_workflows.version` this run executed, so later edits to the workflow never rewrite the history of a past run |
| started_at / completed_at | timestamptz | |
| duration_ms | integer | nullable |
| retry_count | integer | |
| error_message | text | nullable |

#### `automation_run_logs` (planned, not created)

Per-step log entries within a run — separate from `automation_runs` since one run has many steps, each independently loggable.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| run_id | uuid | FK → automation_runs |
| step_id | uuid | nullable FK → automation_steps |
| status | text | |
| message | text | nullable |
| logged_at | timestamptz | |

#### `automation_variables` (planned, not created)

Workflow-scoped variables referenced by steps — mechanism (how a step reads/writes one) not designed.

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workflow_id | uuid | FK → automation_workflows |
| key | text | |
| value_type | text | nullable |
| default_value | jsonb | nullable |

#### `automation_templates` (planned, not created)

Reusable workflow blueprints an Owner/Admin starts a new `automation_workflows` row from — distinct from `notification_templates` above (those are per-message templates; these are whole-workflow starting points).

| Column (sketch) | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| description | text | nullable |
| category | text | nullable |
| default_steps | jsonb | a serialized starting `automation_steps` set; shape undecided |
| created_at / updated_at | timestamptz | |

**Relationship to other modules**: the Automation Center is expected to publish to the Notification Center, Timeline, Documents, future third-party Integrations, and business modules themselves (via `update_record`/`assign_user`/pipeline-stage actions) — but it must never duplicate Notification Center's delivery logic. The Automation Center's `create_notification` action is expected to call into the Notification Center (above) exactly the same way a business module would; the Notification Center alone remains responsible for deciding channels/templates/delivery, never the Automation Center.

No payment-provider (Stripe, Square, PayPal, banks, accounting software) is connected. `payments.payment_method` values that name a provider (`stripe`, `square`, `paypal`, `credit_card`, `debit_card`) are labels only, recorded exactly like `cash`/`check`/`zelle`/`venmo` — none of them trigger a real charge, webhook, or reconciliation. `createPayment`'s initial `status` (`succeeded` for manual/bank-style methods, `pending` for card/wallet-style ones) simulates the outcome a provider round-trip would eventually produce, nothing more. **No card numbers, bank account numbers, or other sensitive payment credentials are ever stored** — `payments.reference` is a free-text field limited to non-sensitive identifiers (a check number, a provider transaction id).

## Supabase-specific notes

- **Remaining mock-only modules (Finance, Documents) still read the mock `clients`/`events`/`contracts` stores directly, not the live tables.** Finance (Invoices/Payments/Expenses — `validateContractBelongsToClient`, `createExpense`/`updateExpense`'s inline contract checks, `getEventFinancialStatus`, `getFinanceDashboardData`) and Documents (`validateDocumentOwnerAndReferences`, `attachDocumentToContractExhibit`) cross-reference Client/Event/Contract records via `readClients()`/`readEvents()`/`readContracts()` against the in-memory mock stores, unconditionally, regardless of `NEXT_PUBLIC_DATA_MODE`. In `supabase` mode this means those still-mock modules see the mock stores' seeded Clients/Events/Contracts while the Clients/Events/Contracts modules themselves (list/detail/dashboard metrics) show live Supabase data — the two can disagree until Finance/Documents get their own Supabase migrations. This is the same shape of caveat the Leads migration created for `convertLeadToClient`, then Clients/Events for Contracts/Finance/Documents, now shifted to Finance/Documents alone following the Contracts migration. One exception was fixed during the Contracts migration: `getContractFinanceSummary` (Finance-domain, but validating a Contract's own existence) now calls the repository-routed `getContract()` instead of reading the mock store directly, since — like `getEventFinancialStatus`'s Event lookup before it — that specific lookup gated the entire Contract Detail page, not just a Finance-only figure.
- Row-Level Security (RLS) is **live** for `profiles`/`workspaces`/`workspace_members` (the Supabase Foundation), `leads`/`notes`/`timeline_activities`, `clients`, `events`/`checklist_items`/`event_schedule_items`, `media_assets`, and `contracts`/`contract_templates`/`contract_exhibits` — a real Supabase project is connected (see `docs/integrations.md`). For every other table in this document (Finance, Documents, and beyond), RLS remains design-only — no migration exists for them yet. See `docs/permissions.md`.
- Enum values above are the intended constraint; whether they're implemented as Postgres `enum` types or `check` constraints is an implementation decision made at connection time, not before — except `workspace_members.role`/`status`, which are already implemented as `check` constraints in migration 4 (`supabase/migrations/20260715150300_workspace_members.sql`).
- `role`/`allowed_roles` values passed into the `has_workspace_role()` SQL helper function are plain `text`/`text[]`, not a Postgres enum — this mirrors the `check`-constraint choice above and keeps role checks a single string comparison rather than a cross-schema enum-type dependency.
