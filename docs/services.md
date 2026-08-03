# Services

**Status: live.** Types, enums, pure workflows, the normalized template schema, the mock repository, the real Supabase repository, all 20 migrations (26 tables, RLS, immutability triggers, `publish_service_version`/`assign_service_to_event` RPCs, all live on the connected project), and the full catalog + template-builder + assignment + workspace UI all shipped across Checkpoints 1-9. Blueprint (Phase 2b) and Dependencies/Conflicts/Resource Packages/Service Health (Phase 2c) are **not built yet** — see "What's deferred" below.

## Design philosophy: Services own operational knowledge, Events orchestrate

Services is not a CRUD module. Every reusable piece of operational content — checklist items, timeline entries, inventory needs, purchase estimates, budget estimates, staffing needs, vendor suggestions, questionnaires, AI-facing knowledge — is owned by a **Service**, never invented on the Event. An Event only ever: selects Services, merges their generated output, resolves cross-Service conflicts (Phase 2c), stores Event-specific overrides, and tracks execution. See the architecture discussion in this project's history for the full rationale; this document describes what's actually built.

## Three layers

1. **Blueprint layer** (`Service`, `ServiceVersion`) — reusable, versioned, immutable once published. Never references an Event.
2. **Template layer** — 16 normalized tables scoped to `service_version_id`, each independently queryable (a deliberate choice over JSONB, for reporting/search/AI/analytics — see below).
3. **Instance layer** (`EventService` + 6 child tables) — generated once, at assignment time, by copying (never live-referencing) the pinned `ServiceVersion`'s template rows. Free to diverge from the Blueprint from the moment it's generated.

```
Service (catalog identity, mutable: name/category/status)
  └── ServiceVersion "draft" (the one mutable version, always exists)
  └── ServiceVersion "published" v1, v2, v3... (immutable forever)
        └── 16 Template tables, scoped to this version

assign_service_to_event (pure plan: buildEventServiceAssignmentPlan)
  └── EventService (pinned to one immutable service_version_id, forever)
        ├── real ChecklistItem rows (tagged source_event_service_id)
        ├── real EventScheduleItem rows (tagged source_event_service_id)
        ├── EventServiceInventoryRequirement[]
        ├── EventServicePurchaseRequirement[]
        ├── EventServiceBudgetLine[]
        ├── EventServiceTeamRequirement[]
        └── EventServiceVendorAssignment[]
```

## Versioning and the draft/published split

`ServiceVersion.status` is either `"draft"` (exactly one per Service, always exists, freely editable) or `"published"` (immutable forever once reached). There is no separate "draft content" area on `Service` itself — `Service` only holds catalog identity (name/category/status) plus two pointers: `draft_version_id` (always set) and `current_published_version_id` (null until first publish).

**Publishing** (`publishServiceVersion`, `core/workflows/serviceWorkflow.ts`'s `canPublishServiceVersion` + `computeNextServiceVersionNumber`):
1. Stamps the current draft with the next `version_number`, `published_at`, `published_by`, flips `status` to `"published"` — frozen forever from this point.
2. Deep-copies every one of the 16 template tables' rows for that version into a **new** draft version (fresh id, `version_number: null`) — this clone is the real engineering cost of full normalization (see "Why normalized, not JSONB" below) and is exactly what `cloneAllTemplateRowsForNewVersion` in `lib/data/services/mockRepository.ts` does.
3. Updates `Service.current_published_version_id`/`draft_version_id` accordingly.

`EventService.service_version_id` always pins to a **published** version — never the live draft — so a booking's content is permanently reproducible even after the Service has moved on to v2, v3, v4.

## The 16 normalized Template tables

Checklist, Timeline, Questionnaire Question, Budget Line, Approval, Travel, AI Knowledge, Required Document, Inventory, Purchase, Vendor Suggestion, Team Role Requirement — plus operational-metadata tables: Seasonal Window, Capability Requirement (skill or equipment, via a `capability_type` discriminator — originally two identical tables, `ServiceSkillRequirement`/`ServiceEquipmentRequirement`, merged during the pre-migration domain review once the only real difference turned out to be one field name) — plus catalog display tables: Included Item, Add-On.

**Why normalized, not JSONB**: every one of these is independently queryable/reportable/searchable ("which Services always include a safety reminder about candles," "average setup duration by category"), which a JSONB blob can't support. The cost, paid honestly: publishing a version means a real multi-table deep-copy (`cloneAllTemplateRowsForNewVersion`), not a one-line blob copy.

## Operational metadata (on `ServiceVersion`)

`setup_duration_minutes`, `breakdown_duration_minutes`, `difficulty_score` (1–5), `experience_level_required`, `weather_sensitivity`, `surprise_friendly`, `estimated_profit_minor`. These feed future consumers without any further schema change: Team Operations staffing (duration/experience), the AI risk engine and future Weather Intelligence (weather sensitivity), client-facing communication guardrails (`surprise_friendly` — never mention in client-facing copy), and Reporting (profit/difficulty/seasonality).

## Assignment: orchestration only, delegating to named pure functions

`buildEventServiceAssignmentPlan` (`core/workflows/eventServiceWorkflow.ts`) is the single source of truth for what assigning a Service to an Event produces — orchestration only, with every real computation living in its own named, independently testable pure function:

- `computeServicePrice(basePriceMinor, addOns, selectedAddOnIds)` — base price plus whichever add-ons were selected. Deliberately callable standalone, with no Event context required — this is what the future Proposal Builder reuses for a price preview before any Event exists.
- `computeServiceRequirements(input)` — maps the Inventory/Purchase/Budget/Team/Vendor template categories straight across into their generated Instance-layer shape (a genuine 1:1 copy; none of these need date/time resolution).
- The checklist/timeline mapping stays inline in `buildEventServiceAssignmentPlan` itself, since each item still needs its own per-row offset resolution — but that resolution is itself delegated to `resolveOffsetDueDate`/`resolveOffsetTime`, so `buildEventServiceAssignmentPlan` never performs date/time arithmetic directly either way.

The mock repository's `assignServiceToEvent` (and, later, the Supabase `assign_service_to_event` RPC) both consume the assembled plan rather than re-deriving any of this logic — the same "TS workflow is the source of truth, SQL mirrors it" rule `derivePurchaseReceiptStatus`/`getInventoryMovementDelta` already established.

**Nothing generated here ever auto-mutates a real ledger.** `EventServiceInventoryRequirement`/`PurchaseRequirement`/`BudgetLine` are all drafts/estimates a human reviews before turning into a real Inventory movement, Purchase, or Finance entry — consistent with the AI module's own "assist, not replace" guardrail.

## Multi-Service coexistence and the override mechanism

Real `checklist_items`/`event_schedule_items` rows gained two optional fields: `source_event_service_id` and `template_snapshot`. Multiple assigned Services' generated items coexist in the exact same tables real Checklist/Schedule already used — every existing surface (ChecklistSummaryCard, Event Health, the AI Operations Brief) keeps working unchanged. `template_snapshot` freezes what the Blueprint originally specified; comparing it against the row's own live fields is how a future UI computes "is this overridden from its Service template" without a separate stored boolean — "Setup starts at 3:00 PM" in the Blueprint, overridden to 2:30 PM for one Event, with the Blueprint itself never touched.

## Removal semantics

`removeEventService` deletes only still-`"pending"` generated checklist items and still-`"planned"` generated schedule items (`isGeneratedChecklistItemRemovable`/`isGeneratedScheduleItemRemovable`, `core/workflows/eventServiceWorkflow.ts`) — anything further along (in progress, completed) is preserved, never silently destroyed.

## EntityType and Notes/Timeline

`"service"` (the catalog entry) and `"event_service"` (one booking instance) were added to `core/enums/entityType.ts` — both independently addressable for Notes/Timeline, the same "parent gets its own owner type, subordinate template/instance-child rows don't" precedent `purchase`/`purchase_item` established. Timeline logging in this phase is scoped to the meaningful catalog/instance events only (`service_created`, `service_updated`, `service_status_changed`, `service_version_published`, `event_service_assigned`, `event_service_status_changed`, `event_service_removed`) — individual template-row edits are not themselves Timeline-logged, a deliberate scope reduction for this phase given 17 template types would otherwise mean 50+ activity types.

## Database schema (20 migrations, `20260806100000`–`20260806101900`)

Mirrors the TS domain model exactly: `service_categories` → `services` → `service_versions` (with the circular-FK-resolving `alter table services add constraint ... references service_versions` folded into the `service_versions` migration) → the 16 template tables (grouped into 5 migrations by logical cluster — catalog display, operational, readiness, resource, metadata — rather than one file per table, the same consolidation judgment already used for the mock stores) → `event_services` + its 6 Instance-layer child tables (grouped into 3 migrations) → owner-type widening → the `checklist_items`/`event_schedule_items` schema-widening columns → `updated_at` triggers (26 tables) → RLS (26 tables, workspace-isolation only) → indexes/constraints → the `publish_service_version` and `assign_service_to_event` RPCs (plus their SQL-side `resolve_offset_due_date`/`resolve_offset_time` helpers, mirroring `resolveOffsetDueDate`/`resolveOffsetTime` exactly). `src/lib/supabase/migrations.test.ts` has structural tests for the full ordering and the locked decisions below. Live on the connected Supabase project.

## Locked domain decisions (resolved)

A senior-review pass before writing any SQL surfaced one real bug and several decisions the migration/RPC design had to honor. All are now implemented:

1. **Name/description ownership (bug, fixed).** `Service.name`/`Service.description` are the single, always-current, authoritative source — editable only via `updateService`. `ServiceVersion.name_snapshot`/`description_snapshot` are write-once, populated only by `publishServiceVersion`/`publish_service_version` at the exact moment of publish, never independently editable. A draft version's snapshot fields are always `null` — anything displaying a draft reads `Service.name` directly.
2. **Versioning concurrency — implemented.** `20260806100200_service_versions.sql`'s partial unique index on `(service_id, version_number)` is the DB-layer backstop; `publish_service_version` row-locks the parent `services` row (`for update`) before computing the next number, serializing concurrent publishes for the same Service.
3. **Published-version immutability — implemented as a DB trigger.** `20260806101500_service_immutability_triggers.sql`'s `reject_write_to_published_service_version()` rejects any insert/update/delete against any of the 16 template tables once the parent version's status is `'published'` — chosen over app-layer-only because this specific invariant is the entire foundation of the versioning architecture's historical-reproducibility promise, not just a UX nicety like most other business rules in this schema.
4. **Assignment atomicity — implemented.** `assign_service_to_event` performs the `event_services` insert, both real `checklist_items`/`event_schedule_items` inserts, and all five requirement/assignment child-table inserts inside one function body — one Postgres transaction, all-or-nothing.
5. **Assignment as a single RPC — implemented.** The Supabase repository (a later increment) will call `assign_service_to_event` exactly once per assignment; never client-composed multi-query.
6. **Publishing a version with zero template rows is allowed** — no CHECK enforces otherwise. Service Health (Phase 2c) is the right place to surface this as a warning, never a hard block.
7. **Assigning the same Service to the same Event more than once is allowed** — no uniqueness constraint on `(event_id, service_id)` exists on `event_services`.
8. **The two originally-separate `ServiceSkillRequirement`/`ServiceEquipmentRequirement` tables are merged** into one `service_capability_requirements` table with a `capability_type: 'skill' | 'equipment'` discriminator — they were byte-for-byte identical except one field name, found and fixed before the schema became permanent.

**Disclosed limitation**: individual template-row CRUD (create/update/remove on any of the 16 tables) is not itself routed through an RPC in this phase — a plain client insert/update against a template table holds no lock on the parent `services`/`service_versions` row. In the extremely narrow window where such a write is mid-flight (already past its own immutability-trigger check) at the exact moment `publish_service_version`'s clone step runs, it could theoretically be missed from the clone. Disclosed rather than solved with pessimistic locking on every template table's plain CRUD path — worth revisiting if the Supabase Repository phase moves template CRUD behind RPCs of its own.

## What's deferred

Everything below this line described the Foundation-phase plan. Since then, migrations were pushed live and verified, the real Supabase repository (`lib/data/services/supabaseRepository.ts`, ~86 methods) replaced the throwing placeholder, and the full catalog/Template-builder/Health-dashboard/Version-history/Event-Assignment UI shipped across Checkpoints 1–9 — see `CHANGELOG.md`. `/services` is live in the nav and reachable by any active Workspace member; it has no granular permission of its own yet (`services.view/create/update/archive/assign` were never wired — see `docs/permissions.md`'s "Inventory, Vendors, Purchases, Services (live, active-membership-only)" section for the current, deliberate state of that gap).

Still genuinely deferred:

- **Blueprint** (commercial packages combining multiple Services) — Phase 2b.
- **Service Dependencies/Conflicts, Resource Packages, Service Health, Operational Graph documentation** — Phase 2c.
- **`remove_service_from_event` RPC** — removing an assignment isn't built; only creating/overriding one is.
