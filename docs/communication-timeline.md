# Unified Communication Timeline (v2 Checkpoint 24, Step 7.5) & Activity Feed (Step 7)

The spec calls this "one of the most important concepts inside BloomOS." Before writing a line of code for it, this checkpoint researched every existing timeline-adjacent concept in the codebase — three were found, and none of them was a generic, multi-source, per-entity communication log:

| Existing concept | Scope | Shape |
|---|---|---|
| `core/operations/timelineEngine.ts` (Checkpoint 21) | Per-Event, staff-only | Pure function over 10 pre-fetched arrays, 12 closed milestone kinds |
| `lib/data/clientPortal/timelineAggregator.ts` (Checkpoint 14) | Per-Event, client-facing | Async aggregator, 6 closed kinds, client-safe subset |
| `core/timeline` / `TimelineActivity` (earlier checkpoint) | Any `EntityType` owner, workspace-wide read variant | **Append-only, real Supabase-backed table, 89 closed kinds** |

The third — `core/timeline`'s `TimelineActivity` — is the only one of the three that is already generic, polymorphic, and Supabase-backed across arbitrary entity types. It is reused as-is, not rebuilt, as one of several sources this checkpoint's own aggregator merges.

## Architecture: one engine, two scopes

`core/communication/activityAggregator.ts`'s `aggregateActivity(query)` is **the same engine** behind both:
- **Activity Feed (Step 7)** — `aggregateActivity({ workspaceId })`, no owner scope: everything, workspace-wide.
- **Communication Timeline (Step 7.5)** — `aggregateActivity({ workspaceId, ownerType, ownerId })`: everything for one entity.

This is a deliberate architecture decision, not an oversight: building two separate aggregation functions for "all activity" versus "one entity's activity" would have duplicated the merge/filter/sort logic the spec's own Step 17 explicitly warns against ("no duplicated timeline logic"). The Feed and the Timeline are the identical computation at two different scope parameters.

## ActivityRegistry — the extension point

`core/communication/activityRegistry.ts` is a plain `Map`-based `registerActivitySource`/`getActivitySources`/`resetActivityRegistry` — the same shape as every other registry in this codebase (Skills, Automation, Metrics). Each registered `ActivitySourceAdapter` is a function that knows how to read **one existing domain's own store** and normalize its rows into the shared `ActivityEntry` shape. "Every future integration must feed this Timeline automatically" (spec) means: a future Email/SMS provider registers one more adapter here — the Aggregator, the Feed, and the Timeline UI never change.

`modules/communication/activityAdapters.ts`'s `registerBuiltinActivitySources()` (idempotent, same `let registered = false` convention as every other built-in-registration loader) registers six adapters, each reusing an existing store without duplicating its logic:

| Adapter | Reuses | Per-entity scoped? |
|---|---|---|
| `timeline-activity` | `core/timeline`'s `TimelineActivity` (89 kinds) — CRM/Finance/Documents/Events | Yes (`getTimelineForOwner`); falls back to workspace-wide `getRecentActivity()` otherwise |
| `comments` | `core/comments` | Yes (`getCommentsForOwner`); falls back to `getAllCommentsForWorkspace()` otherwise |
| `notifications` | `core/notifications`, filtered to member-recipient rows only | Yes, via `related_owner_type`/`related_owner_id` |
| `automation` | The Automation Engine's own execution history (`AutomationExecution.triggerFacts`) | Best-effort — only trigger types whose facts carry a recognizable id field for the requested `ownerType` (invoice/proposal/event/client/lead/contract) |
| `reminders` | This checkpoint's own `reminderStore` | Yes, via `owner_type`/`owner_id` |
| `announcements` | This checkpoint's own `announcementStore` | Only for `ownerType === "workspace"` — an announcement is never scoped to a single non-workspace entity |

Every entry's category is derived from its own source's kind (e.g., `TimelineActivityType` prefixes like `invoice_*`/`payment_*` map to `"finance"`; `lead_*`/`client_*`/`contract_*` map to `"crm"`) rather than a second, hand-maintained categorization living in the aggregator itself.

## ActivityCard — the one reusable rendering unit

`modules/communication/components/ActivityCard.tsx` renders one `ActivityEntry`: category icon, title, expand/collapse for long descriptions, actor + timestamp, a "Jump to entity" deep link, and an optional Quick Reply affordance. This is deliberately richer than the existing generic `modules/timeline/components/Timeline.tsx` (which has no icons, no expand/collapse, no quick actions) — that component is untouched and still serves its own callers; `ActivityCard` is what a merged, multi-source `ActivityEntry[]` needs.

## Cross-references — "the Communication Graph," in data form

Every `ActivityEntry` carries `relatedAutomationExecutionId`/`relatedWorkflowId`/`relatedDocumentId`/`relatedPaymentId`/`relatedReminderId`/`relatedNotificationId` plus `actorLabel`/`actorMemberId`/`ownerType`/`ownerId` — collectively, this *is* the Communication Graph the spec names as its own concept. See `docs/communication-graph.md` for why this is deliberately a data-model property of every entry rather than a separate graph-database engine.

## Filtering, search, pinned, bookmarks

Category filter, free-text search (title + description), actor filter, and date range are all applied once inside `aggregateActivity()` itself, after every adapter's results are merged — never duplicated per-adapter. Pinned entries always sort first regardless of recency. Bookmarks are modeled on `ActivityEntry.bookmarked` but no UI surface toggles it yet (see Known Limitations in the checkpoint-level report).

## Known limitation: Bloom AI Timeline recap, entity history, and relationship summary

The spec's "Bloom AI Timeline" examples ("Summarize last week," "Explain why this client became high risk," "Generate timeline recap") are not built as their own dedicated brief this checkpoint — `generateCommunicationBrief` (Step 14) covers Daily/Weekly Digest, Unread Summary, Missed Activity, Pending Replies, and Critical Issues over the *member's own* notifications/reminders/threads, but does not yet accept an arbitrary entity + date range and produce a templated recap of that entity's own Timeline. The data it would need (`aggregateActivity({ ownerType, ownerId, dateFrom, dateTo })`) is fully available; only the templated-summary function over that data wasn't written this session.
