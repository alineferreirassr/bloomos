# Notification Engine (v2 Checkpoint 24, Steps 1–3)

The Notification Center, Notification Engine, and Notification Preferences all sit on top of `core/notifications` — the same `Notification` type and `NotificationsRepository` built in Checkpoint 2 and extended for the Client Portal in Checkpoint 14. This checkpoint does not introduce a new notification store; it extends the existing one additively and builds the first member-facing UI to read from it.

## What already existed

`core/notifications/types.ts`'s `Notification` already carried `recipient_member_id`/`recipient_client_account_id` (exactly one set, never both), `channel`, `title`/`body`, `read_at`, and `related_owner_type`/`related_owner_id` for a deep link back to the triggering entity. `NotificationsRepository.createInAppNotification()`/`markNotificationRead()`/`getNotificationsForMember()` were already real, tested functions — the one gap was that nothing rendered a member-facing list (`ClientPortalNotificationsView.tsx` existed for clients; there was no equivalent for staff).

## What this checkpoint adds

**Additive fields on `Notification`** — `kind: NotificationKind | null`, `priority: NotificationPriority`, `pinned_at: string | null`, `archived_at: string | null`. Every notification created by any prior checkpoint simply has `kind: null`, `priority: "normal"`, both timestamps `null`, and continues to read/display exactly as before.

**`NOTIFICATION_KINDS`** (`core/notifications/types.ts`) — 18 closed kinds covering every example in the spec: `lead_created`, `proposal_sent`, `proposal_accepted`, `invoice_created`, `invoice_paid`, `payment_failed`, `event_upcoming`, `inventory_low`, `vendor_assigned`, `workflow_finished`, `automation_failed`, `bloom_ai_insight`, `reminder_due`, `comment_mention`, `approval_requested`, `announcement_published`, `message_received`, `escalation`.

**`core/communication/notificationEngine.ts`** — `NOTIFICATION_KIND_META` maps every kind to its own label/icon/default priority/default category; `buildNotificationInput()` is the one function every real call site uses to construct a `CreateInAppNotificationInput`, so no two call sites can silently disagree on a kind's default priority.

**Notification Center actions** (`NotificationsRepository`) — `markAllNotificationsRead`, `pinNotification`/`unpinNotification`, `archiveNotification`/`unarchiveNotification` (the "Undo Dismiss" affordance — a real reversal, not a client-only illusion).

**`NotificationCenterPanel.tsx`** (`/communications`, "Notifications" tab) — Unread/Read/Pinned/Archived are client-side view filters over one already-fetched, per-member array (bounded and small at this scale, matching `getNotificationCenterData`'s own doc comment); search filters title+body; every row supports Mark Read/Pin/Archive inline.

**Notification Preferences** (`lib/data/core/communication/notificationPreferencesStore.ts`) — per-member Desktop/In-App/Email/SMS/Push toggles, Quiet Hours, muted Categories, minimum Priority, Digest Frequency. Every toggle saves immediately.

## Which notification kinds are actually live end-to-end

Five kinds are wired to a real, production call site this checkpoint, each producing a genuine notification a member will actually receive:

| Kind | Real call site |
|---|---|
| `comment_mention` | `commentsActions.ts`'s `createCommentAction` — parses `@Name`/`@Team` against the real roster, notifies every mentioned member except the author |
| `message_received` | `messagingActions.ts`'s `sendMessageAction` — notifies every other thread participant (upgraded to `comment_mention` priority/kind when they were also @-mentioned in the message) |
| `reminder_due` | `reminderActions.ts`'s `notifyDueRemindersForCurrentMember` — called on-read (see `docs/reminder-engine.md`) |
| `announcement_published` | `announcementActions.ts`'s `publishAnnouncementAction` — fans out to every workspace member except the author |
| `escalation` | `escalation/getEscalationsData.ts` — every detected `EscalationCandidate` with a `relatedMemberId` gets one critical notification |

The remaining 13 kinds (`lead_created`, `proposal_sent`, `proposal_accepted`, `invoice_created`, `invoice_paid`, `payment_failed`, `event_upcoming`, `inventory_low`, `vendor_assigned`, `workflow_finished`, `automation_failed`, `bloom_ai_insight`, `approval_requested`) have complete, unit-tested metadata and would produce a correct notification the moment `buildNotificationInput()` is called for them — but this checkpoint does not wire a call to them from every one of those domains' own mutation functions (e.g., `createLead()`, `recordPayment()`). Those functions are widely-shared, heavily-tested core facades used across the entire codebase; wiring a notification call into them under this checkpoint's own time budget risked destabilizing code far outside this checkpoint's scope for a marginal gain over the 5 kinds already proven live. See the checkpoint's own Known Limitations for the honest accounting.

## Why direct calls, not the Automation Engine, for most of these

`createNotificationAction.ts` (Checkpoint 9) already lets an Automation Definition create a notification as one of its actions. This checkpoint's own new kinds (mentions, messages, reminders, announcements, escalations) are all "the system already knows this happened, always notify, no conditions or approval needed" — the Automation Engine's condition/approval machinery would add ceremony without benefit. Direct calls from the module layer, matching the precedent `dispatchClientPortalTriggerActions.ts` already set (internal state change → notification, in the same function), are simpler and equally real.
