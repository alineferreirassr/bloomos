# Notification Platform permissions

Four new permissions (`core/enums/permission.ts`), additive to `communications.view`/`communications.manage` — never a replacement. Every existing `/communications` route and `modules/communication/notifications/notificationActions.ts` action keeps gating on `communications.view` unchanged.

| Permission | Gates |
|---|---|
| `notifications.view` | `/notifications` dashboard, `/notifications/[id]` detail, and every read/state-transition action (mark read/unread, pin/unpin, dismiss/archive) |
| `notifications.manage` | `createNotificationAction` — creating a notification on behalf of a recipient is a workspace-wide write, the same narrower-manage/broader-view split `communications.view`/`.manage` established |
| `notifications.templates` | `/notifications/templates`, `listNotificationTemplatesAction`, `getNotificationTemplateDetailAction`, `createNotificationTemplateAction` |
| `notifications.preferences` | `/notifications/preferences` and its own read/update actions — broad, since every member manages their own preferences |

## Role matrix (`lib/team/permissionMatrix.ts`)

- **owner / admin** — every permission (unchanged `PERMISSIONS` grant).
- **manager** — all four, mirroring `communications.view`/`.manage`.
- **staff** — `notifications.view` and `notifications.preferences` only (mirrors `communications.view` — staff already gets read access to Communications/Inbox; `notifications.manage`/`.templates` stay manager+).

## Route access (`core/permissions/routeAccess.ts`)

```
{ prefix: "/notifications", requirement: { kind: "permission", permission: "notifications.view" } }
```

Covers `/notifications`, `/notifications/[id]`, `/notifications/preferences`, and `/notifications/templates` via prefix matching — additive to `/communications`'s own `communications.view` entry, which is untouched.

## Navigation

A new top-level sidebar entry (`config/navigation.ts`), `{ id: "notifications", href: "/notifications" }`, using a new `NotificationsIcon` (lucide `BellRing`) distinct from `CommunicationsIcon`'s plain `Bell`.
