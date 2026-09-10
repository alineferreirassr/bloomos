-- GMAIL-06 — Deletion/Tombstone Foundation. Additive-only extension of
-- GMAIL-04's gmail_messages table (20260905100000_gmail_mailbox_persistence_foundation.sql,
-- itself untouched) — adds the single field true incremental
-- `users.history.list` synchronization needs to represent a Gmail
-- `messagesDeleted` history event without ever hard-deleting a local row.
--
-- Single-field design: `deleted_at timestamptz null` carries both the
-- boolean signal (`deleted_at is not null` = tombstoned) and the
-- timestamp, so no redundant `provider_deleted boolean` column is added
-- alongside it — GMAIL-06C's own "avoid redundant fields" instruction.
-- Idempotent: re-tombstoning an already-deleted_at row is a no-op at the
-- repository layer (gmailMailboxManager.markMessageDeleted, not this
-- migration) — first tombstone wins. Resurrection: gmailMailboxManager's
-- own upsertMessage clears deleted_at back to null whenever Gmail
-- legitimately reports the message again (an added/changed history event,
-- or a bounded full resync) — the migration itself has no trigger for
-- this; it's application logic, matching every other write path in this
-- domain.
--
-- No new RLS policy: the existing gmail_messages_own_scope policy
-- (member-owned, no workspace-owner exception) already governs every
-- column on this table uniformly, this one included — a tombstoned
-- message is exactly as protected as any other field on the same row.
--
-- Thread-level reconciliation (recomputing gmail_threads.message_count/
-- unread_count/latest_message_at to exclude tombstoned messages) is
-- explicitly deferred, per GMAIL-06D's own "defer them and report
-- clearly" — this migration does not touch gmail_threads at all.

alter table public.gmail_messages
  add column if not exists deleted_at timestamptz;

comment on column public.gmail_messages.deleted_at is
  'Null = not deleted (the default, every message before GMAIL-06 and every newly-synced one). Non-null = tombstoned — Gmail reported this message id in a history.list messagesDeleted record. Never a hard DELETE: the row and its own workspace_id/member_id/mailbox_id/thread_id stay intact and RLS-protected exactly as before. Cleared back to null by gmailMailboxManager.upsertMessage if the provider message legitimately exists again.';

create index if not exists gmail_messages_deleted_at_idx on public.gmail_messages (mailbox_id) where deleted_at is not null;
