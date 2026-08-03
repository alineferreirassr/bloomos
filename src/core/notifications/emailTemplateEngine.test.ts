import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveNotificationTemplate, findUnknownEmailTemplatePlaceholders, previewNotificationContent } from "@/core/notifications/emailTemplateEngine";
import { registerMergeField, resetMergeFieldRegistry } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver, resetMergeResolvers } from "@/core/documents/mergeEngine";
import type { NotificationTemplate } from "@/types/notificationPlatform";
import type { MergeContext } from "@/types/documentPlatform";

const context: MergeContext = { workspaceId: "ws_1", memberId: "member_1", clientId: "client_1" };

function makeTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: "template_1",
    workspace_id: "ws_1",
    kind: "proposal_sent",
    name: "Proposal Sent",
    description: "",
    category: "crm",
    defaultPriority: "normal",
    defaultChannel: "email",
    titleTemplate: "Hi {{client_name}}, your proposal is ready",
    bodyTemplate: "Dear {{client_name}}, thank you for considering {{brand_name}}.",
    version: 1,
    archived_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  resetMergeFieldRegistry();
  resetMergeResolvers();
  registerMergeField({ key: "client_name", label: "Client Name", description: "", domain: "crm", valueType: "string", required: false });
  registerMergeField({ key: "brand_name", label: "Brand Name", description: "", domain: "brand", valueType: "string", required: false });
  registerMergeResolver("client_name", async () => "Alex Rivera");
  registerMergeResolver("brand_name", async () => "Amoré Bloom");
});

afterEach(() => {
  resetMergeFieldRegistry();
  resetMergeResolvers();
});

describe("resolveNotificationTemplate", () => {
  it("resolves a real NotificationTemplate's own titleTemplate/bodyTemplate through the same Merge Field Engine the Document Platform uses", async () => {
    const resolved = await resolveNotificationTemplate(makeTemplate(), context);
    expect(resolved.title).toBe("Hi Alex Rivera, your proposal is ready");
    expect(resolved.body).toBe("Dear Alex Rivera, thank you for considering Amoré Bloom.");
  });

  it("resolves an unregistered placeholder to an empty string rather than throwing", async () => {
    const resolved = await resolveNotificationTemplate(makeTemplate({ bodyTemplate: "See {{not_a_real_field}}." }), context);
    expect(resolved.body).toBe("See .");
  });
});

describe("findUnknownEmailTemplatePlaceholders", () => {
  it("returns an empty list when every placeholder is a real registered Merge Field", () => {
    expect(findUnknownEmailTemplatePlaceholders(makeTemplate())).toEqual([]);
  });

  it("flags a placeholder that isn't a registered Merge Field", () => {
    const unknown = findUnknownEmailTemplatePlaceholders(makeTemplate({ bodyTemplate: "Dear {{client_name}}, see {{totally_made_up}}." }));
    expect(unknown).toEqual(["totally_made_up"]);
  });
});

describe("previewNotificationContent", () => {
  it("resolves a raw title/body pair without needing a stored NotificationTemplate", async () => {
    const preview = await previewNotificationContent("Hello {{client_name}}", "Body for {{brand_name}}", context);
    expect(preview.title).toBe("Hello Alex Rivera");
    expect(preview.body).toBe("Body for Amoré Bloom");
  });
});
