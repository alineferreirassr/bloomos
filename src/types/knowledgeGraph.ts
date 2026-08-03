import { ENTITY_TYPES } from "@/core/enums/entityType";

/**
 * v2.0 Checkpoint 25, Step 10.5 — Enterprise Knowledge Graph. Every
 * `EntityType` is automatically a valid graph node type (a Client, Event,
 * Invoice, MediaAsset, etc. is always graph-connectable) — this list only
 * adds the handful of graph-relevant concepts that aren't full
 * polymorphic-ownership `EntityType`s in their own right (a Comment or a
 * Reminder can be a relationship's source/target, but nothing else attaches
 * *its own* Comments/Notes/Search to a Comment the way it does to an
 * Invoice). Keeping these separate from `EntityType` avoids polluting that
 * enum — which gates Comments/Notes/Search/Timeline ownership — with
 * graph-only concepts.
 */
export const KNOWLEDGE_NODE_TYPES = [
  ...ENTITY_TYPES,
  "media_folder",
  "media_collection",
  "comment",
  "message",
  "reminder",
  "workflow",
  "ai_insight",
  // v2.0 Checkpoint 33 — Proposal & Quote Platform. `proposal_template`/
  // `proposal_package`/`proposal_addon` are reusable library entities
  // (`ProposalTemplate`/`ProposalPackage`/`ProposalAddon`,
  // `types/proposalPlatform.ts`) that a real `proposal_uses_template`/
  // `proposal_contains_package`/`proposal_contains_addon` edge needs to
  // point at — they get graph node identity here (not a full `EntityType`,
  // since nothing this checkpoint attaches Comments/Notes/Timeline
  // directly to a template/package/addon row itself) rather than
  // fabricating a target for those 3 named relationships.
  "proposal_template",
  "proposal_package",
  "proposal_addon",
  // v2.0 Checkpoint 34 — Contract Management Platform. `contract_builder_template`/
  // `contract_clause` are the two new library entities (`ContractBuilderTemplate`/
  // `ContractClause`, `types/contractPlatform.ts`) a real `contract_uses_template`/
  // `contract_contains_clause` edge needs to point at — the same reasoning
  // `proposal_template`/`proposal_package`/`proposal_addon` got node identity for
  // in Checkpoint 33. The real `Contract` itself needs no new node type — it's
  // already the `"contract"` `EntityType` above.
  "contract_builder_template",
  "contract_clause",
] as const;
export type KnowledgeNodeType = (typeof KNOWLEDGE_NODE_TYPES)[number];

export interface KnowledgeNodeRef {
  nodeType: KnowledgeNodeType;
  nodeId: string;
}

/** Every named relationship type from the spec, closed — a `RelationshipEngine` validates every mutation against this list, never a free-form string. */
export const RELATIONSHIP_TYPES = [
  "belongs_to",
  "uploaded_by",
  "created_by",
  "owned_by",
  "used_by",
  "referenced_by",
  "related_to",
  "derived_from",
  "replaces",
  "previous_version_of",
  "next_version_of",
  "approved_by",
  "rejected_by",
  "assigned_to",
  "attached_to",
  "included_in",
  "generated_from",
  "shared_with",
  "downloaded_by",
  "viewed_by",
  "mentioned_in",
  "commented_on",
  "triggered_by",
  "produced_by_workflow",
  "produced_by_automation",
  "appears_in_timeline",
  "associated_with_event",
  "associated_with_client",
  "associated_with_vendor",
  // v2.0 Checkpoint 26.1 — Workforce Capability & Eligibility Platform.
  // Only the two named relationships that connect two *real* nodes are
  // added here — `requires_equipment`/`requires_vehicle` link a saved
  // Capability Requirement's own context node to a real Equipment/Vehicle
  // node. `requires_skill`/`requires_certification`/`requires_language`
  // are deliberately NOT added: Skills, Certifications, and Languages
  // have no node identity anywhere in this codebase (they're plain
  // strings on `Worker`), and fabricating one just to satisfy this
  // relationship would violate the spec's own "do not create fake
  // Knowledge Graph nodes" rule — disclosed in `docs/capability-requirements.md`
  // rather than faked. `evaluated_for`/`eligible_for`/
  // `conditionally_eligible_for`/`ineligible_for` connect a Worker node
  // to a Capability Requirement's context node, for saved requirements
  // and explicit assignments only — never one edge per transient
  // evaluation (see `capabilityActions.ts`).
  "requires_equipment",
  "requires_vehicle",
  "evaluated_for",
  "eligible_for",
  "conditionally_eligible_for",
  "ineligible_for",
  // v2.0 Checkpoint 27 — Enterprise Scheduling Platform. `scheduled_for`
  // connects a Worker node to an Appointment's own context node (e.g. an
  // Event) when a worker has already been placed on that appointment;
  // `reserved_for` connects a Reservation's resource node
  // (worker/equipment/vehicle) to the context node of the appointment it
  // backs; `belongs_to_calendar` connects an Appointment's context node to
  // its Calendar's own context node. `blocks` and `occurs_during` are
  // reserved vocabulary, not created as live edges this checkpoint —
  // `CalendarWindow`/`Holiday` have no node identity of their own (plain
  // records, not Knowledge Graph nodes), and fabricating one to satisfy
  // these two relationships would violate the spec's own "reuse the
  // existing graph, never fake a node" rule. Disclosed in
  // `docs/calendar.md`, not silently omitted.
  "scheduled_for",
  "reserved_for",
  "conflicts_with",
  "belongs_to_calendar",
  "blocks",
  "occurs_during",
  // v2.0 Checkpoint 27.1 — Resource Allocation Platform. `allocated_to`
  // connects a selected candidate resource node (worker/team/equipment/
  // vehicle/vendor) to an `AllocationRequest`'s own context node;
  // `depends_on` connects a resource node to another resource node it
  // requires (e.g. Equipment "Drone" → Worker with a drone-operator
  // certification); `backup_for` connects a fallback resource node to the
  // primary resource node it stands in for; `shares_resource_with`
  // connects two context nodes (e.g. two Events) that were allocated the
  // same shared resource. `allocation_candidate` and `allocation_bundle`
  // are reserved vocabulary, not created as live edges this checkpoint —
  // `Allocation`/`AllocationRequest`/`ResourceBundle` have no node
  // identity of their own (plain records, not Knowledge Graph nodes,
  // exactly like `CapabilityRequirement`/`Calendar`/`Appointment` before
  // them), and fabricating one to satisfy these two relationships would
  // violate the "reuse the existing graph, never fake a node" rule.
  // Disclosed in `docs/resource-allocation.md`, not silently omitted.
  "allocated_to",
  "allocation_candidate",
  "allocation_bundle",
  "depends_on",
  "backup_for",
  "shares_resource_with",
  // v2.0 Checkpoint 27.2 — Operational Planning Platform. `produces_deliverable`
  // is the one live edge: a plan's own context node → the real Document/
  // MediaAsset node a `Deliverable.linked_node` names, when set. The other
  // seven are registered exactly as the spec names them but never emitted —
  // `OperationalPlan`/`ExecutionPhase`/`ExecutionStep`/`Milestone`/
  // `EvidenceRequirement`/`ApprovalRequirement` have no node identity of
  // their own (plain records inside a plan's own aggregate document, not
  // Knowledge Graph nodes), the same "never fabricate a node" discipline
  // `CapabilityRequirement`/`Calendar`/`Allocation` held to before them.
  // Disclosed in `docs/operational-planning.md`, not silently omitted.
  "operational_plan",
  "execution_phase",
  "execution_step",
  "milestone",
  "requires_evidence",
  "requires_approval",
  "produces_deliverable",
  "depends_on_step",
  // v2.0 Checkpoint 27.3 — Execution Package Platform. All 8 named
  // relationship types here are reserved vocabulary — none are ever
  // emitted as live edges. `ExecutionPackage`/`ExecutionVersion`/
  // `ExecutionSnapshot` have no node identity of their own (frozen
  // records inside a package's own aggregate document, the same
  // discipline `OperationalPlan`/`Allocation`/`Calendar` held to before
  // them), and unlike `produces_deliverable` before it, nothing this
  // checkpoint aggregates (an Operational Plan, an Allocation, an
  // Appointment, a CapabilityRequirement, a ResourceBundle) has real
  // node identity either — every one of them is itself plain registry
  // data, not a Knowledge Graph node. Fabricating a node for any of
  // them just to satisfy these 8 relationship types would violate the
  // "reuse the existing graph, never fake a node" rule. Disclosed in
  // `docs/execution-packages.md`, not silently omitted — an even more
  // conservative 0-live/8-reserved ratio than Operational Planning's
  // own 1-live/7-reserved, because this checkpoint's entire job is
  // aggregating already-non-node planning artifacts into one frozen
  // bundle, never touching a genuinely new node relationship.
  "execution_package",
  "package_snapshot",
  "package_version",
  "contains_plan",
  "contains_allocation",
  "contains_schedule",
  "contains_capability",
  "contains_bundle",
  // v2.0 Checkpoint 28 — Dispatch Platform. `assigned_worker`/
  // `assigned_vehicle`/`assigned_equipment` are the 3 live edges: a
  // Dispatch Order's own context node (reused from its Execution
  // Package's `ExecutionContext.context`, e.g. an Event) → the real
  // Worker/Vehicle/Equipment node a `DispatchAssignment` names — the
  // first genuinely new live edges since `produces_deliverable`, because
  // unlike `ExecutionPackage`/`Allocation`/`OperationalPlan` before it, a
  // Worker/Vehicle/Equipment IS a real `KnowledgeNodeType`
  // (`RESOURCE_TYPE_TO_NODE_TYPE` already maps all three). `dispatch_order`/
  // `dispatch_assignment`/`dispatch_batch`/`dispatch_queue` are reserved
  // vocabulary — `DispatchOrder`/`DispatchAssignment`/`DispatchBatch` have
  // no node identity of their own (plain records, the same discipline
  // `ExecutionPackage`/`OperationalPlan` held to), and "queue" names a
  // lifecycle concept, not an entity. Team/Vendor assignments
  // deliberately get no edge — the spec's own named list is exactly
  // these 3 resource types, never `assigned_team`/`assigned_vendor`.
  // Disclosed in `docs/dispatch-platform.md`, not silently omitted.
  "dispatch_order",
  "dispatch_assignment",
  "dispatch_batch",
  "dispatch_queue",
  "assigned_worker",
  "assigned_vehicle",
  "assigned_equipment",
  // v2.0 Checkpoint 29 — Field Operations Platform. All 6 named
  // relationships are reserved — 0 live, an even more conservative ratio
  // than Execution Package's own 0-live/8-reserved. `field_operation`/
  // `execution_session`/`execution_attempt` are plain aggregate records
  // with no node identity, the same discipline `DispatchOrder`/
  // `DispatchAssignment`/`DispatchAttempt` held to before them.
  // `execution_result` is a computed-only bundle — never stored, exactly
  // like `DispatchOrderResult`/`ExecutionPackageResult`. `current_phase`/
  // `completed_step` name plan-internal data (`ExecutionPhase`/
  // `ExecutionStep`) that never had node identity even in Operational
  // Planning's own domain — Field Operations tracks their *completion
  // state* via a live overlay on `ExecutionSession`, not via the
  // Knowledge Graph. Unlike Dispatch (which points at real Worker/
  // Vehicle/Equipment nodes), Field Operations introduces no new
  // resource references — "tracks operational state only" (the spec's
  // own Step 8 line) — so no live edge exists to build. Disclosed in
  // `docs/execution-timeline.md`, not silently omitted.
  "field_operation",
  "execution_session",
  "execution_attempt",
  "current_phase",
  "completed_step",
  "execution_result",
  // v2.0 Checkpoint 30 — Route Optimization Platform. All 6 named
  // relationships are reserved — 0 live, the same fully-conservative
  // ratio Field Operations established. `route_plan`/`route_segment`/
  // `waypoint`/`travel_leg` are plain records with no real-world node
  // identity of their own — a waypoint has no address, a travel leg no
  // measured distance, only declared numbers on plain records, the same
  // discipline `DispatchAssignment`/`ExecutionAttempt` held to before
  // them. `travel_estimate`/`optimization_result` are computed-only
  // bundles — never stored, exactly like `execution_result`/
  // `DispatchOrderResult`. Route Optimization "calculates and manages
  // routes" over Dispatch's own already-assigned Worker/Vehicle/
  // Equipment — it introduces no new resource reference of its own, so
  // no live edge exists to build. Disclosed in `docs/route-timeline.md`,
  // not silently omitted.
  "route_plan",
  "route_segment",
  "waypoint",
  "travel_leg",
  "travel_estimate",
  "optimization_result",
  // v2.0 Checkpoint 33 — Proposal & Quote Platform. 7 of the 8 named
  // relationships are live edges — the most of any checkpoint since
  // Dispatch — because unlike most prior checkpoints' own aggregate
  // records, `ProposalDraft` (the reused `"proposal"` EntityType, already
  // a real node since Checkpoint 3) and the new `proposal_template`/
  // `proposal_package`/`proposal_addon` node types above are all real,
  // individually addressable rows. `proposal_uses_template`/
  // `proposal_contains_package`/`proposal_contains_addon` connect a
  // Proposal node to the library entity it was built from.
  // `proposal_related_document`/`proposal_related_client` connect a
  // Proposal to a real Document/Client node when one is linked.
  // `proposal_version_of`/`proposal_supersedes` connect two Proposal
  // nodes along the EXISTING `ProposalDraft.parent_proposal_id`/`status:
  // "superseded"` chain (Checkpoint 3) — this checkpoint's own new
  // `ProposalVersion`/`ProposalSnapshot` (the human-curated document
  // history, `types/proposalPlatform.ts`) stays frozen/embedded with no
  // node identity of its own, the same `ExecutionVersion`/
  // `ExecutionSnapshot` discipline Execution Package (27.3) held to,
  // since a version's edits happen inside one already-real Proposal node,
  // never a new node per edit. `proposal_related_journey` is the one
  // reserved relationship — the Client Journey (Checkpoint 32) is a
  // computed read model over `lead`/`client` with deliberately no node
  // identity of its own, so fabricating one here to satisfy this edge
  // would violate the "reuse the existing graph, never fake a node" rule.
  // Disclosed in `docs/proposal-platform.md`, not silently omitted.
  "proposal_uses_template",
  "proposal_contains_package",
  "proposal_contains_addon",
  "proposal_related_document",
  "proposal_related_client",
  "proposal_related_journey",
  "proposal_version_of",
  "proposal_supersedes",
  // v2.0 Checkpoint 34 — Contract Management Platform. 5 of the 8 named
  // relationships are live edges. `contract_uses_template`/
  // `contract_contains_clause` connect the real `"contract"` node to the
  // new `contract_builder_template`/`contract_clause` library node types
  // above. `contract_related_proposal`/`contract_related_client`/
  // `contract_related_document` connect a Contract to a real Proposal/
  // Client/Document node when one is linked or resolvable (Proposal via
  // the shared `event_id`, since no direct FK exists — see
  // `docs/contract-platform.md`). `contract_version_of`/
  // `contract_supersedes` are reserved, unlike Proposal's own live
  // version-chain pair: `ProposalDraft` rows themselves form a real
  // `parent_proposal_id`/`"superseded"` chain of separate nodes, but
  // `Contract` does not — a contract's edits live inside ONE row's own
  // `version`/`version_history` fields (commercial changes) and this
  // checkpoint's own `ContractVersion`/`ContractSnapshot` (frozen,
  // embedded document history, the same `ExecutionVersion`/
  // `ProposalVersion` no-node-identity discipline), never a second
  // `Contract` row to point at. `contract_related_journey` is reserved
  // for the same reason `proposal_related_journey` is — Client Journey
  // (Checkpoint 32) is a computed read model with no node identity of
  // its own. Disclosed in `docs/contract-platform.md`, not silently
  // omitted.
  "contract_uses_template",
  "contract_contains_clause",
  "contract_related_proposal",
  "contract_related_client",
  "contract_related_document",
  "contract_version_of",
  "contract_supersedes",
  "contract_related_journey",
  // v2.0 Checkpoint 35 — Invoice & Billing Platform. 4 of the 8 named
  // relationships are live edges: `invoice_related_client`/
  // `invoice_related_contract` connect the real `"invoice"` node to its
  // real `client_id`/`contract_id` direct fields (no indirection needed,
  // unlike `contract_related_proposal` — the real `Invoice` entity already
  // carries both FKs directly). `invoice_related_proposal` still resolves
  // via the shared `event_id`, mirroring `contract_related_proposal`
  // (Checkpoint 34), since no direct Proposal FK exists on `Invoice`.
  // `invoice_related_document` connects to a real Document node when
  // resolvable. `invoice_contains_line_item` is reserved — `InvoiceLineItem`
  // is an embedded value on `InvoiceSnapshot`, not a persisted, reusable
  // library entity with its own node identity (unlike `ContractClause`,
  // which IS a real library entity `contract_contains_clause` points at).
  // `invoice_version_of`/`invoice_supersedes` are reserved for the same
  // reason `contract_version_of`/`contract_supersedes` are — `InvoiceVersion`/
  // `InvoiceSnapshot` are frozen, embedded document history, never a
  // second `Invoice` row to point at. `invoice_related_journey` is reserved
  // for the same reason `contract_related_journey`/`proposal_related_journey`
  // are — Client Journey is a computed read model with no node identity of
  // its own. Disclosed in `docs/invoice-platform.md`, not silently omitted.
  "invoice_related_client",
  "invoice_related_contract",
  "invoice_related_proposal",
  "invoice_contains_line_item",
  "invoice_version_of",
  "invoice_supersedes",
  "invoice_related_document",
  "invoice_related_journey",
  // v2.0 Checkpoint 37 — Digital Asset Management Platform. Of the spec's
  // own 8 named relationships (`uses_asset`/`stored_in_folder`/
  // `belongs_to_collection`/`derived_from_asset`/`shared_with`/
  // `comment_on_asset`/`review_for_asset`/`favorite_asset`), 7 already map
  // onto existing vocabulary: `uses_asset` → `attached_to` (a real record
  // attaches an asset to itself); `stored_in_folder`/`belongs_to_collection`
  // both → `included_in` (the target's own node type, `media_folder` vs.
  // `media_collection`, disambiguates which); `derived_from_asset` →
  // `derived_from` (already exists, unused until now); `shared_with` →
  // `shared_with` (already exists, literally the same name); `comment_on_asset`
  // → `commented_on` (already exists); `review_for_asset` → `approved_by`/
  // `rejected_by` (the real approval-workflow edges Checkpoint 25 already
  // emits). Adding new strings for any of these 7 would be a duplicate
  // vocabulary for an edge type that already exists, not a reused fact.
  // `favorited_by` is the one genuine gap — no existing relationship type
  // captures "a member favorited this," the same "infrequent, meaningful
  // user action" tier `shared_with` already occupies (unlike `viewed_by`/
  // `downloaded_by`, which stay unused as live edges — those would fire on
  // every single view/download, an edge-per-event volume no other
  // checkpoint's own Knowledge Graph integration accepts; Views/Downloads
  // are tracked as plain counters instead, see `types/digitalAssets.ts`'s
  // `AssetView`/`AssetDownload`).
  "favorited_by",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  belongs_to: "Belongs To",
  uploaded_by: "Uploaded By",
  created_by: "Created By",
  owned_by: "Owned By",
  used_by: "Used By",
  referenced_by: "Referenced By",
  related_to: "Related To",
  derived_from: "Derived From",
  replaces: "Replaces",
  previous_version_of: "Previous Version Of",
  next_version_of: "Next Version Of",
  approved_by: "Approved By",
  rejected_by: "Rejected By",
  assigned_to: "Assigned To",
  attached_to: "Attached To",
  included_in: "Included In",
  generated_from: "Generated From",
  shared_with: "Shared With",
  downloaded_by: "Downloaded By",
  viewed_by: "Viewed By",
  mentioned_in: "Mentioned In",
  commented_on: "Commented On",
  triggered_by: "Triggered By",
  produced_by_workflow: "Produced By Workflow",
  produced_by_automation: "Produced By Automation",
  appears_in_timeline: "Appears In Timeline",
  associated_with_event: "Associated With Event",
  associated_with_client: "Associated With Client",
  associated_with_vendor: "Associated With Vendor",
  requires_equipment: "Requires Equipment",
  requires_vehicle: "Requires Vehicle",
  evaluated_for: "Evaluated For",
  eligible_for: "Eligible For",
  conditionally_eligible_for: "Conditionally Eligible For",
  ineligible_for: "Ineligible For",
  scheduled_for: "Scheduled For",
  reserved_for: "Reserved For",
  conflicts_with: "Conflicts With",
  belongs_to_calendar: "Belongs To Calendar",
  blocks: "Blocks",
  occurs_during: "Occurs During",
  allocated_to: "Allocated To",
  allocation_candidate: "Allocation Candidate",
  allocation_bundle: "Allocation Bundle",
  depends_on: "Depends On",
  backup_for: "Backup For",
  shares_resource_with: "Shares Resource With",
  operational_plan: "Operational Plan",
  execution_phase: "Execution Phase",
  execution_step: "Execution Step",
  milestone: "Milestone",
  requires_evidence: "Requires Evidence",
  requires_approval: "Requires Approval",
  produces_deliverable: "Produces Deliverable",
  depends_on_step: "Depends On Step",
  execution_package: "Execution Package",
  package_snapshot: "Package Snapshot",
  package_version: "Package Version",
  contains_plan: "Contains Plan",
  contains_allocation: "Contains Allocation",
  contains_schedule: "Contains Schedule",
  contains_capability: "Contains Capability",
  contains_bundle: "Contains Bundle",
  dispatch_order: "Dispatch Order",
  dispatch_assignment: "Dispatch Assignment",
  dispatch_batch: "Dispatch Batch",
  dispatch_queue: "Dispatch Queue",
  assigned_worker: "Assigned Worker",
  assigned_vehicle: "Assigned Vehicle",
  assigned_equipment: "Assigned Equipment",
  field_operation: "Field Operation",
  execution_session: "Execution Session",
  execution_attempt: "Execution Attempt",
  current_phase: "Current Phase",
  completed_step: "Completed Step",
  execution_result: "Execution Result",
  route_plan: "Route Plan",
  route_segment: "Route Segment",
  waypoint: "Waypoint",
  travel_leg: "Travel Leg",
  travel_estimate: "Travel Estimate",
  optimization_result: "Optimization Result",
  proposal_uses_template: "Proposal Uses Template",
  proposal_contains_package: "Proposal Contains Package",
  proposal_contains_addon: "Proposal Contains Add-on",
  proposal_related_document: "Proposal Related Document",
  proposal_related_client: "Proposal Related Client",
  proposal_related_journey: "Proposal Related Journey",
  proposal_version_of: "Proposal Version Of",
  proposal_supersedes: "Proposal Supersedes",
  contract_uses_template: "Contract Uses Template",
  contract_contains_clause: "Contract Contains Clause",
  contract_related_proposal: "Contract Related Proposal",
  contract_related_client: "Contract Related Client",
  contract_related_document: "Contract Related Document",
  contract_version_of: "Contract Version Of",
  contract_supersedes: "Contract Supersedes",
  contract_related_journey: "Contract Related Journey",
  invoice_related_client: "Invoice Related Client",
  invoice_related_contract: "Invoice Related Contract",
  invoice_related_proposal: "Invoice Related Proposal",
  invoice_contains_line_item: "Invoice Contains Line Item",
  invoice_version_of: "Invoice Version Of",
  invoice_supersedes: "Invoice Supersedes",
  invoice_related_document: "Invoice Related Document",
  invoice_related_journey: "Invoice Related Journey",
  favorited_by: "Favorited By",
};

/** `"active"` participates in traversal/impact-analysis by default; `"archived"` is kept for audit but excluded unless explicitly requested; `"rejected"` means a proposed relationship (e.g. a future AI suggestion) was reviewed and declined — "future AI suggestions must always be reviewed and approved before becoming permanent" (spec) means every AI-sourced relationship starts here, never `"active"`. */
export const RELATIONSHIP_STATUSES = ["active", "archived", "rejected"] as const;
export type RelationshipStatus = (typeof RELATIONSHIP_STATUSES)[number];

/** Every relationship's provenance — "the source of every relationship must be auditable" (spec). */
export const RELATIONSHIP_SOURCES = [
  "user_action",
  "asset_upload",
  "entity_linking",
  "version_creation",
  "approval_workflow",
  "comment",
  "mention",
  "automation",
  "workflow",
  "timeline_event",
  "system_migration",
  "future_external_integration",
  "future_ai_suggestion",
] as const;
export type RelationshipSource = (typeof RELATIONSHIP_SOURCES)[number];

// ---------------------------------------------------------------------------
// Semantic Relationship Engine (Step 10.6)
// ---------------------------------------------------------------------------

/**
 * Named business roles a relationship can play — set explicitly by a user
 * or a deterministic module action (e.g. "uploading a file into an Event's
 * Hero Image slot" sets `role: 'hero_image'` on the resulting relationship),
 * never inferred. `RELATIONSHIP_TYPE_LABELS` above answers "what kind of
 * edge is this, structurally" (Belongs To, Approved By); `role` answers
 * "what does this edge *mean* to the business" (this is THE contract, not
 * just a document attached to one).
 */
export const RELATIONSHIP_ROLES = [
  "primary_contract",
  "secondary_document",
  "hero_image",
  "cover_image",
  "legal_attachment",
  "marketing_asset",
  "internal_reference",
  "brand_standard",
  "preferred_vendor",
  "optional_reference",
] as const;
export type RelationshipRole = (typeof RELATIONSHIP_ROLES)[number];

export const RELATIONSHIP_ROLE_LABELS: Record<RelationshipRole, string> = {
  primary_contract: "Primary Contract",
  secondary_document: "Secondary Document",
  hero_image: "Hero Image",
  cover_image: "Cover Image",
  legal_attachment: "Legal Attachment",
  marketing_asset: "Marketing Asset",
  internal_reference: "Internal Reference",
  brand_standard: "Brand Standard",
  preferred_vendor: "Preferred Vendor",
  optional_reference: "Optional Reference",
};

export const RELATIONSHIP_CATEGORIES = ["legal", "marketing", "operational", "financial", "brand", "reference"] as const;
export type RelationshipCategory = (typeof RELATIONSHIP_CATEGORIES)[number];

export const RELATIONSHIP_CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  legal: "Legal",
  marketing: "Marketing",
  operational: "Operational",
  financial: "Financial",
  brand: "Brand",
  reference: "Reference",
};

export const RELATIONSHIP_IMPORTANCE_LEVELS = ["critical", "high", "normal", "low"] as const;
export type RelationshipImportance = (typeof RELATIONSHIP_IMPORTANCE_LEVELS)[number];

/** Distinct from `importance` — importance is "how much this matters to the business" (fairly static); priority is "how urgently it needs attention right now" (e.g. a pending legal attachment awaiting signature). The spec lists both explicitly, so they stay two separate fields rather than collapsing into one. */
export const RELATIONSHIP_PRIORITY_LEVELS = ["urgent", "high", "normal", "low"] as const;
export type RelationshipPriority = (typeof RELATIONSHIP_PRIORITY_LEVELS)[number];

/** Distinct from `RelationshipStatus` (active/archived/rejected — the edge's own audit state). Lifecycle describes where the *linked content* sits in its business lifecycle, e.g. a still-`active` edge can point at a `superseded` document. */
export const RELATIONSHIP_LIFECYCLE_STAGES = ["active", "deprecated", "superseded", "archived"] as const;
export type RelationshipLifecycle = (typeof RELATIONSHIP_LIFECYCLE_STAGES)[number];

export const RELATIONSHIP_VISIBILITY_LEVELS = ["internal", "team", "client", "public"] as const;
export type RelationshipVisibility = (typeof RELATIONSHIP_VISIBILITY_LEVELS)[number];

/**
 * Every field here is set explicitly (by a user action or a deterministic
 * module rule) and defaults to `null` — "Do NOT infer meanings
 * automatically. Everything remains deterministic" (spec). Nested rather
 * than flattened onto `KnowledgeRelationship`, mirroring `MediaAssetMetadata`'s
 * own nested-nullable-nested-object precedent, so a relationship with no
 * business meaning yet (the common case for most structural edges) stays a
 * single `null`, not nine separately-nullable columns.
 */
export interface RelationshipSemantics {
  role: RelationshipRole | null;
  businessMeaning: string | null;
  category: RelationshipCategory | null;
  importance: RelationshipImportance | null;
  priority: RelationshipPriority | null;
  lifecycle: RelationshipLifecycle | null;
  visibility: RelationshipVisibility | null;
  /** The team member accountable for this relationship's business meaning staying correct — distinct from `created_by` (who made the edge exist). */
  ownerMemberId: string | null;
  businessContext: string | null;
}

export interface KnowledgeRelationship {
  id: string;
  workspace_id: string;
  source_node_type: KnowledgeNodeType;
  source_node_id: string;
  target_node_type: KnowledgeNodeType;
  target_node_id: string;
  relationship_type: RelationshipType;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: RelationshipStatus;
  /** 0–100. 100 = a direct, user-confirmed or system-derived-with-certainty link (an upload, an approval). Lower values are reserved for a future AI-suggestion source — never fabricated for a deterministic link. Step 10.6's own "Confidence" semantic property is this same field, not a duplicate. */
  confidence: number;
  source: RelationshipSource;
  notes: string | null;
  metadata: Record<string, string>;
  start_date: string | null;
  end_date: string | null;
  /** Step 10.6 — Semantic Relationship Engine. `null` until a user or module action explicitly assigns meaning. */
  semantics: RelationshipSemantics | null;
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

export type TraversalDirection = "outbound" | "inbound" | "both";

export interface TraversalHop {
  node: KnowledgeNodeRef;
  relationship: KnowledgeRelationship;
  direction: "outbound" | "inbound";
  depth: number;
}

export interface TraversalPath {
  nodes: KnowledgeNodeRef[];
  relationships: KnowledgeRelationship[];
}

export interface RelationshipCounts {
  inbound: number;
  outbound: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Dependency / Impact Analysis / Orphan Detection
// ---------------------------------------------------------------------------

export interface DependencyItem {
  node: KnowledgeNodeRef;
  relationshipType: RelationshipType;
  label: string;
}

export interface ImpactAnalysisResult {
  node: KnowledgeNodeRef;
  totalDependents: number;
  /** Grouped by node type so a UI can render "3 Events, 1 Proposal, 2 Documents" rather than a flat, unlabeled list. */
  byNodeType: Partial<Record<KnowledgeNodeType, DependencyItem[]>>;
  hasActiveEventDependents: boolean;
  hasApprovalDependents: boolean;
  hasAutomationOrWorkflowDependents: boolean;
  /** True when at least one dependent exists — the UI's own "this will affect other records" warning gate. */
  isSafeToDelete: boolean;
}

export const ORPHAN_REASONS = [
  "no_relationships",
  "owner_entity_missing",
  "superseded_version_still_referenced",
  "archived_but_referenced",
  "linked_to_deleted_entity",
] as const;
export type OrphanReason = (typeof ORPHAN_REASONS)[number];

export interface OrphanedAssetFinding {
  node: KnowledgeNodeRef;
  reason: OrphanReason;
  detail: string;
}
