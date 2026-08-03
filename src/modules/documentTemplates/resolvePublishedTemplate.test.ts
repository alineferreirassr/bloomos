import { beforeEach, describe, expect, it } from "vitest";
import { resolvePublishedTemplate, mergeContextEntityIdsFromFacts } from "@/modules/documentTemplates/resolvePublishedTemplate";
import { getDocumentsManager } from "@/core/documents/manager";
import { resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";
import type { CreateTemplateInput } from "@/lib/data/core/documents/repository";

const templateInput: CreateTemplateInput = {
  documentTypeId: "contract",
  name: "Wedding Contract",
  description: "",
  content: [],
  header: [],
  footer: [],
  variables: [],
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

beforeEach(() => {
  resetDocumentsStore();
});

describe("resolvePublishedTemplate", () => {
  it("returns null when no Template of this document type exists", async () => {
    expect(await resolvePublishedTemplate("ws_1", "contract")).toBeNull();
  });

  it("returns null when a Template exists but is still a draft", async () => {
    await getDocumentsManager().createTemplate("ws_1", "member_1", templateInput);
    expect(await resolvePublishedTemplate("ws_1", "contract")).toBeNull();
  });

  it("returns the published Template once it's been published", async () => {
    const created = await getDocumentsManager().createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await getDocumentsManager().publishTemplate(created.data.id);
    const resolved = await resolvePublishedTemplate("ws_1", "contract");
    expect(resolved?.id).toBe(created.data.id);
  });

  it("never returns a published Template belonging to a different workspace", async () => {
    const created = await getDocumentsManager().createTemplate("ws_2", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await getDocumentsManager().publishTemplate(created.data.id);
    expect(await resolvePublishedTemplate("ws_1", "contract")).toBeNull();
  });
});

describe("mergeContextEntityIdsFromFacts", () => {
  it("extracts only the string-typed entity id facts present", () => {
    expect(mergeContextEntityIdsFromFacts({ clientId: "client_1", eventId: 42, invoiceId: null })).toEqual({
      clientId: "client_1",
      leadId: undefined,
      eventId: undefined,
      invoiceId: undefined,
      contractId: undefined,
    });
  });

  it("returns all-undefined for an empty facts record", () => {
    expect(mergeContextEntityIdsFromFacts({})).toEqual({ clientId: undefined, leadId: undefined, eventId: undefined, invoiceId: undefined, contractId: undefined });
  });
});
