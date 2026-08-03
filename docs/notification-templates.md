# Notification Template Library

`lib/data/core/notifications/templateStore.ts` — Checkpoint 41, Step 2/16. Seeded once, one `NotificationTemplate` per `NotificationKind`, from the exact `NOTIFICATION_KIND_META` table (`core/communication/notificationEngine.ts`, Checkpoint 24) — this store never re-derives a kind's label/priority/category, only wraps it in a persisted, versioned, browsable row.

## Not a merge-field engine

`titleTemplate`/`bodyTemplate` are illustrative preview text, not a live merge-field engine — `buildNotificationInput()` always takes caller-supplied title/body per notification (a Lead Created notification says "Jane Doe" because a real lead was created, not because a `{{lead_name}}` placeholder was substituted). A real merge/template engine already exists for Documents/Contracts/Invoices (`core/documents/mergeEngine.ts`); duplicating that machinery for notification text — which has always been freeform per-call-site content — would be exactly the kind of duplication this checkpoint's own instructions forbid.

## Read-only UI, real create infrastructure

`/notifications/templates` (`NotificationTemplatesView.tsx`) is read-only, per Step 16's own spec: category filter chips, a template list, and a detail panel showing preview text + version history. `createNotificationTemplateAction` (Step 11) is real, working infrastructure — it calls `createNotificationTemplate()`, which appends a genuinely new template with its own version-1 history entry — but no create form is wired to this view this checkpoint. This is the same "action exists as real infrastructure, not every affordance is wired to a UI control yet" precedent other checkpoints have used.

A workspace can have more than one template per `kind` after `createNotificationTemplateAction` runs; `getNotificationTemplateForKind()` still returns the first match (the original system-seeded one).

## Email Template Library (v2 Checkpoint 44, Step 8)

The "not a merge-field engine" note above still describes `buildNotificationInput()`'s own freeform, per-call-site path — that's untouched. `core/notifications/emailTemplateEngine.ts` adds a **second, opt-in** resolution path for the same `NotificationTemplate` records, for callers that specifically want `{{merge_field}}`-driven content:

```ts
resolveNotificationTemplate(template: NotificationTemplate, context: MergeContext): Promise<{title, body}>
findUnknownEmailTemplatePlaceholders(template: NotificationTemplate): string[]
previewNotificationContent(titleTemplate, bodyTemplate, context: MergeContext): Promise<{title, body}>
```

Reuses the real Document Platform's own Merge Field Engine (`resolveMergeFields()`) and Template Engine (`interpolateText()`, Checkpoint 12/44) directly — a `NotificationTemplate`'s own `{{client_name}}` and a Document Template's own `{{client_name}}` resolve through the exact same registered Merge Field, never a second placeholder syntax or a second registry. `findUnknownEmailTemplatePlaceholders()` runs the same "unknown_field" check the Document Compiler already runs on a block tree, applied here to a `NotificationTemplate`'s own two plain strings — an author sees an unresolvable `{{...}}` before the template is ever sent, never a silent blank in a recipient's inbox.

No separate UI was built for this — `/notifications/templates` already browses and previews the exact `NotificationTemplate` records this engine resolves; a second list/detail page would duplicate it. A future authoring form for `{{merge_field}}`-aware email content is the natural next UI step, deferred per this checkpoint's "no new UI unless genuinely necessary" instruction.

## Client-recipient support (v2 Checkpoint 44, Step 6)

`NotificationDeliveryRequest` (`core/notifications/types.ts`) and the delivery queue record (`core/notifications/queue.ts`) were widened to mirror `Notification`'s own stored-record shape: `recipientMemberId?` / `recipientClientAccountId?`, exactly one of which is ever set — the same "member XOR client" contract `createInAppNotification()` already enforces in storage. Before this, a `NotificationProvider`'s own `send()` could only resolve contact info for a team member; a Client Portal notification (e.g. a Document Bundle marked "sent") can now route through the identical delivery path.

## Startup registration (v2 Checkpoint 44, Step 7)

`registerIntegrationNotificationProviders()` (`modules/integrations/notificationDeliveryProviders.ts`, Checkpoint 43) was real, tested infrastructure that was never actually called anywhere outside its own test — meaning `isChannelConfigured("email")` reported `false` in every real delivery-readiness check, workspace-wide. It's now called once, idempotently, at the top of `notificationPlatformActions.ts` — the one module-actions file every Notification Platform surface (dashboard, health report, routing) is already imported through — so it has always run before any of those read the registry.
