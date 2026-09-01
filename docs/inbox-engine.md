# Unified Inbox (v2 Checkpoint 24, Step 4) & Internal Messaging (Step 12)

The Unified Inbox is a read-layer merge over two independent write-side stores — Internal Messaging (new this checkpoint) and Client Portal Messages (Checkpoint 14) — never a third store of its own. "Every future provider should feed this inbox" (spec) means a future Email/SMS adapter is a third source merged the same way; the Inbox's own shape never changes.

## Internal Messaging (`lib/data/core/communication/messageThreadStore.ts`)

Deliberately separate from `clientPortalMessageStore.ts`: that store's `ClientPortalMessageThread` is one-thread-per-client-account by design (Checkpoint 14's own doc comment: "a client has exactly one conversation with the Workspace, not one per topic") and has no concept of a member-to-member or multi-party thread. Forcing Internal Messaging into that same store would mean breaking its own core invariant.

`InternalMessageThread` supports two kinds:
- **`direct`** — exactly 2 participants. `findOrCreateDirectThread()` reuses the existing thread between the same two members rather than creating a duplicate, mirroring `getClientPortalMessageThread`'s own "exactly one thread" precedent, just scoped to a member pair instead of a client account.
- **`team`** — 2+ participants, with a required `subject`.

Every message carries `mentioned_member_ids` (parsed via the shared `mentionEngine`) and `read_by_member_ids` (real Read Receipts — a message is "Seen" once every other participant's id appears in this array). **Typing Indicator is intentionally not implemented** — no realtime transport exists anywhere in BloomOS (the same non-goal Client Portal Messages, Checkpoint 14, already established for its own "no websocket, no polling loop" messaging), and a fake typing indicator would misrepresent a capability that isn't real. Message Search operates client-side over an already-fetched thread's messages, the same "cheap, no extra fan-out" pattern every other search-within-a-panel in this codebase uses.

## The Unified Inbox (`modules/communication/inbox/getUnifiedInboxData.ts`)

Merges:
1. Internal Messaging threads for the current member (`mockMessageThreadRepository.listThreadsForMember`), each item's `unreadCount` computed as messages not yet in `read_by_member_ids` for the current member.
2. Client Portal threads workspace-wide (`listClientPortalThreadsForWorkspace`), each item's `unreadCount` taken directly from `ClientPortalMessageThread.unread_count`.

Both are normalized into one `InboxItem` shape (`source`, `subject`, `previewBody`, `participantLabel`, `unreadCount`, `pinned`, `archived`, `lastMessageAt`, `href`) and sorted pinned-first, then by recency. `UnifiedInboxView.tsx` (`/inbox`) renders this list; clicking an internal thread routes to `/inbox/[threadId]` (`ThreadConversationView.tsx`), clicking a Client Portal thread routes to `/inbox/client-portal/[threadId]` (`ClientPortalThreadView.tsx`, read-only staff view — Phase 09C.2).

## Known limitation: Client Portal unread count is client-side only

`ClientPortalMessageThread.unread_count` (Checkpoint 14) is explicitly documented as "unread from the *client's* own point of view" — no staff-side read-receipt tracking was ever built for that store. The Unified Inbox surfaces this number as-is rather than fabricating a staff-side equivalent; a staff member sees "has the client read our latest reply," not "have I read the client's latest message." Closing this gap would mean extending Checkpoint 14's own store, out of this checkpoint's scope.

## Pin/Archive

`setThreadPinned`/`setThreadArchived` are per-member (an array of member ids on the thread, not a global flag) — one member pinning a shared team thread never pins it for every other participant, matching how "Pinned" behaves for Notifications in the same checkpoint.
