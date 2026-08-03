import type { CommunicationCategory } from "@/types/communication";
import type { NotificationChannel, NotificationKind, NotificationPriority } from "@/core/notifications/types";

/**
 * v2.0 Checkpoint 41 — Notification Center. This platform's own domain
 * types, additive to the real storage/delivery primitives Checkpoint
 * 2/14/24 already shipped (`core/notifications/{types,registry,queue}.ts`,
 * `core/communication/notificationEngine.ts`, `types/communication.ts`'s
 * `NotificationPreferences`). Nothing here re-declares those — see
 * `docs/notifications.md`'s "Reuse map" for the full audit this checkpoint
 * ran before writing a single type.
 *
 * `NotificationCategory` is deliberately a type alias, not a second enum —
 * `CommunicationCategory` (`types/communication.ts`) already is the closed
 * vocabulary every `NotificationKind` maps to a default of
 * (`NOTIFICATION_KIND_META[kind].defaultCategory`). A second, differently-
 * named enum with the same eight values would be exactly the kind of
 * duplication the checkpoint's own instructions forbid.
 */
export type NotificationCategory = CommunicationCategory;

/**
 * Read-only, seeded from `NOTIFICATION_KIND_META` (one template per
 * `NotificationKind`) — the checkpoint's own Step 16 calls this "Read-only.
 * Version history. Preview. Categories," never an authoring UI. `version`/
 * `history` exist so Step 2's "Versioning… History" requirement has
 * somewhere real to live for this one genuinely-new stored entity; a bare
 * `Notification` row has no version history of its own (see this file's
 * "Snapshot" section below for why).
 */
export interface NotificationTemplate {
  id: string;
  workspace_id: string;
  kind: NotificationKind;
  name: string;
  description: string;
  category: NotificationCategory;
  defaultPriority: NotificationPriority;
  defaultChannel: NotificationChannel;
  titleTemplate: string;
  bodyTemplate: string;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateVersion {
  templateId: string;
  version: number;
  titleTemplate: string;
  bodyTemplate: string;
  changedAt: string;
}

/**
 * `computeDeliveryReadiness()`'s (`core/notifications/routingEngine.ts`)
 * output for one channel on one notification — wraps
 * `isChannelConfigured()` (`core/notifications/registry.ts`), never a
 * second "is this channel real" check. `configured: false` today for every
 * channel except `in_app`, since no provider is registered — see the Stop
 * Conditions this checkpoint was given ("no real sending").
 */
export interface NotificationDeliveryReadiness {
  channel: NotificationChannel;
  configured: boolean;
  reason: string | null;
}

/**
 * The Routing Engine's (Step 4) pure output — "where would this
 * notification go, on what channel, at what priority, visible to whom,
 * until when" — computed, never persisted as a mutable "rule" a member
 * authors. `expiresAt` is advisory (nothing purges on it yet; see
 * `docs/notification-routing.md`'s Known Limitations).
 */
export interface NotificationRoutingDecision {
  notificationId: string;
  recipientMemberId: string | null;
  recipientClientAccountId: string | null;
  channel: NotificationChannel;
  priority: NotificationPriority;
  category: NotificationCategory;
  visible: boolean;
  suppressedReason: string | null;
  expiresAt: string | null;
  deliveryReadiness: NotificationDeliveryReadiness[];
}

/**
 * A computed, point-in-time grouping of one member's pending notifications
 * for their configured `digest_frequency` — never sent (no background
 * worker, no cron; see this checkpoint's own Stop Conditions). This is the
 * "prepare the internal platform" half of digesting; actually mailing one
 * out is explicitly future-checkpoint work.
 */
export interface NotificationDigest {
  workspaceId: string;
  memberId: string;
  frequency: "off" | "daily" | "weekly";
  notificationIds: string[];
  generatedAt: string;
}
