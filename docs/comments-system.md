# Comments Platform & Mentions (v2 Checkpoint 24, Steps 5–6)

`core/comments` (built in an earlier checkpoint, documented at the time as "fully greenfield, same repository-pattern shape as Tags — no prior Comments system to preserve") was, until this checkpoint, completely unused: zero callers anywhere in the codebase. This checkpoint is the first to actually wire it up — reusing it exactly as it already exists, never rebuilding it.

## What already existed

`Comment { id, workspace_id, owner_type: EntityType, owner_id, parent_comment_id, body, author, created_at, edited_at, deleted_at }` — polymorphic across any `EntityType`, one level of reply threading, soft-deleted. `CommentsRepository.getCommentsForOwner()`/`createComment()`/`updateComment()`/`deleteComment()` were already real, tested functions.

## What this checkpoint adds

**`mentioned_member_ids: string[]` and `mentions_team: boolean`** on `Comment` — additive fields, denormalized at create time so "my unread mentions" never has to re-parse every comment body on every read.

**`getAllCommentsForWorkspace()`** on `CommentsRepository` — a workspace-wide read (mirroring the same "add a cross-cutting variant when a feature needs one" precedent as `listClientPortalActivityForWorkspace`), used only by the workspace-wide Activity Feed, which has no single owner to scope a `getCommentsForOwner` call to.

**`core/communication/mentionEngine.ts`** — `parseMentions(body, roster)`. Pure function: matches `@Name` tokens against the caller-supplied roster (longest-name-first, so "@Jane Smith" resolves to the full name over a shorter "Jane" that might also exist), and `@Team` as a distinct flag that never expands into a member id list. The engine itself never fetches a roster — that's the module layer's job, since only it has (and should have) access to `getWorkspaceMembers()`.

**`modules/communication/comments/commentsActions.ts`** — the module layer wrapping `core/comments`: `createCommentAction()` fetches the real Workspace roster, calls `parseMentions()`, persists the comment with its parsed mentions, then fans out exactly one `comment_mention` notification per mentioned member (or every other member, for `@Team`) — never to the comment's own author, even if they happen to @-mention themselves.

**`CommentsPanel.tsx`** — one reusable component (`ownerType`, `ownerId` props), mountable on any entity's detail page. Wired onto Client and Event detail pages this checkpoint (see `docs/v2-checkpoint-24-communication-platform.md` for the exact wiring list and honest disclosure of which entity types didn't get it this session).

## Entities supported

Comments can attach to any of BloomOS's ~27 `EntityType` values — including two new ones this checkpoint added specifically because the spec calls for commenting on them: `checklist_item` (the item itself, distinct from `ChecklistItem.owner_type`, which names what the item is *for*) and `team_member` (a Team Member's own profile — reserved by `docs/database.md` since an early checkpoint but never added to `ENTITY_TYPES` until a real feature needed it).

## Why mentions are parsed in the module layer, not `core/comments`

`core/comments` has no concept of a Workspace roster and shouldn't — it's a generic, entity-agnostic primitive. Mention parsing needs the roster; `mentionEngine.parseMentions()` is pure and roster-agnostic; `commentsActions.ts` is the one place that has both. This mirrors the same separation `notificationEngine.ts` keeps between "what does this notification look like" (pure) and "who actually gets notified, and how do we know" (module layer, which has the session/roster).
