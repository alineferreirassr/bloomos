export const ENTITY_TYPES = [
  "lead",
  "client",
  "event",
  "contract",
  "invoice",
  "payment",
  "expense",
  "document",
  "document_folder",
  "workspace",
  "team_kb_article",
  "client_kb_article",
  "notification",
  "automation",
  // Reserved ahead of the modules themselves — same precedent as
  // team_kb_article/client_kb_article/notification/automation above — so
  // Core's Search registry (src/core/search/defaultRegistrations.ts) can
  // register a placeholder entry for Inventory/Vendors now, without a
  // second enum edit once those modules actually ship.
  //
  // "inventory_item" (not "inventory") — every other value here names one
  // specific record an owner_id can point at ("client" = one Client row,
  // "document" = one Document row), never a module as a whole. An
  // InventoryItem row is the thing Notes/Timeline/Tags/Attachments actually
  // attach to, matching what docs/database.md's Documents section already
  // anticipated ("supplier/inventory_item/team_member" reserved owner
  // types) before the Inventory Foundation phase existed.
  "inventory_item",
  "vendor",
  // Purchases Foundation phase — reserved the same way inventory_item/vendor
  // were: no live route or migration yet, added now so Notes/Timeline/
  // Search/Audit can type-check against it ahead of the UI/migration phases.
  "purchase",
  // Finance Repository Layer phase — needed so Core Audit Log's
  // recordAuditEvent() can type-check ownerType for Journal Entry and
  // Accounting Period mutations (Manual Adjustment, Reversal, period
  // create/close/lock). timeline_activities_owner_type_check already
  // widened to include "accounting_period" during the Posting Engine
  // phase; "journal_entry" needs no equivalent DB widening since nothing
  // writes a Timeline row owned by one yet, only Audit entries.
  "journal_entry",
  "accounting_period",
  // Services Foundation phase (Phase 2a) — "service" is the catalog/
  // blueprint identity (Notes/Timeline about the general offering);
  // "event_service" is one specific booking instance (Notes/Timeline about
  // this Service on this Event specifically) — same "parent gets its own
  // owner type, subordinate child rows don't" precedent as
  // purchase/purchase_item: every service_* template table and every
  // event_service_* instance-child table stays subordinate, never its own
  // EntityType.
  "service",
  "event_service",
  // v2.0 Checkpoint 3 — AI Proposal Generator. Mock-only persistence this
  // phase (no migration), same precedent as `purchase`/`inventory_item`
  // before their own Foundation phases shipped a table.
  "proposal",
  // v2.0 Checkpoint 22 — Enterprise Integration Platform. Mock-only this
  // phase, same "new checkpoint domain, no migration yet" precedent as
  // `proposal`. "integration_connection" is the owner type the Audit
  // Center (Step 12) records connection lifecycle changes against;
  // "integration_credential" is its own EntityType (not subordinate)
  // because credential issue/rotate/revoke is a security-relevant event
  // worth auditing independently of whatever connection it belongs to.
  "integration_connection",
  "integration_credential",
  // v2.0 Checkpoint 24 — Communication & Collaboration Platform. Comments
  // (Step 5) can attach to a Checklist item directly (distinct from
  // ChecklistItem's own `owner_type`, which names what the item is *for*,
  // e.g. "event" — this is the item itself being commented on).
  // "team_member" was reserved by docs/database.md long before this
  // checkpoint but never added until a real feature (commenting on/timelining
  // a Team Member's own profile) needed it.
  "checklist_item",
  "team_member",
  // v2.0 Checkpoint 25 — Digital Asset Management Platform. A `MediaAsset`
  // (`types/mediaAsset.ts`) was always polymorphic via its own
  // `owner_type`/`owner_id` (what the file is *for* — an Event's gallery
  // photo, a Client's uploaded logo), but nothing let Comments/Notes/Search
  // attach directly to the asset *itself* until Approval Workflow (Step 9)
  // and Asset Intelligence (Step 11) needed exactly that — the same
  // "owner_type names what it's for, a dedicated EntityType names the row
  // itself" precedent as `checklist_item` above.
  "media_asset",
  // Step 3 — Folders & Collections. Same reasoning as `media_asset` just
  // above: a folder/collection is a row Timeline activities need to be
  // owned by in their own right (e.g. "Folder created"), distinct from any
  // asset's own `owner_type`/`owner_id`.
  "media_folder",
  "media_collection",
  // v2.0 Checkpoint 26 — Mobile Workforce Platform Foundation. `worker` is
  // deliberately distinct from `team_member` (reserved above): a
  // `team_member` is a platform login/permission holder, a `Worker` is a
  // field-workforce record (technician, photographer, installer, driver,
  // contractor) that may or may not ever log in — see `types/workforce.ts`
  // for the full split and `Worker.linked_member_id` for how the two
  // connect when a worker *does* also hold a login. `team` (a workforce
  // crew, distinct from `team_member`'s organization-wide Team Management
  // surface), `equipment`, and `vehicle` get their own EntityType for the
  // same "row needs its own Timeline/Comments/Knowledge Graph identity"
  // precedent as `checklist_item`/`media_asset` above — Step 12 of this
  // checkpoint makes Workers (and these siblings) first-class Knowledge
  // Graph nodes.
  "worker",
  "team",
  "equipment",
  "vehicle",
  // v2.0 Checkpoint 31 — Real-Time Operations Center. `operational_alert`/
  // `operational_incident` let the existing generic Comments system
  // (`commentsActions.ts`'s `getCommentsForOwnerAction`/`createCommentAction`)
  // attach comments directly to an Alert/Incident — Step 15's "Alert
  // comments, Incident comments" — without building a second comment
  // store. Neither is a Knowledge Graph node or a Timeline owner type;
  // Operations Center never introduces a new source of truth, so these
  // two values exist solely for the comment-owner relationship.
  "operational_alert",
  "operational_incident",
  // v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform.
  // `client_information_request` lets the generic Comments system attach
  // internal discussion to a specific information request, the same
  // "new persisted entity gets its own owner type" precedent as
  // `operational_alert`/`operational_incident` above. The journey itself
  // is a computed read model over `lead`/`client` (see
  // `types/clientJourney.ts`) and deliberately does NOT get its own
  // EntityType — Journey Timeline/Comments/Notes reuse the subject's own
  // existing `lead`/`client` ownership so the platform never becomes a
  // second source of truth or a second Timeline/Comments owner for
  // something that is really still "this Client"/"this Lead".
  "client_information_request",
  // v2.0 Checkpoint 40 — Global Search & Universal Command Center. These
  // eight platforms (Workflow Builder, Executive Decisions, Operational
  // Objectives, Dispatch, Route Optimization, Operational Planning,
  // Execution Packages, Resource Allocation) each already have a real,
  // persisted, workspace-scoped entity with its own `id` and a genuine
  // route or dashboard to land on — the exact bar every prior entry in this
  // list was reserved against — but none had ever been given an `EntityType`
  // of their own, so Search (and by extension Notes/Timeline/Comments) could
  // never reference them. `workflow_template` is deliberately NOT added
  // here: it has no standalone detail route (only chosen inline from the
  // "New Workflow" dialog), so it fails the same bar `proposal`/`purchase`
  // met and `workflow_template` doesn't.
  "workflow",
  "decision",
  "objective",
  "dispatch_order",
  "route_plan",
  "operational_plan",
  "execution_package",
  "resource_bundle",
  // v2.0 Checkpoint 42 — Reporting & Business Intelligence Platform.
  // `SavedReport` is a real, persisted, workspace-scoped entity with its
  // own `id` and a genuine detail route (`/reports/[id]`) — the same bar
  // Checkpoint 40's eight platform types met. Being a real `EntityType`
  // is also what makes the existing generic Favorite/Pinned/Recent-Item
  // system (`core/workspace/favoritesEngine.ts`, Checkpoint 38) and
  // Timeline (`recordTimelineActivity`) work for reports for free —
  // no report-specific favorites store or Timeline owner type needed.
  "report",
  // v2 Checkpoint 44 — Client Documents & Digital Client Experience. A
  // `DocumentBundle` (`types/documentPlatform.ts`, Step 5) is a real,
  // persisted, workspace-scoped entity with its own `id` — the same bar
  // `report` met above — that groups Documents/Proposals/Contracts/
  // Invoices for one Client into a single sendable package. Its own
  // `ComposedDocument`/`Template` siblings deliberately get no new
  // `EntityType` here: they predate this checkpoint (Checkpoint 12) and
  // extending their own Timeline/Knowledge Graph wiring is a pre-existing
  // gap outside this checkpoint's "implement only the real gaps" scope,
  // not something this checkpoint's own new Bundle entity should be
  // blocked on.
  "document_bundle",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
