/**
 * The canonical granular permission catalog — mirrors the seeded
 * `permissions` table exactly (`supabase/migrations/20260724101000_team_seed_data.sql`).
 * Business-module RLS itself is unchanged this phase (still Workspace-
 * isolation-only); this catalog exists for the team-management surface —
 * granting/checking permissions in mock mode, and rendering the role/
 * permission matrix in the UI — not for gating leads/clients/events/
 * contracts/finance/documents access yet.
 */
export const PERMISSIONS = [
  "workspace.view",
  "workspace.manage",
  // v2.0 Checkpoint 38 — Smart Workspace Platform. `workspace.view` already
  // gates seeing the new Workspace Home; this one gates writes to a
  // member's own widget layout/favorites/recent items — mock-only this
  // phase, same "catalog entry added ahead of its migration row" precedent
  // every prior checkpoint's own permission additions already established.
  "workspace.customize",
  "team.view",
  "team.invite",
  "team.manage_roles",
  "team.deactivate",
  "leads.view",
  "leads.create",
  "leads.update",
  "leads.archive",
  "clients.view",
  "clients.create",
  "clients.update",
  "clients.archive",
  "events.view",
  "events.create",
  "events.update",
  "events.archive",
  "contracts.view",
  "contracts.create",
  "contracts.update",
  "contracts.lifecycle",
  "finance.view",
  "finance.create",
  "finance.update",
  "finance.refund",
  "documents.view",
  "documents.create",
  "documents.update",
  "documents.archive",
  "clients.portal_view",
  "clients.portal_invite",
  "clients.portal_manage",
  "clients.portal_suspend",
  "analytics.view",
  // v2.0 Checkpoint 24 — Communication & Collaboration Platform.
  // "communications.view" gates the Notification Center/Unified
  // Inbox/Activity Feed/Timeline routes; "communications.manage" gates
  // publishing Announcements (a workspace-wide broadcast, deliberately
  // narrower than plain "view", same precedent as `clients.portal_manage`
  // vs. `clients.portal_view`).
  "communications.view",
  "communications.manage",
  // v2.0 Checkpoint 41 — Notification Center. Additive to `communications.view`/
  // `.manage`, never a replacement — every existing `/communications` route
  // and `notificationActions.ts` action keeps gating on `communications.view`
  // unchanged. These four gate the new `/notifications*` route tree
  // specifically: "notifications.view" for the Dashboard/Detail (same
  // members who already get `communications.view` get this too — see
  // `permissionMatrix.ts`), "notifications.preferences" for editing one's
  // own preferences (broad — every member manages their own), and
  // "notifications.manage"/"notifications.templates" for the narrower
  // workspace-wide actions (bulk operations, template library access),
  // mirroring the same narrower-manage/broader-view split
  // `communications.view`/`.manage` already established.
  "notifications.view",
  "notifications.manage",
  "notifications.templates",
  "notifications.preferences",
  // v2.0 Checkpoint 25 — Digital Asset Management Platform. "assets.manage"
  // gates upload/replace-version/approve-reject/folder-collection mutation;
  // "assets.view" gates the Asset Library, Asset Intelligence, and Knowledge
  // Graph Explorer routes — the same "narrower manage, broader view" split
  // `clients.portal_view`/`clients.portal_manage` already established.
  "assets.view",
  "assets.manage",
  // v2.0 Checkpoint 26 — Mobile Workforce Platform Foundation. "workforce.manage"
  // gates create/update Worker/Team/Assignment/Equipment/Vehicle mutations;
  // "workforce.view" gates the Workforce Dashboard and read-only lookups —
  // the same narrower-manage/broader-view split `assets.view`/`assets.manage`
  // established above.
  "workforce.view",
  "workforce.manage",
  // v2.0 Checkpoint 26.1 — Workforce Capability & Eligibility Platform.
  // "workforce.capabilities.view" gates the Capability Dashboard,
  // Requirement Detail, and Worker Capability views (reading saved
  // requirements, eligibility results, rankings, coverage/risk reports);
  // "workforce.capabilities.manage" gates create/update/archive/duplicate
  // on Capability Requirements and triggering a re-evaluation — same
  // narrower-manage/broader-view split every other module here uses.
  // "workforce.sensitive_data.view" is a separate, narrower gate for the
  // genuinely sensitive fields Step 26 (Privacy) calls out — a worker's
  // location, emergency contact, and certification documents — kept
  // distinct from ordinary capability viewing so a caller can see
  // eligibility results without also being granted the underlying
  // sensitive data.
  "workforce.capabilities.view",
  "workforce.capabilities.manage",
  "workforce.sensitive_data.view",
  // v2.0 Checkpoint 27 — Enterprise Scheduling Platform.
  // "scheduling.view" gates the Calendar Dashboard/Detail views, capacity,
  // and conflict reading (View Calendars/View Capacity/View Conflicts in
  // the spec's own list); "scheduling.manage" gates every write surface
  // (Manage Calendars/Reservations/Working Hours/Holidays, Archive
  // Calendars) — the same narrower-manage/broader-view split every other
  // module in this codebase uses, rather than eight separate permissions
  // for what is really one read/write boundary.
  "scheduling.view",
  "scheduling.manage",
  // v2.0 Checkpoint 27.1 — Resource Allocation Platform.
  // "allocations.view" gates the Allocation Dashboard/Detail views, the
  // Resource Pool, and allocation scores (View Allocations/View Resource
  // Pool/View Allocation Scores in the spec's own list); "allocations.manage"
  // gates every write surface (Manage Allocations/Bundles, Approve
  // Allocation, Archive Allocation) — the same narrower-manage/broader-view
  // split every other module in this codebase uses, rather than seven
  // separate permissions for what is really one read/write boundary.
  "allocations.view",
  "allocations.manage",
  // v2.0 Checkpoint 27.2 — Operational Planning Platform.
  // "operational_planning.view" gates the Operational Dashboard/Plan Detail
  // views, evidence requirements, and deliverables (View Plans/View
  // Evidence Requirements/View Deliverables in the spec's own list);
  // "operational_planning.manage" gates every write surface (Manage Plans,
  // Manage Templates, Approve Plans, Archive Plans) — the same
  // narrower-manage/broader-view split every other module in this
  // codebase uses, rather than seven separate permissions for what is
  // really one read/write boundary.
  "operational_planning.view",
  "operational_planning.manage",
  // v2.0 Checkpoint 27.3 — Execution Package Platform.
  // "execution_packages.view" gates the Execution Package Dashboard/Detail
  // views, package health, and package versions (View Packages/View Package
  // Health/View Package Versions in the spec's own list);
  // "execution_packages.manage" gates every write surface (Manage Packages,
  // Approve Packages, Archive Packages) — the same narrower-manage/
  // broader-view split every other module in this codebase uses, rather
  // than six separate permissions for what is really one read/write
  // boundary.
  "execution_packages.view",
  "execution_packages.manage",
  // v2.0 Checkpoint 28 — Dispatch Platform. The spec names 6 capabilities
  // (View Dispatch Orders, View Dispatch Queue, View Dispatch History,
  // Create/Manage Dispatch Orders, Accept/Decline Assignments, Cancel/
  // Archive Dispatch Orders) — "dispatch.view" gates the Dispatch
  // Dashboard/Detail views, the Queue, and Dispatch History (the three
  // named "View" capabilities); "dispatch.manage" gates every write
  // surface (build/dispatch/cancel/archive orders, accept/decline/timeout
  // assignments) — the same narrower-manage/broader-view split every
  // other module in this codebase uses, rather than six separate
  // permissions for what is really one read/write boundary.
  "dispatch.view",
  "dispatch.manage",
  // v2.0 Checkpoint 29 — Field Operations Platform. The spec names 8
  // capabilities (View Field Operations, Manage Field Operations, Start/
  // Pause/Resume/Complete/Cancel/Archive Session) — "field_operations.view"
  // gates the Field Operations Dashboard/Detail views; "field_operations.manage"
  // gates every write surface (build a field operation, every one of the
  // 7 named session actions) — the same narrower-manage/broader-view
  // split every other module in this codebase uses, rather than eight
  // separate permissions for what is really one read/write boundary.
  "field_operations.view",
  "field_operations.manage",
  // v2.0 Checkpoint 30 — Route Optimization Platform. The spec names 2
  // capabilities directly (route_optimization.view/route_optimization.manage),
  // already a narrower-manage/broader-view split — "route_optimization.view"
  // gates the Optimization Dashboard/Route Detail views; "route_optimization.manage"
  // gates every write surface (build/optimize/validate/approve/archive a
  // route plan) — the same split every other module in this codebase uses.
  "route_optimization.view",
  "route_optimization.manage",
  // v2.0 Checkpoint 31 — Real-Time Operations Center. The spec names 6
  // capabilities directly, finer-grained than the usual view/manage pair
  // since Operations Center sits above every other module and needs its
  // own acknowledge/resolve/sensitive-data boundaries distinct from a
  // blanket "manage": "operations_center.view" gates the Dashboard/Alert
  // Detail/Incident Detail views; "operations_center.manage" is reserved
  // for future admin-level configuration of the Operations Center itself
  // (no such surface exists yet this checkpoint); "operations_alerts.acknowledge"/
  // "operations_alerts.resolve" gate the two named Alert Lifecycle actions
  // that actually change an alert's status (dismiss/escalate ride on
  // "operations_alerts.acknowledge" too, since they are the same class of
  // action); "operations_incidents.manage" gates creating/transitioning an
  // Incident; "operations_sensitive_data.view" gates exact worker location
  // data and other fields Step 25's own Privacy section names as
  // protected, kept separate from plain "operations_center.view" so a
  // wider audience can see the dashboard without seeing sensitive fields.
  "operations_center.view",
  "operations_center.manage",
  "operations_alerts.acknowledge",
  "operations_alerts.resolve",
  "operations_incidents.manage",
  "operations_sensitive_data.view",
  // v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform. The spec
  // names 7 capabilities directly: "client_journeys.view" gates the
  // Dashboard/Journey Detail views (read-only, including every existing
  // commercial record the Journey surfaces); "client_journeys.manage" gates
  // creating Information Requests and every other non-transition mutation;
  // "client_journeys.assign" is split out from "manage" specifically for
  // Journey Ownership (Step 13), since assigning who owns a client
  // relationship is a distinct capability from managing the journey's own
  // content; "client_journeys.transition" is split out separately again
  // because a validated stage transition (cancel/lose/restore/reopen) is a
  // more consequential action than an ordinary edit and some roles should
  // manage a journey's content without being able to cancel it outright;
  // "client_information_requests.view"/".manage" mirror the same
  // narrower-manage/broader-view split for the one other persisted entity
  // this checkpoint owns; "client_journey_sensitive_data.view" gates
  // private client notes/financial/contract details the same way
  // "operations_sensitive_data.view" gates worker location data above.
  "client_journeys.view",
  "client_journeys.manage",
  "client_journeys.assign",
  "client_journeys.transition",
  "client_information_requests.view",
  "client_information_requests.manage",
  "client_journey_sensitive_data.view",
  // v2.0 Checkpoint 33 — Proposal & Quote Platform. The spec names 9
  // capabilities directly, one narrower-manage/broader-view pair per
  // sub-surface rather than one blanket "proposals.manage", since a role
  // that can edit pricing shouldn't automatically be able to manage the
  // shared Template/Package/Add-on libraries every proposal in the
  // workspace draws from: "proposal_templates.view"/".manage" gate the
  // Template Library; "proposal_builder.view"/".manage" gate the
  // Dashboard/Detail/Builder screens and every document-lifecycle action
  // (create version, publish, archive, restore, send); "proposal_versions.view"/
  // ".manage" gate seeing vs. creating/restoring versions specifically,
  // split out from "proposal_builder.manage" because comparing/restoring
  // history is a distinct, more consequential capability than everyday
  // editing; "proposal_pricing.manage"/"proposal_packages.manage"/
  // "proposal_addons.manage" gate the Pricing Engine's own inputs and the
  // two reusable libraries the spec names as their own capabilities.
  "proposal_templates.view",
  "proposal_templates.manage",
  "proposal_builder.view",
  "proposal_builder.manage",
  "proposal_versions.view",
  "proposal_versions.manage",
  "proposal_pricing.manage",
  "proposal_packages.manage",
  "proposal_addons.manage",
  // v2.0 Checkpoint 34 — Contract Management Platform. The spec names 8
  // capabilities directly, the same narrower-manage/broader-view split
  // Proposal Platform established above: "contract_templates.view"/".manage"
  // gate the Builder Template Library; "contract_builder.view"/".manage" gate
  // the Dashboard/Detail/Builder screens and every document-lifecycle action
  // (create version, publish, archive, restore); "contract_versions.view"/
  // ".manage" gate seeing vs. creating/restoring versions specifically, split
  // out from "contract_builder.manage" for the same reason
  // "proposal_versions.manage" was split out; "contract_clauses.manage"/
  // "contract_variables.manage" gate the two reusable engines the spec names
  // as their own capabilities (the Clause Library and the Variable Engine's
  // own resolved-value overrides). Never edit-signature or e-signature
  // permissions — those stay out of scope for this checkpoint by design.
  "contract_templates.view",
  "contract_templates.manage",
  "contract_builder.view",
  "contract_builder.manage",
  "contract_versions.view",
  "contract_versions.manage",
  "contract_clauses.manage",
  "contract_variables.manage",
  // v2.0 Checkpoint 35 — Invoice & Billing Platform. The spec names 8
  // capabilities directly, the same narrower-manage/broader-view split
  // Proposal/Contract Platform established above: "invoice_templates.view"/
  // ".manage" gate the Template Library; "invoice_builder.view"/".manage" gate
  // the Dashboard/Detail/Builder screens and every document-lifecycle action
  // (create version, publish, archive, restore); "invoice_versions.view"/
  // ".manage" gate seeing vs. creating/restoring versions specifically, split
  // out from "invoice_builder.manage" for the same reason
  // "contract_versions.manage" was split out; "invoice_adjustments.manage"
  // gates the Credit & Adjustment Engine's own mutations (credits, manual
  // adjustments, refund placeholders); "invoice_billing.manage" gates the
  // Billing/Installment Engine's own inputs (payment schedule, deposit).
  // Never real payment-processing permissions — those stay out of scope for
  // this checkpoint by design (see `types/invoicePlatform.ts`).
  "invoice_templates.view",
  "invoice_templates.manage",
  "invoice_builder.view",
  "invoice_builder.manage",
  "invoice_versions.view",
  "invoice_versions.manage",
  "invoice_adjustments.manage",
  "invoice_billing.manage",
  // Checkpoint 36 — Unified Client Portal Experience. Every client-facing
  // Center this checkpoint built (Journey/Proposals/Contracts/Billing/
  // Documents/Communication/Timeline/Tasks/Events/Profile/Settings) is
  // gated by the client's own `ClientAccountContext` session, never by
  // this PERMISSIONS catalog — a client account has no role or granted
  // permission to check. Most of the internal-team-facing surfaces this
  // checkpoint touches are already covered by an existing permission
  // (`clients.portal_view`/`.portal_invite`/`.portal_manage`/`.portal_suspend`
  // for account lifecycle, `communications.manage` for Announcements,
  // `analytics.view` for the Portal analytics tab). "client_portal.view"
  // and "client_portal.manage" cover the two genuinely new internal
  // capabilities: viewing a specific client's own Portal Activity log from
  // their Client record (the new `ClientPortalActivitySection`, Step 17),
  // and toggling a Checklist item's `client_visible` flag so it actually
  // appears in that client's Task Center (Step 9's own disclosed gap —
  // no internal UI ever exposed this before now) — the same
  // narrower-manage/broader-view split every other module here uses.
  "client_portal.view",
  "client_portal.manage",
  // v2.0 Checkpoint 42 — Reporting & Business Intelligence Platform. A
  // unified read/presentation layer over every other platform's own
  // already-permission-checked metrics — these permissions gate the
  // Reporting Center itself, never a metric's own underlying data (each
  // `ReportMetricDefinition.requiredPermissions` still enforces that
  // module's own gate independently; see `core/reporting/discovery.ts`).
  // "reports.view" — the Reporting Center, report library, and report
  // detail/preview. "reports.manage" — save/archive/restore a report.
  // "reports.build" — the Report Builder (composing a new report from
  // registered metrics). "reports.snapshots" — generating a snapshot.
  // "reports.financial" — a narrower gate for report sections/templates
  // that surface finance-category metrics, mirroring `finance.view`'s own
  // scope. "reports.executive" — executive-category templates/sections,
  // mirroring `assets.view`'s own scope on the Executive Decisions/
  // Objectives pages those metrics wrap. "reports.client_safe" — the
  // Client Portal's own allowlisted report surface (Step 13), a
  // deliberately separate, much narrower gate from every permission above.
  "reports.view",
  "reports.manage",
  "reports.build",
  "reports.snapshots",
  "reports.financial",
  "reports.executive",
  "reports.client_safe",
  // v2.0 Checkpoint 43 — External Integrations Platform. The Checkpoint 22
  // Integration Platform and every real Stripe action gated on the single
  // generic `workspace.manage` permission — genuinely coarse for a
  // platform that can now move money, send email/SMS on a client's
  // behalf, and touch e-signature/storage. These permissions replace that
  // single gate with per-capability granularity; `workspace.manage` still
  // works as a superset for existing Checkpoint 22/23 call sites that
  // haven't been migrated (see docs/integration-permissions.md for the
  // migration list). "integrations.view" — the Connection Center itself.
  // "integrations.manage" — install/uninstall a provider, edit
  // connection config. "integrations.connect"/"integrations.disconnect" —
  // narrower than `.manage`, gating just the OAuth/connect and
  // disconnect/revoke actions (an operator can disconnect a
  // mis-signed-in staff connection without holding full manage rights).
  // "integrations.logs" — Diagnostics/audit trail read access.
  // "integrations.webhooks" — webhook endpoint/delivery management.
  // "integrations.payments"/"integrations.calendar"/"integrations.email"/
  // "integrations.messaging"/"integrations.storage"/"integrations.signatures"
  // — per-category action gates (e.g. "create a Stripe payment link"
  // needs `.payments`, "send an approved email" needs `.email`).
  // "integrations.sensitive" — the single narrowest gate: viewing a
  // connection's real external account identity/scopes, and any action
  // that could reveal which real external accounts are connected.
  "integrations.view",
  "integrations.manage",
  "integrations.connect",
  "integrations.disconnect",
  "integrations.logs",
  "integrations.webhooks",
  "integrations.payments",
  "integrations.calendar",
  "integrations.email",
  "integrations.messaging",
  "integrations.storage",
  "integrations.signatures",
  "integrations.sensitive",
  // Checkpoint 45A — Finding 14. `executiveDecisionsActions.ts`'s
  // `updateDecisionStatusAction` and `objectivesActions.ts`'s
  // `createObjectiveAction`/`updateObjectiveStatusAction` correctly
  // checked workspace ownership but held no permission string at all —
  // any active member of any role could approve/reject an Executive
  // Decision or change a company Objective's status. One `.manage` gate
  // each, the same narrower-manage-only pattern used where a platform's
  // mutations are sensitive enough that a blanket `.view` counterpart
  // isn't needed (the read actions in both files stay ungated, matching
  // the audit's own scoped finding — only the mutations were flagged).
  "executive_decisions.manage",
  "objectives.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
