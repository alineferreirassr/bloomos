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

### `lead_notes`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| lead_id | uuid | FK → leads |
| title | text | |
| content | text | |
| category | enum | `general`, `special_request`, `preference`, `idea`, `reminder`, `problem`, `allergy`, `internal_alert` |
| priority | enum | `low`, `normal`, `high`, `critical` |
| is_pinned | boolean | pinned notes surface first on the Lead detail page |
| created_by | text | actor name; becomes a real FK once auth exists |
| created_at / updated_at | timestamptz | |

### `lead_timeline_activities`
Append-only. Every entry is written through one shared mechanism (`recordTimelineActivity`), never constructed by hand — see `docs/workflows.md`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| lead_id | uuid | FK → leads |
| type | enum | `lead_created`, `lead_updated`, `status_changed`, `note_added`, `note_pinned`, `note_unpinned`, `welcome_guide_sent`, `lead_archived`, `lead_converted` |
| description | text | human-readable summary |
| actor | text | who/what performed the action |
| timestamp | timestamptz | |
| metadata | jsonb | nullable — e.g. `{ from, to }` on a status change, `{ client_id }` on conversion |

### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| first_name | text | |
| last_name | text | |
| email | text | |
| phone | text | nullable |
| origin_lead_id | uuid | nullable FK → leads |
| is_returning | boolean | true once they have more than one event |
| created_at / updated_at / deleted_at | timestamptz | |

### `events`
The record tying a client to a specific engagement and tracking it through the lifecycle.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| client_id | uuid | FK → clients |
| title | text | e.g. "Proposal at Big Sur" |
| lifecycle_stage | enum | `lead`, `consultation`, `proposal`, `contract`, `deposit`, `planning`, `execution`, `gallery`, `feedback`, `completed` — see `docs/workflows.md` |
| event_date | date | nullable until planning confirms it |
| location | text | nullable |
| created_at / updated_at / deleted_at | timestamptz | |

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
leads 1—* lead_notes
leads 1—* lead_timeline_activities
leads 1—0/1 clients        (via clients.origin_lead_id)
clients 1—* events
events 1—0/1 contracts
contracts 1—* payments
```

## Post-MVP tables (not created yet)

Anticipated, not implemented: `inventory_items`, `suppliers`, `team_members`, `event_team_assignments`, `client_portal_access`, `automations`, `automation_runs`, `emails`, `gallery_media`, `feedback`, `knowledge_base_articles`. These will be specified in detail when their phase (see `ROADMAP.md`) begins.

## Supabase-specific notes

- Row-Level Security (RLS) is designed alongside the schema but **enabled only once Supabase is actually connected** with real credentials — see `docs/permissions.md`.
- Enum values above are the intended constraint; whether they're implemented as Postgres `enum` types or `check` constraints is an implementation decision made at connection time, not before.
