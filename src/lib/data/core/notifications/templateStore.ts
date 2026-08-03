import { NOTIFICATION_KIND_META } from "@/core/communication/notificationEngine";
import { NOTIFICATION_KINDS } from "@/core/notifications/types";
import type { NotificationTemplate, NotificationTemplateVersion } from "@/types/notificationPlatform";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 41, Step 2 — Notification Template Library. Seeded once,
 * one `NotificationTemplate` per `NotificationKind`, from the exact
 * `NOTIFICATION_KIND_META` table `core/communication/notificationEngine.ts`
 * (Checkpoint 24) already maintains as the single source of truth for a
 * kind's label/priority/category — this store never re-derives those, only
 * wraps them in a persisted, versioned, browsable row.
 *
 * `titleTemplate`/`bodyTemplate` are illustrative preview text, not a
 * live merge-field engine — `buildNotificationInput()` always takes
 * caller-supplied title/body per notification (a Lead Created notification
 * says "Jane Doe" because a real lead was created, not because a
 * `{{lead_name}}` placeholder was substituted). A real merge/template
 * engine already exists for Documents/Contracts/Invoices
 * (`core/documents/mergeEngine.ts`); duplicating that machinery for
 * notification text — which has always been freeform per-call-site
 * content — would be exactly the kind of duplication this checkpoint's
 * own instructions forbid. See `docs/notification-templates.md`.
 *
 * Read-only from the UI's perspective (Step 16: "Read-only. Version
 * history. Preview.") — `version`/`history` exist so a future checkpoint
 * that does add real per-kind authoring has somewhere to write to; nothing
 * in this checkpoint mutates a template's text.
 */

let templates: NotificationTemplate[] = [];
let history: NotificationTemplateVersion[] = [];
let seeded = false;

function seedTemplates(workspaceId: string): void {
  if (seeded) return;
  seeded = true;
  const now = nowIso();
  templates = NOTIFICATION_KINDS.map((kind) => {
    const meta = NOTIFICATION_KIND_META[kind];
    const id = generateId("notification_template");
    const titleTemplate = meta.label;
    const bodyTemplate = `Example ${meta.label.toLowerCase()} notification body — actual text is supplied by the event that triggers it.`;
    history.push({ templateId: id, version: 1, titleTemplate, bodyTemplate, changedAt: now });
    return {
      id,
      workspace_id: workspaceId,
      kind,
      name: meta.label,
      description: `System template for "${meta.label}" notifications.`,
      category: meta.defaultCategory,
      defaultPriority: meta.defaultPriority,
      defaultChannel: "in_app" as const,
      titleTemplate,
      bodyTemplate,
      version: 1,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
  });
}

/** Test-only: restore the store to unseeded/empty between test cases. */
export function resetNotificationTemplateStore(): void {
  templates = [];
  history = [];
  seeded = false;
}

export function listNotificationTemplates(workspaceId: string, includeArchived = false): NotificationTemplate[] {
  seedTemplates(workspaceId);
  return templates.filter((t) => t.workspace_id === workspaceId && (includeArchived || t.archived_at === null));
}

export function getNotificationTemplate(workspaceId: string, id: string): NotificationTemplate | null {
  seedTemplates(workspaceId);
  return templates.find((t) => t.workspace_id === workspaceId && t.id === id) ?? null;
}

export function getNotificationTemplateForKind(workspaceId: string, kind: NotificationTemplate["kind"]): NotificationTemplate | null {
  seedTemplates(workspaceId);
  return templates.find((t) => t.workspace_id === workspaceId && t.kind === kind) ?? null;
}

export function getNotificationTemplateHistory(templateId: string): NotificationTemplateVersion[] {
  return history.filter((h) => h.templateId === templateId).sort((a, b) => b.version - a.version);
}

export interface CreateNotificationTemplateInput {
  kind: NotificationTemplate["kind"];
  name: string;
  description: string;
  category: NotificationTemplate["category"];
  defaultPriority: NotificationTemplate["defaultPriority"];
  defaultChannel: NotificationTemplate["defaultChannel"];
  titleTemplate: string;
  bodyTemplate: string;
}

/**
 * Genuinely new infrastructure (Step 11's own `createNotificationTemplateAction`
 * needs a real store function to call), even though the Template Library
 * UI (Step 16) stays read-only this checkpoint and never renders a create
 * form for it — same "action exists as real infrastructure, not every
 * affordance is wired to a UI control yet" precedent other checkpoints
 * have used (e.g. Search's `createSavedSearchAction` predates any UI
 * button in some contexts). A workspace can have more than one template
 * per `kind` after this — `getNotificationTemplateForKind` still returns
 * the first match, i.e. the original system-seeded one.
 */
export function createNotificationTemplate(workspaceId: string, input: CreateNotificationTemplateInput): NotificationTemplate {
  seedTemplates(workspaceId);
  const now = nowIso();
  const id = generateId("notification_template");
  history.push({ templateId: id, version: 1, titleTemplate: input.titleTemplate, bodyTemplate: input.bodyTemplate, changedAt: now });
  const template: NotificationTemplate = {
    id,
    workspace_id: workspaceId,
    kind: input.kind,
    name: input.name,
    description: input.description,
    category: input.category,
    defaultPriority: input.defaultPriority,
    defaultChannel: input.defaultChannel,
    titleTemplate: input.titleTemplate,
    bodyTemplate: input.bodyTemplate,
    version: 1,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
  templates = [...templates, template];
  return template;
}
