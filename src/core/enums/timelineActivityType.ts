export const TIMELINE_ACTIVITY_TYPES = [
  "lead_created",
  "lead_updated",
  "status_changed",
  "note_added",
  "note_pinned",
  "note_unpinned",
  "welcome_guide_sent",
  "lead_archived",
  "lead_converted",
  "client_created",
  "client_updated",
  "tags_changed",
  "vip_status_changed",
  "communication_preference_changed",
  "client_archived",
  "client_restored",
  "client_recovery_pending",
  "client_recovery_resolved",
  "event_created",
  "event_updated",
  "lifecycle_stage_changed",
  "priority_changed",
  "checklist_item_created",
  "checklist_item_completed",
  "checklist_template_applied",
  "schedule_item_created",
  "schedule_item_updated",
  "event_archived",
  "event_restored",
  "event_cancelled",
  "event_completed",
  "contract_created",
  "contract_updated",
  "contract_sent",
  "contract_viewed",
  "contract_signed",
  "contract_declined",
  "contract_cancelled",
  "contract_completed",
  "contract_archived",
  "contract_restored",
  "invoice_created",
  "invoice_updated",
  "invoice_issued",
  "invoice_sent",
  "invoice_viewed",
  "invoice_partially_paid",
  "invoice_paid",
  "invoice_overdue",
  "invoice_voided",
  "invoice_archived",
  "invoice_restored",
  // Finance F2.1C-D-C — Invoice Financial Adjustment. Recorded whenever a
  // post-issuance correction changes an Invoice's recognized subtotal/tax/
  // discount; the append-only correction Journal Entry (source_type
  // 'invoice_adjustment') remains the accounting source of truth, this is
  // operational history only.
  "invoice_adjusted",
  "payment_created",
  "payment_processing",
  "payment_succeeded",
  "payment_failed",
  "payment_refunded",
  "deposit_applied",
  "payment_cancelled",
  "expense_created",
  "expense_updated",
  "expense_approved",
  "expense_marked_due",
  "expense_paid",
  "expense_reimbursed",
  "expense_cancelled",
  "expense_archived",
  "expense_restored",
  "document_created",
  "document_metadata_updated",
  "document_version_created",
  "document_activated",
  "document_superseded",
  "document_expired",
  "document_archived",
  "document_restored",
  "document_soft_deleted",
  "document_visibility_changed",
  "document_moved_to_folder",
  "document_downloaded",
  "document_folder_created",
  "document_folder_renamed",
  "document_folder_moved",
  "document_folder_archived",
  "document_folder_restored",
  "document_folder_template_applied",
  "media_asset_uploaded",
  "media_asset_version_replaced",
  "media_asset_archived",
  "media_asset_restored",
  // v2.0 Checkpoint 25 — Digital Asset Management Platform, Step 9 (Approval Workflow).
  "media_asset_approved",
  "media_asset_rejected",
  "media_asset_needs_revision",
  "media_asset_status_reset",
  // Checkpoint 25, Step 3 (Folders & Collections).
  "media_asset_moved_to_folder",
  "media_folder_created",
  "media_folder_moved",
  "media_collection_created",
  "media_asset_added_to_collection",
  "media_asset_removed_from_collection",
  // Checkpoint 25, Step 10.5/13 — Enterprise Knowledge Graph. Recorded
  // against whichever endpoint of the edge is itself a Timeline-capable
  // EntityType (the graph also connects node types — Comment, Workflow,
  // AI Insight — that don't own a Timeline; those mutations simply have no
  // Timeline entry, the same "not every node supports every feature"
  // limitation `docs/knowledge-graph.md` already discloses for versioning).
  "knowledge_relationship_created",
  "knowledge_relationship_removed",
  "knowledge_relationship_semantics_updated",
  "knowledge_relationship_constraint_violated",
  // Checkpoint 25, Step 15.5 — Operational Intelligence Layer. Recorded
  // against the "workspace" EntityType for workspace-wide signals
  // (health/warning), or against the specific node for readiness/
  // constraint signals. Deliberately "operational_"-prefixed and distinct
  // from the Step 13 `knowledge_relationship_constraint_violated` above:
  // that one fires synchronously when a user's mutation attempt is
  // blocked; these fire from a periodic Business Health evaluation
  // diffing against its own prior snapshot — a different trigger surface,
  // not a duplicate of the same event.
  "operational_health_improved",
  "operational_health_declined",
  "operational_constraint_violated",
  "operational_constraint_fixed",
  "operational_readiness_increased",
  "operational_readiness_decreased",
  "operational_workspace_warning",
  "operational_critical_dependency_detected",
  // Checkpoint 25, Step 15.6 — Operational Objectives Layer. Explicit
  // lifecycle transitions on an Objective (recorded against the
  // objective's own `node` when it has one, or "workspace" for
  // department/project/custom-scoped objectives) — a different trigger
  // surface again from Step 15.5's periodic-evaluation diff events above:
  // these fire the moment a status transition happens, not on a
  // recurring health scan.
  "objective_created",
  "objective_started",
  "objective_updated",
  "objective_completed",
  "objective_blocked",
  "objective_reopened",
  "objective_archived",
  // Checkpoint 25.7 — Executive Decision Platform. Explicit lifecycle
  // transitions on a Decision (recorded against the Decision's own
  // `related_entities[0]` when it has one, or "workspace" otherwise) —
  // same "fires the moment a transition happens" surface as the
  // Objective events above, one layer up the stack.
  "decision_created",
  "decision_updated",
  "decision_resolved",
  // "priority_changed" (no prefix) already exists for Event's own priority
  // field (see events/mockRepository.ts) — a genuinely different concept
  // from a Decision's priority, so this gets its own distinct name rather
  // than colliding on the same enum value.
  "decision_priority_changed",
  "decision_escalated",
  "decision_reopened",
  "decision_archived",
  // v2.0 Checkpoint 26 — Mobile Workforce Platform Foundation. Covers
  // Worker/Team/Assignment/Equipment/Vehicle/Mobile Session lifecycle —
  // see `docs/workforce.md`. No scheduling/dispatch events exist here on
  // purpose, per this checkpoint's own stop condition.
  "worker_created",
  "worker_updated",
  "worker_status_changed",
  "worker_availability_changed",
  "worker_archived",
  "worker_restored",
  "team_created",
  "team_updated",
  "worker_added_to_team",
  "worker_removed_from_team",
  "team_archived",
  "assignment_created",
  "assignment_ended",
  "assignment_cancelled",
  "equipment_created",
  "equipment_status_changed",
  "equipment_assigned",
  "vehicle_created",
  "vehicle_status_changed",
  "vehicle_assigned",
  "mobile_session_started",
  "mobile_session_ended",
  // v2.0 Checkpoint 26.1 — Workforce Capability & Eligibility Platform.
  // Capability Requirement events are recorded against the requirement's
  // own `context` node when one exists (else the workspace); Worker
  // evaluation events are recorded against the worker. Per the spec's
  // own "avoid Timeline noise" instruction, `worker_evaluated` and
  // `capability_score_changed` are only ever emitted when
  // `capabilityEvaluationSnapshotsStore.ts` detects a real state or
  // meaningful score-threshold change from the prior evaluation — never
  // on every re-evaluation unconditionally.
  "capability_requirement_created",
  "capability_requirement_updated",
  "capability_requirement_archived",
  "worker_evaluated",
  "worker_became_eligible",
  "worker_became_ineligible",
  "worker_became_conditionally_eligible",
  "capability_score_changed",
  "certification_became_expired",
  "capability_blocker_detected",
  // v2.0 Checkpoint 27 — Enterprise Scheduling Platform.
  "appointment_created",
  "appointment_updated",
  "appointment_cancelled",
  "reservation_created",
  "reservation_confirmed",
  "reservation_expired",
  "scheduling_conflict_detected",
  "scheduling_conflict_resolved",
  "calendar_updated",
  // v2.0 Checkpoint 27.1 — Resource Allocation Platform.
  "allocation_created",
  "allocation_updated",
  "allocation_recalculated",
  "allocation_fallback_used",
  "allocation_dependency_failed",
  "allocation_bundle_completed",
  "allocation_approved",
  "allocation_archived",
  // v2.0 Checkpoint 27.2 — Operational Planning Platform.
  "plan_created",
  "plan_updated",
  "plan_approved",
  "plan_archived",
  "phase_added",
  "step_added",
  "milestone_completed",
  "approval_required",
  "deliverable_added",
  "evidence_requirement_added",
  // v2.0 Checkpoint 27.3 — Execution Package Platform.
  "package_created",
  "package_updated",
  "package_validated",
  "package_approved",
  "package_archived",
  "snapshot_created",
  "version_created",
  // v2.0 Checkpoint 28 — Dispatch Platform.
  "dispatch_created",
  "dispatch_assignment_created",
  "assignment_accepted",
  "assignment_declined",
  "dispatch_cancelled",
  "dispatch_archived",
  "queue_updated",
  // v2.0 Checkpoint 29 — Field Operations Platform.
  "execution_started",
  "execution_paused",
  "execution_resumed",
  "execution_completed",
  "execution_cancelled",
  "execution_failed",
  "execution_archived",
  // v2.0 Checkpoint 30 — Route Optimization Platform.
  "route_created",
  "route_optimized",
  "route_validated",
  "route_approved",
  "route_archived",
  "optimization_recalculated",
  // v2.0 Checkpoint 31 — Real-Time Operations Center. Alert/Incident are
  // the only genuinely new stateful entities this checkpoint owns —
  // every other event this checkpoint could log (a route being
  // optimized, a dispatch being created) already fires its own Timeline
  // event from that module's own action, never duplicated here.
  "operational_alert_opened",
  "operational_alert_acknowledged",
  "operational_alert_resolved",
  "operational_alert_dismissed",
  "operational_alert_escalated",
  "operational_incident_opened",
  "operational_incident_acknowledged",
  "operational_incident_resolved",
  // v2.0 Checkpoint 32 — Client Journey & CRM Experience Platform. Most of
  // the spec's 28 named Journey Timeline events already have a real,
  // existing Timeline event from their own owning module (lead_created,
  // lead_converted, contract_sent/viewed/signed, invoice_sent/viewed/paid,
  // payment_succeeded, event_completed, ...) and the Journey Timeline
  // Adapter merges those in unchanged — no duplicate event is recorded for
  // any of them. These 12 are the only genuinely new events, each with its
  // own real call site: `proposal_created/accepted/declined` are recorded
  // by the existing Proposal actions (generateProposalDraft/
  // acceptProposalDraft/rejectProposalDraft — Proposal had no Timeline
  // recording at all before this checkpoint); the other 9 are recorded by
  // this checkpoint's own module layer (`clientJourneyActions.ts`) for
  // manual journey actions that have no other owner — Portal Activated,
  // Welcome Sent Internally, Planning Started, Service Started, Final
  // Balance Paid, Review Requested, Review Received, Journey Reopened,
  // Journey Cancelled. "First Contact Recorded"/"Qualification Updated"/
  // "Proposal Sent"/"Proposal Viewed" (also named in the spec) are
  // deliberately NOT new types here — they read from the existing
  // `status_changed` (Lead) event and the Proposal's own `reviewed_at`
  // field instead, since inventing a dedicated event for something with
  // no real trigger would be a fabricated fact, not a reused one.
  "proposal_created",
  "proposal_accepted",
  "proposal_declined",
  "portal_activated",
  "welcome_sent_internally",
  "planning_started",
  "service_started",
  "final_balance_paid",
  "review_requested",
  "review_received",
  "journey_reopened",
  "journey_cancelled",
  // v2.0 Checkpoint 33 — Proposal & Quote Platform. `proposal_created`/
  // `proposal_accepted`/`proposal_declined` above stay exactly as
  // Checkpoint 32 defined them (the AI-generation/staff-decision
  // lifecycle). This checkpoint adds the real Send/View triggers that
  // Checkpoint 32 explicitly deferred (see that block's own comment) now
  // that the Proposal Builder actually has a document to send and a
  // Client Portal surface that actually opens it: `proposal_document_sent`/
  // `proposal_document_viewed`. The other 5 cover this checkpoint's own
  // new document lifecycle (`ProposalBuilderState`/`ProposalVersion`,
  // `types/proposalPlatform.ts`) — Published/Archived/Restored/Compared/
  // Version Created. "Proposal Updated" (also named in the spec) is
  // deliberately NOT a separate type: every edit becomes a new
  // append-only `ProposalVersion` (Step 8's own "never overwrite"), so
  // `proposal_version_created` already covers it — a second event for the
  // same action would be a fabricated duplicate, not a reused fact.
  // `proposal_revision_requested`/`proposal_client_response_recorded`
  // cover the Client Portal's own "Request Revision"/"Accept
  // Placeholder"/"Decline Placeholder" actions (Step 14) — the client's
  // recorded intent, distinct from and never a substitute for the real,
  // staff-only `proposal_accepted`/`proposal_declined` transition
  // (`acceptProposalDraft.ts`/`rejectProposalDraft.ts`), since this
  // checkpoint's own stop condition forbids building real e-signature
  // authority for a client's click.
  "proposal_document_published",
  "proposal_document_archived",
  "proposal_document_restored",
  "proposal_document_compared",
  "proposal_document_sent",
  "proposal_document_viewed",
  "proposal_version_created",
  "proposal_revision_requested",
  "proposal_client_response_recorded",
  // v2.0 Checkpoint 34 — Contract Management Platform. "Contract Created"/
  // "Contract Updated" (also named in the spec's own Step 10) are
  // deliberately NOT new types here — `contract_created`/`contract_updated`
  // already exist (added in an earlier, foundational Contracts phase) and
  // are already real, wired events fired by `createContract`/`updateContract`
  // themselves; adding a second pair would be a fabricated duplicate, not a
  // reused fact. These 8 are this checkpoint's own genuinely new events,
  // for the additive document/builder layer only (`ContractBuilderState`/
  // `ContractVersion`, `types/contractPlatform.ts`) — every one prefixed
  // `contract_document_*` (or otherwise disambiguated) specifically so
  // they never collide with the real Contract record's own existing
  // `contract_archived`/`contract_restored` (fired by `archiveContract`/
  // `restoreContract` in `modules/contracts/`, a completely different,
  // pre-existing action on the real commercial record, not this
  // checkpoint's own document-builder layer).
  "contract_document_version_created",
  "contract_document_published",
  "contract_document_archived",
  "contract_document_restored",
  "contract_document_compared",
  "contract_document_ready",
  "contract_linked_to_proposal",
  "contract_linked_to_journey",
  // v2.0 Checkpoint 35 — Invoice & Billing Platform. The real `Invoice`
  // record already fires `invoice_created`/`invoice_updated`/`invoice_issued`/
  // `invoice_sent`/`invoice_viewed`/`invoice_partially_paid`/`invoice_paid`/
  // `invoice_overdue`/`invoice_voided`/`invoice_archived`/`invoice_restored`
  // (an earlier, foundational Finance phase) — these 10 are this
  // checkpoint's own genuinely new events for the additive document/builder
  // layer only (`InvoiceBuilderState`/`InvoiceVersion`,
  // `types/invoicePlatform.ts`), every one prefixed `invoice_document_*` (or
  // otherwise disambiguated) specifically so they never collide with the
  // real Invoice record's own existing events, mirroring
  // `contract_document_*` above.
  "invoice_document_version_created",
  "invoice_document_published",
  "invoice_document_archived",
  "invoice_document_restored",
  "invoice_document_compared",
  "invoice_document_ready",
  "invoice_linked_to_proposal",
  "invoice_linked_to_contract",
  "invoice_installments_scheduled",
  "invoice_credit_applied",
  // v2.0 Checkpoint 37 — Digital Asset Management Platform. Most of the
  // spec's own named events already exist from Checkpoint 25's foundational
  // work: "asset_created"/"asset_updated"/"asset_deleted"/"asset_moved"/
  // "asset_version_created" are exactly `media_asset_uploaded`/
  // `media_asset_version_replaced` (a version replace IS the update)/
  // `media_asset_archived` (soft-delete)/`media_asset_moved_to_folder`/
  // `media_asset_version_replaced` again — adding a second, differently-named
  // event for the same action would be a fabricated duplicate, not a reused
  // fact. "asset_review_added" is likewise already covered more precisely by
  // the existing `media_asset_approved`/`media_asset_rejected`/
  // `media_asset_needs_revision` trio. These 4 are the only genuinely new
  // events this checkpoint's own Step 2 stores (favorites/shares/downloads)
  // and Step 7 Communication (comments) need: "asset_shared" fires from
  // `shareAssetAction`; "asset_downloaded" fires alongside a real download
  // (never from the button being visible, only a real
  // `downloadMediaAsset`/`getMediaAssetDownloadUrl` call succeeding);
  // "asset_comment_added" fires from `commentOnAssetAction` (the generic
  // Comments Platform itself never auto-records Timeline entries for any
  // owner type); "asset_version_restore_attempted" fires from the Version
  // Engine's own inert "Restore placeholder" action (Step 4) — a real,
  // logged attempt, distinct from the archive-restore `media_asset_restored`
  // event, since restoring a *version* never actually succeeds this
  // checkpoint (see `core/digitalAssets/versionEngine.ts`).
  "asset_shared",
  "asset_downloaded",
  "asset_comment_added",
  "asset_version_restore_attempted",
  // v2.0 Checkpoint 41 — Notification Center. A notification's own history
  // (Step 8, "Generate Timeline events") — owned by `ownerType: "notification"`,
  // an `EntityType` reserved since Checkpoint 2/14 but never given real
  // Timeline events until now. Deliberately not events on the *related*
  // entity (e.g. the Lead a `lead_created` notification is about) — that
  // entity already has its own `lead_created` Timeline event from the real
  // action that triggered the notification; recording a second one there
  // would be duplicate noise, not new information.
  "notification_dispatched",
  "notification_read",
  "notification_archived",
  // v2.0 Checkpoint 42 — Reporting & Business Intelligence Platform. A
  // saved report's own history, owned by `ownerType: "report"` (added to
  // `EntityType` this checkpoint). `report_saved` fires specifically for a
  // from-scratch report saved out of the Builder (`source_template_id ===
  // null`) — distinct from `report_created`, which fires for every report
  // including one instantiated from a template; see
  // `core/reporting/reportingAnalyticsEngine.ts`'s own `reportsSaved` vs
  // `templatesUsed` split for the same distinction. There is deliberately
  // no `report_favorited`/`report_pinned` event — the generic Favorites/
  // Pinned system (Checkpoint 38) has never recorded Timeline activity for
  // any entity type, and singling reports out would be an inconsistent
  // special case, not a genuine gap. Likewise no separate `report_compared`
  // — period comparison is inherent to every report view (`comparisonMode`
  // on the definition itself), not a distinct user action to log.
  "report_created",
  "report_saved",
  "report_updated",
  "report_viewed",
  "report_archived",
  "report_restored",
  "report_snapshot_generated",
  "report_export_requested",
  // v2 Checkpoint 44, Step 13 — Document Bundles (Step 5), owned by
  // `ownerType: "document_bundle"` (added to `EntityType` this checkpoint).
  // Fires from `core/documents/manager.ts`'s own bundle mutation methods —
  // the one place every Bundle write already passes through — so these
  // also flow through `recordTimelineActivity`'s own generic
  // `trigger.timeline-event` Workflow Trigger dispatch (Checkpoint 39) for
  // free, with zero new Workflow engine code.
  "document_bundle_created",
  "document_bundle_item_added",
  "document_bundle_item_removed",
  "document_bundle_ready",
  "document_bundle_sent",
  "document_bundle_viewed",
] as const;

export type TimelineActivityType = (typeof TIMELINE_ACTIVITY_TYPES)[number];

export const TIMELINE_ACTIVITY_LABELS: Record<TimelineActivityType, string> = {
  lead_created: "Lead created",
  lead_updated: "Lead information updated",
  status_changed: "Status changed",
  note_added: "Note added",
  note_pinned: "Note pinned",
  note_unpinned: "Note unpinned",
  welcome_guide_sent: "Welcome Guide sent",
  lead_archived: "Lead archived",
  lead_converted: "Lead converted to Client",
  client_created: "Client created",
  client_updated: "Client information updated",
  tags_changed: "Tags updated",
  vip_status_changed: "VIP status changed",
  communication_preference_changed: "Communication preference changed",
  client_archived: "Client archived",
  client_restored: "Client restored",
  client_recovery_pending: "Recovery pending",
  client_recovery_resolved: "Recovery resolved",
  event_created: "Event created",
  event_updated: "Event information updated",
  lifecycle_stage_changed: "Lifecycle stage changed",
  priority_changed: "Priority changed",
  checklist_item_created: "Checklist item created",
  checklist_item_completed: "Checklist item completed",
  checklist_template_applied: "Default checklist applied",
  schedule_item_created: "Schedule item created",
  schedule_item_updated: "Schedule item updated",
  event_archived: "Event archived",
  event_restored: "Event restored",
  event_cancelled: "Event cancelled",
  event_completed: "Event completed",
  contract_created: "Contract created",
  contract_updated: "Contract updated",
  contract_sent: "Contract sent",
  contract_viewed: "Contract viewed",
  contract_signed: "Contract signed",
  contract_declined: "Contract declined",
  contract_cancelled: "Contract cancelled",
  contract_completed: "Contract completed",
  contract_archived: "Contract archived",
  contract_restored: "Contract restored",
  invoice_created: "Invoice created",
  invoice_updated: "Invoice updated",
  invoice_issued: "Invoice issued",
  invoice_sent: "Invoice sent",
  invoice_viewed: "Invoice viewed",
  invoice_partially_paid: "Invoice partially paid",
  invoice_paid: "Invoice paid",
  invoice_overdue: "Invoice overdue",
  invoice_voided: "Invoice voided",
  invoice_archived: "Invoice archived",
  invoice_restored: "Invoice restored",
  invoice_adjusted: "Invoice financial adjustment recorded",
  payment_created: "Payment created",
  payment_processing: "Payment processing",
  payment_succeeded: "Payment succeeded",
  payment_failed: "Payment failed",
  payment_refunded: "Payment refunded",
  deposit_applied: "Customer Deposit applied",
  payment_cancelled: "Payment cancelled",
  expense_created: "Expense created",
  expense_updated: "Expense updated",
  expense_approved: "Expense approved",
  expense_marked_due: "Expense marked due",
  expense_paid: "Expense paid",
  expense_reimbursed: "Expense reimbursed",
  expense_cancelled: "Expense cancelled",
  expense_archived: "Expense archived",
  expense_restored: "Expense restored",
  document_created: "Document uploaded",
  document_metadata_updated: "Document metadata updated",
  document_version_created: "New version uploaded",
  document_activated: "Document activated",
  document_superseded: "Document superseded by a newer version",
  document_expired: "Document expired",
  document_archived: "Document archived",
  document_restored: "Document restored",
  document_soft_deleted: "Document deleted",
  document_visibility_changed: "Document visibility changed",
  document_moved_to_folder: "Document moved to a different folder",
  document_downloaded: "Document downloaded",
  document_folder_created: "Folder created",
  document_folder_renamed: "Folder renamed",
  document_folder_moved: "Folder moved",
  document_folder_archived: "Folder archived",
  document_folder_restored: "Folder restored",
  document_folder_template_applied: "Default folder template applied",
  media_asset_uploaded: "File uploaded",
  media_asset_version_replaced: "File replaced with a new version",
  media_asset_archived: "File archived",
  media_asset_restored: "File restored",
  media_asset_approved: "File approved",
  media_asset_rejected: "File rejected",
  media_asset_needs_revision: "File needs revision",
  media_asset_status_reset: "File approval status reset",
  media_asset_moved_to_folder: "File moved to a different folder",
  media_folder_created: "Folder created",
  media_folder_moved: "Folder moved",
  media_collection_created: "Collection created",
  media_asset_added_to_collection: "File added to a collection",
  media_asset_removed_from_collection: "File removed from a collection",
  knowledge_relationship_created: "Relationship created",
  knowledge_relationship_removed: "Relationship removed",
  knowledge_relationship_semantics_updated: "Relationship business meaning updated",
  knowledge_relationship_constraint_violated: "Relationship constraint violated",
  operational_health_improved: "Business health improved",
  operational_health_declined: "Business health declined",
  operational_constraint_violated: "Business rule constraint violated",
  operational_constraint_fixed: "Business rule constraint fixed",
  operational_readiness_increased: "Readiness score increased",
  operational_readiness_decreased: "Readiness score decreased",
  operational_workspace_warning: "Workspace health warning",
  operational_critical_dependency_detected: "Critical dependency detected",
  objective_created: "Objective created",
  objective_started: "Objective started",
  objective_updated: "Objective updated",
  objective_completed: "Objective completed",
  objective_blocked: "Objective blocked",
  objective_reopened: "Objective reopened",
  objective_archived: "Objective archived",
  decision_created: "Decision created",
  decision_updated: "Decision updated",
  decision_resolved: "Decision resolved",
  decision_priority_changed: "Decision priority changed",
  decision_escalated: "Decision escalated",
  decision_reopened: "Decision reopened",
  decision_archived: "Decision archived",
  worker_created: "Worker added",
  worker_updated: "Worker profile updated",
  worker_status_changed: "Worker employment status changed",
  worker_availability_changed: "Worker availability changed",
  worker_archived: "Worker archived",
  worker_restored: "Worker restored",
  team_created: "Team created",
  team_updated: "Team updated",
  worker_added_to_team: "Worker added to team",
  worker_removed_from_team: "Worker removed from team",
  team_archived: "Team archived",
  assignment_created: "Assignment created",
  assignment_ended: "Assignment completed",
  assignment_cancelled: "Assignment cancelled",
  equipment_created: "Equipment registered",
  equipment_status_changed: "Equipment status changed",
  equipment_assigned: "Equipment assigned",
  vehicle_created: "Vehicle registered",
  vehicle_status_changed: "Vehicle status changed",
  vehicle_assigned: "Vehicle assigned",
  mobile_session_started: "Mobile session started",
  mobile_session_ended: "Mobile session ended",
  capability_requirement_created: "Capability requirement created",
  capability_requirement_updated: "Capability requirement updated",
  capability_requirement_archived: "Capability requirement archived",
  worker_evaluated: "Worker evaluated",
  worker_became_eligible: "Worker became eligible",
  worker_became_ineligible: "Worker became ineligible",
  worker_became_conditionally_eligible: "Worker became conditionally eligible",
  capability_score_changed: "Capability score changed",
  certification_became_expired: "Certification became expired",
  capability_blocker_detected: "Capability blocker detected",
  appointment_created: "Appointment created",
  appointment_updated: "Appointment updated",
  appointment_cancelled: "Appointment cancelled",
  reservation_created: "Reservation created",
  reservation_confirmed: "Reservation confirmed",
  reservation_expired: "Reservation expired",
  scheduling_conflict_detected: "Scheduling conflict detected",
  scheduling_conflict_resolved: "Scheduling conflict resolved",
  calendar_updated: "Calendar updated",
  allocation_created: "Allocation created",
  allocation_updated: "Allocation updated",
  allocation_recalculated: "Allocation recalculated",
  allocation_fallback_used: "Allocation fallback used",
  allocation_dependency_failed: "Allocation dependency failed",
  allocation_bundle_completed: "Allocation bundle completed",
  allocation_approved: "Allocation approved",
  allocation_archived: "Allocation archived",
  plan_created: "Operational plan created",
  plan_updated: "Operational plan updated",
  plan_approved: "Operational plan approved",
  plan_archived: "Operational plan archived",
  phase_added: "Execution phase added",
  step_added: "Execution step added",
  milestone_completed: "Milestone completed",
  approval_required: "Approval required",
  deliverable_added: "Deliverable added",
  evidence_requirement_added: "Evidence requirement added",
  package_created: "Execution package created",
  package_updated: "Execution package updated",
  package_validated: "Execution package validated",
  package_approved: "Execution package approved",
  package_archived: "Execution package archived",
  snapshot_created: "Execution snapshot created",
  version_created: "Execution version created",
  dispatch_created: "Dispatch order created",
  dispatch_assignment_created: "Dispatch assignment created",
  assignment_accepted: "Dispatch assignment accepted",
  assignment_declined: "Dispatch assignment declined",
  dispatch_cancelled: "Dispatch order cancelled",
  dispatch_archived: "Dispatch order archived",
  queue_updated: "Dispatch queue updated",
  execution_started: "Execution started",
  execution_paused: "Execution paused",
  execution_resumed: "Execution resumed",
  execution_completed: "Execution completed",
  execution_cancelled: "Execution cancelled",
  execution_failed: "Execution failed",
  execution_archived: "Execution archived",
  route_created: "Route created",
  route_optimized: "Route optimized",
  route_validated: "Route validated",
  route_approved: "Route approved",
  route_archived: "Route archived",
  optimization_recalculated: "Optimization recalculated",
  operational_alert_opened: "Alert opened",
  operational_alert_acknowledged: "Alert acknowledged",
  operational_alert_resolved: "Alert resolved",
  operational_alert_dismissed: "Alert dismissed",
  operational_alert_escalated: "Alert escalated",
  operational_incident_opened: "Incident opened",
  operational_incident_acknowledged: "Incident acknowledged",
  operational_incident_resolved: "Incident resolved",
  proposal_created: "Proposal created",
  proposal_accepted: "Proposal accepted",
  proposal_declined: "Proposal declined",
  portal_activated: "Client Portal activated",
  welcome_sent_internally: "Welcome message sent",
  planning_started: "Planning started",
  service_started: "Service started",
  final_balance_paid: "Final balance paid",
  review_requested: "Review requested",
  review_received: "Review received",
  journey_reopened: "Journey reopened",
  journey_cancelled: "Journey cancelled",
  proposal_document_published: "Proposal published",
  proposal_document_archived: "Proposal archived",
  proposal_document_restored: "Proposal version restored",
  proposal_document_compared: "Proposal versions compared",
  proposal_document_sent: "Proposal sent to client",
  proposal_document_viewed: "Proposal viewed by client",
  proposal_version_created: "Proposal version created",
  proposal_revision_requested: "Client requested a revision",
  proposal_client_response_recorded: "Client recorded a response",
  contract_document_version_created: "Contract document version created",
  contract_document_published: "Contract document published",
  contract_document_archived: "Contract document archived",
  contract_document_restored: "Contract document version restored",
  contract_document_compared: "Contract document versions compared",
  contract_document_ready: "Contract document marked ready",
  contract_linked_to_proposal: "Contract linked to proposal",
  contract_linked_to_journey: "Contract linked to client journey",
  invoice_document_version_created: "Invoice document version created",
  invoice_document_published: "Invoice document published",
  invoice_document_archived: "Invoice document archived",
  invoice_document_restored: "Invoice document version restored",
  invoice_document_compared: "Invoice document versions compared",
  invoice_document_ready: "Invoice document marked ready",
  invoice_linked_to_proposal: "Invoice linked to proposal",
  invoice_linked_to_contract: "Invoice linked to contract",
  invoice_installments_scheduled: "Invoice installment schedule set",
  invoice_credit_applied: "Invoice credit applied",
  asset_shared: "File shared",
  asset_downloaded: "File downloaded",
  asset_comment_added: "Comment added to file",
  asset_version_restore_attempted: "Version restore requested (not yet supported)",
  notification_dispatched: "Notification dispatched",
  notification_read: "Notification read",
  notification_archived: "Notification archived",
  report_created: "Report created",
  report_saved: "Report saved",
  report_updated: "Report updated",
  report_viewed: "Report viewed",
  report_archived: "Report archived",
  report_restored: "Report restored",
  report_snapshot_generated: "Report snapshot generated",
  report_export_requested: "Report export requested",
  document_bundle_created: "Document bundle created",
  document_bundle_item_added: "Item added to bundle",
  document_bundle_item_removed: "Item removed from bundle",
  document_bundle_ready: "Document bundle marked ready",
  document_bundle_sent: "Document bundle sent",
  document_bundle_viewed: "Document bundle viewed",
};
