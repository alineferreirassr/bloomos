# Database

This document defines the data model for BloomOS. It is a design reference, written ahead of any live Supabase connection — no schema here has been applied to a real database yet. Terminology follows `BLOOMOS_BIBLE.md`; if they ever disagree, the Bible wins and this file gets corrected.

## Principles

- **Multi-tenant-ready, not multi-tenant-active.** Every core table carries an `organization_id` column from day one, even though the MVP runs a single tenant (Amoré Bloom). This avoids a painful retrofit later.
- **UUID primary keys** everywhere, generated server-side.
- **Timestamps on everything:** `created_at`, `updated_at` (and `deleted_at` for soft deletes where reversibility matters — e.g. Clients, Events, Contracts).
- **Status/stage as constrained enums**, not free text, so the lifecycle in `docs/workflows.md` is enforced at the data layer.
- **No business data lives only in the frontend.** Mock data during MVP development mirrors this schema exactly, so swapping in Supabase later is a data-source change, not a rewrite.

## MVP entities

### `organizations`
Reserved for multi-tenancy readiness. In the MVP, exactly one row exists (Amoré Bloom).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| created_at | timestamptz | |

### `leads`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| name | text | |
| email | text | |
| phone | text | nullable |
| source | text | how they found the business |
| status | enum | `new`, `contacted`, `qualified`, `disqualified`, `converted` |
| notes | text | nullable |
| created_at / updated_at | timestamptz | |
| converted_client_id | uuid | nullable FK → clients, set on conversion |

### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| name | text | |
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
| organization_id | uuid | FK → organizations |
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
| organization_id | uuid | FK → organizations |
| event_id | uuid | FK → events |
| status | enum | `draft`, `sent`, `signed`, `cancelled` |
| total_amount | numeric | |
| signed_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

### `payments`
Finance module: deposits and subsequent payments against a contract.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| contract_id | uuid | FK → contracts |
| type | enum | `deposit`, `installment`, `balance`, `refund` |
| amount | numeric | |
| status | enum | `pending`, `paid`, `failed`, `refunded` |
| due_date | date | nullable |
| paid_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | |

## Relationships

```
organizations 1—* leads
organizations 1—* clients
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
