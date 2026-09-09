import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationTemplatesView } from "@/modules/notifications/components/NotificationTemplatesView";
import type { NotificationTemplate } from "@/types/notificationPlatform";
import type { NotificationTemplateDetail } from "@/modules/notifications/notificationPlatformActions";

vi.mock("@/modules/notifications/notificationPlatformActions", () => ({
  listNotificationTemplatesAction: vi.fn(),
  getNotificationTemplateDetailAction: vi.fn(),
}));

import { listNotificationTemplatesAction, getNotificationTemplateDetailAction } from "@/modules/notifications/notificationPlatformActions";

function makeTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: "template_1",
    workspace_id: "ws_1",
    kind: "lead_created",
    name: "New Lead",
    description: "Sent when a new lead is created.",
    category: "crm",
    defaultPriority: "high",
    defaultChannel: "in_app",
    titleTemplate: "New lead: {{name}}",
    bodyTemplate: "{{name}} just submitted an inquiry.",
    version: 1,
    archived_at: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("NotificationTemplatesView", () => {
  it("renders the page header while loading", () => {
    vi.mocked(listNotificationTemplatesAction).mockReturnValue(new Promise(() => {}));

    render(<NotificationTemplatesView />);

    expect(screen.getByText("Notification Templates")).toBeInTheDocument();
  });

  it("shows an error state when the template list fetch fails", async () => {
    vi.mocked(listNotificationTemplatesAction).mockResolvedValue({ success: false, error: "Notifications aren't available. You may not have access to them." });

    render(<NotificationTemplatesView />);

    expect(await screen.findByText("Notifications aren't available. You may not have access to them.")).toBeInTheDocument();
  });

  it("lists templates with a category tab and shows the pre-selection prompt", async () => {
    const template = makeTemplate({ id: "template_1", name: "New Lead", category: "crm" });
    vi.mocked(listNotificationTemplatesAction).mockResolvedValue({ success: true, data: [template] });

    render(<NotificationTemplatesView />);

    expect(await screen.findByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "crm" })).toBeInTheDocument();
    expect(screen.getByText("New Lead")).toBeInTheDocument();
    expect(screen.getByText("Select a template to preview it.")).toBeInTheDocument();
  });

  it("selects a template and renders its preview and version history", async () => {
    const template = makeTemplate({ id: "template_1", name: "New Lead" });
    vi.mocked(listNotificationTemplatesAction).mockResolvedValue({ success: true, data: [template] });
    const detail: NotificationTemplateDetail = {
      template,
      history: [
        { templateId: "template_1", version: 2, titleTemplate: "New lead: {{name}}", bodyTemplate: "{{name}} just submitted an inquiry.", changedAt: "2026-08-10T00:00:00.000Z" },
        { templateId: "template_1", version: 1, titleTemplate: "New lead: {{name}}", bodyTemplate: "{{name}} just submitted an inquiry.", changedAt: "2026-08-01T00:00:00.000Z" },
      ],
    };
    vi.mocked(getNotificationTemplateDetailAction).mockResolvedValue({ success: true, data: detail });

    render(<NotificationTemplatesView />);

    const row = await screen.findByRole("button", { name: /New Lead/ });
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(row);

    expect(getNotificationTemplateDetailAction).toHaveBeenCalledWith("template_1");
    expect(await screen.findByText("New lead: {{name}}")).toBeInTheDocument();
    expect(screen.getByText("{{name}} just submitted an inquiry.")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });
});
