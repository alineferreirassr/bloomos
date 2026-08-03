# Notification Timeline + Knowledge Graph integration

## Timeline Engine (Step 8)

`core/notifications/notificationTimelineEngine.ts`. `notification` has been a reserved `EntityType` since Checkpoint 2/14 (part of the original "reserved ahead of the module" batch alongside `team_kb_article`/`automation`) but never had real Timeline events until now.

Three new `TimelineActivityType` values (`core/enums/timelineActivityType.ts`): `notification_dispatched`, `notification_read`, `notification_archived`. `buildNotificationTimelineEvent(notification, transition)` maps a state transition to its event; `modules/notifications/notificationPlatformActions.ts` is the one caller that actually invokes `recordTimelineActivity(workspaceId, "notification", notification.id, ...)`, on `createNotificationAction`, `markNotificationReadAction`, and `archiveNotificationAction`/`dismissNotificationAction`.

Every event is owned by the notification's own `id` — deliberately **not** a second event on the *related* entity (e.g. the Lead a `lead_created` notification is about). That entity already gets its own `lead_created` Timeline event from the real action that triggered the notification; a second one there would be duplicate noise.

## Knowledge Graph integration (Step 9)

`core/notifications/knowledgeGraphIntegration.ts`. Deliberately **not** a new `KnowledgeNodeType` or a new persisted `KnowledgeRelationship` — `Notification.related_owner_type`/`related_owner_id` (Checkpoint 2/14) already *is* the relationship between a notification and the entity it's about. This file only surfaces that already-real link as a summary string (`generateNotificationActivitySummary`), the same pure-function-over-already-fetched-data shape `core/knowledge/knowledgeGraphBrief.ts` established for every other entity.

Promoting `notification` to a full graph-traversal node type was considered and rejected: notifications are high-volume and ephemeral, and Checkpoint 40 already hit the exact regression class this would risk (adding a value to `ENTITY_TYPES` that Timeline/graph code silently starts treating as fully capable — see `docs/search-engine.md`'s "EntityType extension and its one side effect"). The Notification Detail page (`/notifications/[id]`) surfaces this summary under its own "Knowledge Graph" card.
