import { describe, expect, it, beforeEach } from "vitest";
import { NOTIFICATION_KINDS } from "@/core/notifications/types";
import {
  listNotificationTemplates,
  getNotificationTemplate,
  getNotificationTemplateForKind,
  getNotificationTemplateHistory,
  createNotificationTemplate,
  resetNotificationTemplateStore,
} from "@/lib/data/core/notifications/templateStore";

const WORKSPACE_A = "ws_a";

beforeEach(() => {
  resetNotificationTemplateStore();
});

describe("notification template store", () => {
  it("seeds exactly one active template per notification kind", () => {
    const templates = listNotificationTemplates(WORKSPACE_A);
    expect(templates).toHaveLength(NOTIFICATION_KINDS.length);
    expect(new Set(templates.map((t) => t.kind)).size).toBe(NOTIFICATION_KINDS.length);
    expect(templates.every((t) => t.archived_at === null)).toBe(true);
  });

  it("seeds only once per workspace across repeated reads", () => {
    listNotificationTemplates(WORKSPACE_A);
    const templates = listNotificationTemplates(WORKSPACE_A);
    expect(templates).toHaveLength(NOTIFICATION_KINDS.length);
  });

  it("looks up a template by id and by kind", () => {
    const templates = listNotificationTemplates(WORKSPACE_A);
    const first = templates[0];
    expect(getNotificationTemplate(WORKSPACE_A, first.id)?.id).toBe(first.id);
    expect(getNotificationTemplateForKind(WORKSPACE_A, first.kind)?.kind).toBe(first.kind);
  });

  it("returns null for an unknown template id", () => {
    listNotificationTemplates(WORKSPACE_A);
    expect(getNotificationTemplate(WORKSPACE_A, "notification_template_missing")).toBeNull();
  });

  it("records a version-1 history entry for every seeded template", () => {
    const templates = listNotificationTemplates(WORKSPACE_A);
    const history = getNotificationTemplateHistory(templates[0].id);
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
  });

  it("creates a genuinely new template with its own history, without displacing the seeded one for that kind", () => {
    const seeded = getNotificationTemplateForKind(WORKSPACE_A, "lead_created");
    expect(seeded).not.toBeNull();

    const created = createNotificationTemplate(WORKSPACE_A, {
      kind: "lead_created",
      name: "Custom Lead Alert",
      description: "A workspace-specific variant.",
      category: "crm",
      defaultPriority: "high",
      defaultChannel: "in_app",
      titleTemplate: "New lead!",
      bodyTemplate: "A new lead just came in.",
    });

    expect(created.version).toBe(1);
    expect(getNotificationTemplateHistory(created.id)).toHaveLength(1);
    expect(listNotificationTemplates(WORKSPACE_A).filter((t) => t.kind === "lead_created")).toHaveLength(2);
    // getNotificationTemplateForKind still returns the original seeded template (first match).
    expect(getNotificationTemplateForKind(WORKSPACE_A, "lead_created")?.id).toBe(seeded?.id);
  });
});
