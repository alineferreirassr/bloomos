# The Communication Graph (v2 Checkpoint 24)

The spec names "Communication Graph" as the unifying concept every future provider (Email, SMS, Slack, Calendar, Teams, WhatsApp) should plug into "without requiring architectural changes." This document states plainly what that is in this codebase, and — just as importantly — what it deliberately is *not*.

## What it is: a data-model property, not a new engine

Every `ActivityEntry` (the one shared row type behind both the Activity Feed and the Communication Timeline — see `docs/communication-timeline.md`) already carries its own cross-references:

```ts
actorLabel / actorMemberId          // who created it
ownerType / ownerId                 // what entity it belongs to
relatedAutomationExecutionId        // which Automation generated it, if any
relatedWorkflowId                   // which Workflow generated it, if any
relatedDocumentId                   // a related Document
relatedPaymentId                    // a related Payment
relatedReminderId                   // a related Reminder
relatedNotificationId               // a related Notification
deepLink                            // where to jump to see the source directly
```

Collectively, this **is** the Communication Graph — every communication event already knows who created it, what generated it, and what else it touches, because that's simply what an `ActivityEntry` is. There is no separate "graph" data structure, no graph database, and no new traversal engine, because none of BloomOS's existing "Engines" (Analytics, Automation, Business Health, Operations Health, Escalation) are graph-shaped either — every one of them is a plain function over pre-fetched arrays. Building an actual graph engine here would be the first genuinely new architectural shape introduced in this entire project's history, for a concept the spec itself only ever describes in terms "who/what/why" — questions the existing cross-reference fields already answer directly, with a plain filter or lookup, not a graph query.

## Why this is the right call, not a shortcut

The three prior "timeline" concepts this checkpoint researched before building anything (`core/operations/timelineEngine.ts`, the Client Portal's `timelineAggregator.ts`, and `core/timeline`'s `TimelineActivity`) are all flat, sorted lists with the same kind of cross-reference fields, never a graph. Introducing a graph-shaped data structure for Checkpoint 24 alone — when every sibling engine in the same codebase, built across 23 prior checkpoints, uses the "flat array + cross-reference ids" shape — would be a foundation no other part of BloomOS could lean on, an isolated architectural island rather than a natural extension of what's already there.

## How a future provider plugs in

1. **A new activity source** — register one more `ActivitySourceAdapter` with `core/communication/activityRegistry.ts`, normalizing that provider's own rows into `ActivityEntry`. The Feed, the Timeline, and `ActivityCard` never change.
2. **A new notification kind** — add one entry to `NOTIFICATION_KINDS` and `NOTIFICATION_KIND_META` (`core/communication/notificationEngine.ts`); `buildNotificationInput()` and every consumer of it are unaffected.
3. **A new inbox source** — merge one more read into `getUnifiedInboxData.ts`, normalized into `InboxItem`, exactly the way Client Portal Messages is merged with Internal Messaging today.
4. **A new channel** — implement `NotificationProvider` (`core/notifications/registry.ts`, dormant since Checkpoint 2/14) and register it; `createInAppNotification`'s callers are unaffected, since `channel` was always a field on `Notification`, just never populated with anything besides `"in_app"` until a real provider exists.

None of these four extension points requires touching the Aggregator, the Registry's own shape, the Inbox merge logic, or any existing UI component — which is exactly the guarantee "no architectural changes" asks for.
