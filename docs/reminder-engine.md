# Reminder Engine (v2 Checkpoint 24, Step 9) & Escalation Engine (Step 10)

Two new, genuinely greenfield engines — no prior reminder or escalation concept existed anywhere in BloomOS before this checkpoint.

## Reminder Engine

`core/communication/reminderEngine.ts` is pure — every function takes a `Reminder` (and, where relevant, `now`) and answers a question or computes a next state; nothing here reads or writes a store.

- **`isReminderDue(reminder, now)`** — due once `due_at` (or, if snoozed, `snoozed_until`) has passed, and the reminder hasn't already reached a terminal status (`completed`/`dismissed`).
- **`isReminderOverdue(reminder, now, graceMinutes)`** — due, and past an additional grace window — used to decide whether a "Reminder Due" notification should be `critical` priority rather than `normal`.
- **`nextOccurrence(reminder)`** — advances `due_at` by one recurrence step *from itself*, not from `now`: a weekly reminder due Monday and completed Wednesday reschedules to the following Monday, never "one week from Wednesday." Returns `null` for a one-time (`"none"`) reminder.
- **`applySnooze(reminder, until)`** — always moves status to `"snoozed"` and clears `escalation_level` back to 0 — snoozing is an explicit human decision to wait, not a failure to respond, so it shouldn't carry forward an escalation state built for "this was ignored."

`lib/data/core/communication/reminderStore.ts` persists `Reminder` (workspace-scoped, optionally tied to any `EntityType` owner via `owner_type`/`owner_id` so a reminder can surface on that entity's own Communication Timeline). `modules/communication/reminders/reminderActions.ts` is the Server Action layer: create/complete (auto-reschedules a recurring reminder)/dismiss/snooze/delete, all permission-gated on `communications.view`.

### The real "Reminder Due" notification path

`notifyDueRemindersForCurrentMember()` is called on-read (the Notification Center's own data fetch, and the Bloom AI Communication Brief) rather than from a background sweep — this codebase has no scheduled-jobs infrastructure by deliberate precedent (the Automation Engine's own Checkpoint 9 non-goals explicitly excluded scheduled/background jobs, and nothing since has added one). Every due reminder whose `escalation_level` is still 0 gets exactly one real notification, then `escalation_level` is bumped to 1 — re-running the check against the same due reminder is a no-op, so a member never gets the same "Reminder Due" ping twice for one due date.

## Escalation Engine

`core/communication/escalationEngine.ts` follows the exact same shape as `core/operations/riskEngine.ts`'s own `RISK_DETECTORS` (Checkpoint 21) — an array of independent, pure `(input) => EscalationCandidate[]` detectors, appendable without touching the others:

| Detector | Escalates when |
|---|---|
| Unread critical notification | A `critical`-priority notification has sat unread 4+ hours |
| Overdue reminder | Any pending reminder past its due date (warning under 24h overdue, critical past it) |
| Late Automation approval | A pending Automation execution has awaited approval 24+ hours |
| High-risk event | Checkpoint 21's own per-event health score has dropped below 45 |
| Pending response | An internal message thread has waited 48+ hours for a reply |
| Missed deadline | Reserved — no real call site populates this input yet (see Known Limitations) |

`modules/communication/escalation/getEscalationsData.ts` assembles the real, pre-aggregated facts each detector needs (unread critical notifications via `getMemberNotificationsForWorkspace`, overdue reminders via `listRemindersForWorkspace`, late approvals via the Automation Engine's own `getPendingApprovals`, high-risk events via Checkpoint 21/23's `getOperationsDashboardData().eventHealthScores`) and calls `detectEscalations()`. Every returned candidate with a `relatedMemberId` immediately gets one real, `"escalation"`-kind, critical-priority notification — an escalation is never a silent list nobody is told about.

### Known limitation: "Missed Deadline" detector has no real data source wired

`detectMissedDeadlines` exists and is unit-tested, but `getEscalationsData.ts` currently passes it an empty array — no call site yet aggregates "which Events/checklist items have missed their own deadline" into the `MissedDeadlineInput` shape the detector expects. This is a genuine gap, not a fabricated feature: the detector itself is real and correct, only its one input source isn't populated yet.
