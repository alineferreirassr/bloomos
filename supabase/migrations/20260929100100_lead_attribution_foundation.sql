-- SOCIAL-15B — Lead Attribution Data Foundation.
--
-- Purpose: give a future Lead the ability to honestly record which Social
-- Post/Instagram comment/Instagram DM conversation it originated from —
-- the exact gap SOCIAL-15A's own read-only architecture audit found: both
-- halves of the Post<->Comment id match already exist in this schema
-- (social_posts.provider_post_id / instagram_comments.external_media_id),
-- and the comment/conversation id is already available in the Automation
-- Engine's own trigger_facts at Lead-creation time — nothing was ever
-- persisted on the Lead itself to capture it.
--
-- Data foundation only (SOCIAL-15B's own authorized scope). This migration
-- adds NO write path: createLeadFromInstagramCommentAction.ts,
-- createLeadFromInstagramDmAction.ts, InstagramLeadCaptureInput, and every
-- other Lead-capture code path are completely untouched by this
-- checkpoint. Populating these columns at capture time is SOCIAL-15C's own,
-- separately-authorized scope.
--
-- Three new nullable columns on public.leads, each a plain, single-column
-- foreign key to an already-existing table — the exact same shape
-- clients.originating_lead_id (20260717100000_clients.sql) and
-- events.originating_lead_id (20260718100000_events.sql) already use, not
-- a composite (workspace_id, id) key. This codebase has no precedent for a
-- workspace-composite foreign key anywhere in its schema (every FK
-- reviewed for this checkpoint — clients.originating_lead_id,
-- events.client_id, events.originating_lead_id, invoices.client_id/
-- event_id, payments.invoice_id/client_id/event_id — is a plain
-- single-column reference), and Postgres cannot enforce "must belong to
-- the same workspace as the referencing row" via a plain FK without a
-- composite unique key on the parent that includes workspace_id, which
-- none of these tables have (their own primary key is a bare uuid).
--
-- Workspace-isolation limitation, documented rather than worked around:
-- the FK itself cannot prevent a value from a different workspace's
-- social_posts/instagram_comments/instagram_conversations row from being
-- written into a Lead's new columns. Every existing analogous link in this
-- schema (leads.converted_client_id, clients.originating_lead_id) has this
-- same structural property and relies on two things instead: (1) RLS on
-- the SELECT that produces the id in the first place (a caller can only
-- ever read a row belonging to their own workspace, so a legitimately-
-- resolved id is already workspace-correct by construction), and (2)
-- explicit application-level workspace_id verification in the writer
-- before the value is persisted (see convert_lead_to_client()'s own
-- pattern: it only ever sets originating_lead_id to a Lead it already
-- selected under the caller's own RLS session). A future SOCIAL-15C write
-- path populating these three columns must follow that exact same
-- discipline — verify the referenced row's own workspace_id matches the
-- Lead's workspace_id before writing — never rely on the FK alone. No new
-- architecture is introduced here to close this gap differently; it is
-- the same accepted shape this schema already uses everywhere else.
--
-- No backfill: SOCIAL-15A's own audit concluded historical Leads carry no
-- stored evidence sufficient for reliable attribution (no comment/DM id
-- was ever captured on a Lead before this migration existed) — every
-- existing Lead gets all three new columns as NULL by construction (new
-- columns with no default, added to an already-populated table), exactly
-- mirroring how leads.instagram_external_id itself was introduced with
-- zero backfill in 20260928100000_leads_social_capture_foundation.sql.
--
-- RLS: none added. leads already has full RLS (20260716100400_leads_rls.sql);
-- three new nullable columns on an already-protected table need no new
-- policy, and none of the referenced tables (social_posts,
-- instagram_comments, instagram_conversations) have their own RLS altered
-- either.
--
-- Indexes: partial (`where ... is not null`), mirroring every nullable-FK
-- index already in this schema (leads_workspace_instagram_external_id_idx,
-- instagram_comments_external_media_idx) — a mostly-null column gets a
-- small, useful index instead of indexing every all-NULL row.

alter table public.leads
  add column social_post_id uuid references public.social_posts (id) on delete set null,
  add column instagram_comment_id uuid references public.instagram_comments (id) on delete set null,
  add column instagram_conversation_id uuid references public.instagram_conversations (id) on delete set null;

comment on column public.leads.social_post_id is
  'SOCIAL-15B — the Social Post this Lead originated from, when known (resolved via the exact-id Post<->Comment join, never inferred). Nullable; null for every Lead created before this migration and for every Lead not captured from a comment resolvable to a known Post. Populated only by a future SOCIAL-15C write path — this migration adds no writer.';
comment on column public.leads.instagram_comment_id is
  'SOCIAL-15B — the Instagram comment this Lead originated from, when known (comment-triggered capture only; null for a DM-triggered Lead). Nullable, populated only by a future SOCIAL-15C write path.';
comment on column public.leads.instagram_conversation_id is
  'SOCIAL-15B — the Instagram DM conversation this Lead originated from, when known (DM-triggered capture only; null for a comment-triggered Lead). Nullable, populated only by a future SOCIAL-15C write path.';

create index if not exists leads_social_post_id_idx
  on public.leads (social_post_id)
  where social_post_id is not null;

create index if not exists leads_instagram_comment_id_idx
  on public.leads (instagram_comment_id)
  where instagram_comment_id is not null;

create index if not exists leads_instagram_conversation_id_idx
  on public.leads (instagram_conversation_id)
  where instagram_conversation_id is not null;
