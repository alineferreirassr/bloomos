-- SOCIAL-11D — Instagram Comment / DM Conversation / Message Data
-- Foundation. Purely additive, purely schema-and-repository: no Automation
-- Engine wiring, no trigger/action, no auto-reply, no AI, no Lead Capture,
-- no CRM linkage, no moderation, no notifications, no UI, no change to the
-- SOCIAL-11C webhook receiver's own behavior.
--
-- THREE new tables, deliberately separate (not one polymorphic table):
-- instagram_comments stands alone (a comment has no relationship to a DM
-- conversation); instagram_conversations/instagram_messages mirror the
-- established parent+ordered-children shape carousel_items/carousel_slides
-- and script_items/script_versions/script_blocks already use in this
-- schema, since a conversation genuinely owns an ordered sequence of
-- messages the same way a Carousel owns its slides.
--
-- Identity: every row anchors to instagram_account_identities (SOCIAL-11C)
-- via instagram_account_identity_id — never a new identity/credential
-- concept, never an access token or OAuth credential duplicated here.
-- workspace_id is its own independent, permanent, NOT NULL column on every
-- row (never itself nulled) — the durable audit anchor the checkpoint's
-- own "preservar histórico" instruction requires — while
-- instagram_account_identity_id is nullable with ON DELETE SET NULL,
-- mirroring meta_webhook_events' own exact precedent: a comment/
-- conversation/message row must survive the owning Identity later being
-- disconnected/reconnected, never silently deleted along with it. Unlike
-- meta_webhook_events, though, workspace_id here is NOT NULL from the
-- start — these rows are only ever created once a real, already-resolved
-- Instagram Account Identity is known (a future SOCIAL-11E's own gate),
-- never for an unresolved delivery the way meta_webhook_events can be.
--
-- Idempotency: automation_idempotency_keys (SOCIAL-11B) is deliberately
-- NOT reused here, and no second delivery-ledger is created either. That
-- ledger solves a different problem — "has this exact HTTP webhook
-- delivery already been processed" — already fully solved by SOCIAL-11C's
-- own webhook route. What this migration needs is entity-level dedup —
-- "has this exact real comment/conversation/message already been
-- persisted as a domain row" — which a plain per-entity UNIQUE constraint
-- on each table's own natural key (identity + external id) answers
-- directly, with no extra table, mirroring how every other domain in this
-- schema (e.g. docusign_webhook_reconciliations' own unique constraint)
-- already prefers a constraint over a second ledger when one suffices.
--
-- Delete/lifecycle: no physical DELETE policy on any of the three tables
-- (matches every history-preserving precedent already established —
-- carousel_items, script_items, meta_webhook_events). instagram_comments
-- gets a minimal `status` (active/removed) mirroring the exact active/
-- archived CHECK-constrained convention already used throughout this
-- schema (carousel_items, idea_items, script_items) — the honest, minimal
-- answer to "distinguir estado/lifecycle necessário": a future removal
-- signal from Meta has somewhere to land without inventing moderation
-- logic now. instagram_conversations gets the same active/archived shape
-- for a future inbox's own filtering (the checkpoint's own explicit
-- "lifecycle/status necessário para futuro inbox"). instagram_messages
-- gets no extra status column — direction plus the row's own existence
-- already fully describes what a future ingestion step needs; adding one
-- would duplicate a concept that doesn't yet exist.
--
-- RLS: mirrors meta_webhook_events' own exact shape on all three tables —
-- a read-only, workspace-scoped SELECT policy for `authenticated` (a
-- future Social Inbox, SOCIAL-13, explicitly out of scope here), and NO
-- insert/update/delete policy for authenticated at all. Unlike
-- instagram_account_identities (which needed authenticated writes because
-- a real, existing Server Action — selectMetaPublishingIdentityAction —
-- writes to it today), nothing in this checkpoint's own scope writes to
-- these three tables through an authenticated session: every future
-- writer is the webhook-driven ingestion pipeline (SOCIAL-11E), which has
-- no auth.uid() and writes exclusively through a service-role client, the
-- same boundary metaWebhookServiceRole.ts already established. No new
-- permission — SELECT is membership-gated only, matching every other
-- table in this schema; PERMISSION_DECISION in the checkpoint's own
-- report documents this explicitly.

create table if not exists public.instagram_comments (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  instagram_account_identity_id uuid references public.instagram_account_identities (id) on delete set null,

  external_comment_id text not null,
  -- The Instagram media/post the comment is on, when the webhook payload
  -- carries it — nullable, some event shapes may omit it.
  external_media_id text,
  -- The parent comment's own external id when this is a reply — plain
  -- text, never a self-referencing FK: Meta's own webhook delivery order
  -- is not guaranteed, so a child comment can legitimately arrive before
  -- its parent has ever been ingested as a row here. A hard FK would make
  -- that ordinary, expected case a constraint violation.
  parent_external_comment_id text,

  external_author_id text not null,
  external_author_username text,

  content text not null default '',

  status text not null default 'active',

  external_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instagram_comments_status_check
    check (status in ('active', 'removed')),
  constraint instagram_comments_external_comment_id_not_blank_check
    check (btrim(external_comment_id) <> ''),
  constraint instagram_comments_external_author_id_not_blank_check
    check (btrim(external_author_id) <> ''),
  -- The entity-level dedup key (see this migration's own header comment):
  -- the same real external comment, redelivered, must never become a
  -- second row.
  constraint instagram_comments_account_external_id_unique
    unique (instagram_account_identity_id, external_comment_id)
);

comment on table public.instagram_comments is
  'SOCIAL-11D — one row per external Instagram comment, ingestion-only (no reply/moderation logic in this checkpoint). workspace_id is a permanent, independent audit anchor; instagram_account_identity_id is nullable (ON DELETE SET NULL) so history survives the owning Identity being disconnected. No DELETE policy — status distinguishes active/removed instead.';
comment on column public.instagram_comments.parent_external_comment_id is
  'The parent comment''s own external id when this is a reply, stored as plain text (never a self-referencing FK) — webhook delivery order is not guaranteed, so the parent may not exist as a row here yet.';

create index if not exists instagram_comments_account_idx
  on public.instagram_comments (instagram_account_identity_id);
create index if not exists instagram_comments_workspace_idx
  on public.instagram_comments (workspace_id);
create index if not exists instagram_comments_external_media_idx
  on public.instagram_comments (external_media_id)
  where external_media_id is not null;

drop trigger if exists trg_instagram_comments_set_updated_at on public.instagram_comments;
create trigger trg_instagram_comments_set_updated_at
  before update on public.instagram_comments
  for each row execute function public.set_updated_at();

alter table public.instagram_comments enable row level security;

create policy "instagram_comments_select_workspace_member"
  on public.instagram_comments for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create table if not exists public.instagram_conversations (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  instagram_account_identity_id uuid references public.instagram_account_identities (id) on delete set null,

  -- Meta's own thread id, when the payload carries one — nullable; see
  -- this table's own unique constraints below for how a conversation is
  -- still deduplicated even when this is absent.
  external_conversation_id text,
  external_participant_id text not null,
  external_participant_username text,

  status text not null default 'active',
  last_message_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instagram_conversations_status_check
    check (status in ('active', 'archived')),
  constraint instagram_conversations_external_participant_id_not_blank_check
    check (btrim(external_participant_id) <> ''),
  -- Instagram's own real behavior: one business account has at most one
  -- open DM thread with a given external participant at a time — this is
  -- the primary, always-available dedup key.
  constraint instagram_conversations_account_participant_unique
    unique (instagram_account_identity_id, external_participant_id)
);

comment on table public.instagram_conversations is
  'SOCIAL-11D — one row per external Instagram DM thread. workspace_id is a permanent, independent audit anchor; instagram_account_identity_id is nullable (ON DELETE SET NULL) so history survives the owning Identity being disconnected. Deduplicated primarily on (identity, external participant) — Instagram has at most one open thread per participant pair — and secondarily on (identity, external_conversation_id) when Meta''s own thread id is present. No DELETE policy — status (active/archived) supports a future inbox''s own filtering.';

-- Secondary dedup key for when Meta's own thread id is present — a
-- partial unique index (not a table-level constraint) since
-- external_conversation_id is nullable and multiple legitimately-absent
-- values must never collide with each other.
create unique index if not exists instagram_conversations_account_external_id_unique_idx
  on public.instagram_conversations (instagram_account_identity_id, external_conversation_id)
  where external_conversation_id is not null;

create index if not exists instagram_conversations_account_idx
  on public.instagram_conversations (instagram_account_identity_id);
create index if not exists instagram_conversations_workspace_last_message_idx
  on public.instagram_conversations (workspace_id, last_message_at desc);

drop trigger if exists trg_instagram_conversations_set_updated_at on public.instagram_conversations;
create trigger trg_instagram_conversations_set_updated_at
  before update on public.instagram_conversations
  for each row execute function public.set_updated_at();

alter table public.instagram_conversations enable row level security;

create policy "instagram_conversations_select_workspace_member"
  on public.instagram_conversations for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create table if not exists public.instagram_messages (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null references public.instagram_conversations (id) on delete cascade,
  -- Denormalized from the owning conversation (mirrors carousel_slides'
  -- own workspace_id-on-child-row precedent) — direct RLS/query use
  -- without a join, and independently NOT NULL for the same permanent-
  -- audit-anchor reasoning as every other table in this migration.
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  external_message_id text not null,
  direction text not null,
  -- Free text, not a CHECK-constrained closed list: Instagram's own
  -- message types (text, media, story_reply, share, …) are an external,
  -- evolving vocabulary this checkpoint does not enumerate or process —
  -- the same reasoning automation_executions.trigger_type already applies
  -- (SOCIAL-11B's own migration).
  message_type text not null default 'text',
  content text,
  -- A raw external reference/URL/id only, when the message carries media —
  -- never a new attachment/storage subsystem; ingestion-only metadata.
  external_media_reference text,

  external_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instagram_messages_direction_check
    check (direction in ('inbound', 'outbound')),
  constraint instagram_messages_external_message_id_not_blank_check
    check (btrim(external_message_id) <> ''),
  constraint instagram_messages_conversation_external_id_unique
    unique (conversation_id, external_message_id)
);

comment on table public.instagram_messages is
  'SOCIAL-11D — one row per external Instagram DM message within a conversation. workspace_id is denormalized from the owning conversation for direct RLS/query use, independently NOT NULL. direction distinguishes inbound (from the external participant) from outbound (from the business account, including one sent directly in the Instagram app, outside BloomOS). No status column — direction plus the row''s own existence already fully describe what a future ingestion step needs. No DELETE policy.';

create index if not exists instagram_messages_conversation_idx
  on public.instagram_messages (conversation_id, created_at);
create index if not exists instagram_messages_workspace_idx
  on public.instagram_messages (workspace_id);

drop trigger if exists trg_instagram_messages_set_updated_at on public.instagram_messages;
create trigger trg_instagram_messages_set_updated_at
  before update on public.instagram_messages
  for each row execute function public.set_updated_at();

alter table public.instagram_messages enable row level security;

create policy "instagram_messages_select_workspace_member"
  on public.instagram_messages for select
  to authenticated
  using (public.is_workspace_member(workspace_id));
