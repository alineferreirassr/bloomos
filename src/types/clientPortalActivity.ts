/**
 * Checkpoint 14, Step 1 — "Portal Activity": a log of what a client did
 * inside their own Portal session, distinct from the Timeline (`types/
 * clientPortalTimeline.ts`, which logs what BloomOS did — a Proposal was
 * accepted, an Invoice was issued). Feeds two things at once: Step 14's
 * own observability requirement, and the Dashboard's own "Recent Activity"
 * card (Step 3) — one write path, two read surfaces, never a duplicated
 * log.
 */
export const CLIENT_PORTAL_ACTIVITY_KINDS = [
  "login",
  "document_viewed",
  "document_downloaded",
  "invoice_viewed",
  "timeline_viewed",
  "notification_read",
  "checklist_item_completed",
  "message_sent",
] as const;
export type ClientPortalActivityKind = (typeof CLIENT_PORTAL_ACTIVITY_KINDS)[number];

/**
 * `entityId`/`entityLabel` are optional and always client-safe — a
 * Document's own title, an Invoice's own number, never an internal id a
 * client wouldn't otherwise be shown. Never stores raw content (a
 * message's own body, a checklist comment's own text) — only that the
 * action happened, matching `core/observability/logger`'s own "never log
 * content" discipline applied here to a client-visible feed instead of a
 * server log.
 */
export interface ClientPortalActivity {
  id: string;
  workspace_id: string;
  client_account_id: string;
  kind: ClientPortalActivityKind;
  entity_id: string | null;
  entity_label: string | null;
  occurred_at: string;
}
