import { beforeEach, describe, expect, it } from "vitest";
import { mockDocumentsRepository, resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";
import type { CreateComposedDocumentInput, CreateTemplateInput } from "@/lib/data/core/documents/repository";

const templateInput: CreateTemplateInput = {
  documentTypeId: "contract",
  name: "Wedding Contract",
  description: "Standard wedding services contract.",
  content: [],
  header: [],
  footer: [],
  variables: [],
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

const documentInput: CreateComposedDocumentInput = {
  templateId: "template_x",
  documentTypeId: "contract",
  content: [],
  mergeContext: { workspaceId: "ws_1", memberId: "member_1" },
  metadata: { title: "Wedding Contract", description: "", tags: [], clientName: "Alex Rivera", eventTitle: "Rivera Wedding" },
  createdBy: "member_1",
};

beforeEach(() => {
  resetDocumentsStore();
});

describe("Template lifecycle", () => {
  it("creates a Template in draft status, version 0", async () => {
    const result = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ status: "draft", version: 0, workspaceId: "ws_1", createdBy: "member_1" });
  });

  it("listTemplates scopes strictly by workspaceId", async () => {
    await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    await mockDocumentsRepository.createTemplate("ws_2", "member_1", templateInput);
    const templates = await mockDocumentsRepository.listTemplates("ws_1");
    expect(templates).toHaveLength(1);
    expect(templates[0].workspaceId).toBe("ws_1");
  });

  it("updateTemplateDraft updates only the fields provided", async () => {
    const created = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    const updated = await mockDocumentsRepository.updateTemplateDraft(created.data.id, { description: "Updated description" });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.name).toBe(templateInput.name);
    expect(updated.data.description).toBe("Updated description");
  });

  it("updateTemplateDraft fails for an archived Template", async () => {
    const created = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.archiveTemplate(created.data.id);
    const updated = await mockDocumentsRepository.updateTemplateDraft(created.data.id, { name: "New Name" });
    expect(updated.success).toBe(false);
  });

  it("publishTemplate flips status to published and increments version", async () => {
    const created = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    const published = await mockDocumentsRepository.publishTemplate(created.data.id);
    expect(published.success).toBe(true);
    if (!published.success) return;
    expect(published.data).toMatchObject({ status: "published", version: 1 });
  });

  it("a Template's own content stays editable after publish — publishing doesn't lock the draft", async () => {
    const created = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.publishTemplate(created.data.id);
    const updated = await mockDocumentsRepository.updateTemplateDraft(created.data.id, { name: "Revised Name" });
    expect(updated.success).toBe(true);
  });

  it("archiveTemplate then unarchiveTemplate returns it to draft when it was never published", async () => {
    const created = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.archiveTemplate(created.data.id);
    const unarchived = await mockDocumentsRepository.unarchiveTemplate(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.status).toBe("draft");
  });

  it("unarchiveTemplate returns it to published when it had already been published", async () => {
    const created = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.publishTemplate(created.data.id);
    await mockDocumentsRepository.archiveTemplate(created.data.id);
    const unarchived = await mockDocumentsRepository.unarchiveTemplate(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.status).toBe("published");
  });

  it("duplicateTemplate creates a new Template copying the source's current draft, independent of the source", async () => {
    const created = await mockDocumentsRepository.createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.publishTemplate(created.data.id);
    const duplicated = await mockDocumentsRepository.duplicateTemplate(created.data.id, "member_2");
    expect(duplicated.success).toBe(true);
    if (!duplicated.success) return;
    expect(duplicated.data.id).not.toBe(created.data.id);
    expect(duplicated.data.status).toBe("draft");
    expect(duplicated.data.version).toBe(0);
    expect(duplicated.data.name).toBe("Wedding Contract (Copy)");

    const source = await mockDocumentsRepository.getTemplateById(created.data.id);
    expect(source?.status).toBe("published");
  });
});

describe("ComposedDocument + version lifecycle", () => {
  it("creates a ComposedDocument in draft status, currentVersion 0", async () => {
    const result = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ status: "draft", currentVersion: 0 });
  });

  it("recordDocumentVersion creates version 1 and flips status to published", async () => {
    const created = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    if (!created.success) throw new Error("setup failed");
    const version = await mockDocumentsRepository.recordDocumentVersion(created.data.id, {
      content: [],
      metadata: documentInput.metadata,
      compiledBy: "member_1",
      label: "Sent to client",
    });
    expect(version.success).toBe(true);
    if (!version.success) return;
    expect(version.data.version).toBe(1);

    const document = await mockDocumentsRepository.getComposedDocumentById(created.data.id);
    expect(document).toMatchObject({ status: "published", currentVersion: 1 });
  });

  it("recording a second version never mutates the first — both remain independently retrievable", async () => {
    const created = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, {
      content: [{ id: "p1", type: "paragraph", runs: [{ text: "v1" }] }],
      metadata: documentInput.metadata,
      compiledBy: "member_1",
      label: null,
    });
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, {
      content: [{ id: "p1", type: "paragraph", runs: [{ text: "v2" }] }],
      metadata: documentInput.metadata,
      compiledBy: "member_1",
      label: null,
    });

    const v1 = await mockDocumentsRepository.getDocumentVersion(created.data.id, 1);
    const v2 = await mockDocumentsRepository.getDocumentVersion(created.data.id, 2);
    expect(v1?.content).toEqual([{ id: "p1", type: "paragraph", runs: [{ text: "v1" }] }]);
    expect(v2?.content).toEqual([{ id: "p1", type: "paragraph", runs: [{ text: "v2" }] }]);
  });

  it("getDocumentVersions returns every version newest first", async () => {
    const created = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, { content: [], metadata: documentInput.metadata, compiledBy: "member_1", label: null });
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, { content: [], metadata: documentInput.metadata, compiledBy: "member_1", label: null });
    const versions = await mockDocumentsRepository.getDocumentVersions(created.data.id);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
  });

  it("restoreDocumentVersion copies a prior version's content back onto the draft without touching the version record or currentVersion", async () => {
    const created = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, {
      content: [{ id: "p1", type: "paragraph", runs: [{ text: "v1" }] }],
      metadata: documentInput.metadata,
      compiledBy: "member_1",
      label: null,
    });
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, {
      content: [{ id: "p1", type: "paragraph", runs: [{ text: "v2" }] }],
      metadata: documentInput.metadata,
      compiledBy: "member_1",
      label: null,
    });

    const restored = await mockDocumentsRepository.restoreDocumentVersion(created.data.id, 1);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.data.content).toEqual([{ id: "p1", type: "paragraph", runs: [{ text: "v1" }] }]);
    expect(restored.data.currentVersion).toBe(2);

    const v2StillIntact = await mockDocumentsRepository.getDocumentVersion(created.data.id, 2);
    expect(v2StillIntact?.content).toEqual([{ id: "p1", type: "paragraph", runs: [{ text: "v2" }] }]);
  });

  it("duplicateComposedDocument creates a new Document copying the source's current content, independent of the source", async () => {
    const created = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, { content: [], metadata: documentInput.metadata, compiledBy: "member_1", label: null });

    const duplicated = await mockDocumentsRepository.duplicateComposedDocument(created.data.id, "member_2");
    expect(duplicated.success).toBe(true);
    if (!duplicated.success) return;
    expect(duplicated.data.status).toBe("draft");
    expect(duplicated.data.currentVersion).toBe(0);
    expect(duplicated.data.metadata.title).toBe("Wedding Contract (Copy)");

    const source = await mockDocumentsRepository.getComposedDocumentById(created.data.id);
    expect(source?.status).toBe("published");
  });

  it("archiveComposedDocument then unarchiveComposedDocument returns it to published once it has a version", async () => {
    const created = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, { content: [], metadata: documentInput.metadata, compiledBy: "member_1", label: null });
    await mockDocumentsRepository.archiveComposedDocument(created.data.id);
    const unarchived = await mockDocumentsRepository.unarchiveComposedDocument(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.status).toBe("published");
  });

  it("listComposedDocuments scopes strictly by workspaceId", async () => {
    await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    await mockDocumentsRepository.createComposedDocument("ws_2", documentInput);
    const documents = await mockDocumentsRepository.listComposedDocuments("ws_1");
    expect(documents).toHaveLength(1);
  });

  it("resetDocumentsStore clears templates, documents, and versions", async () => {
    const created = await mockDocumentsRepository.createComposedDocument("ws_1", documentInput);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.recordDocumentVersion(created.data.id, { content: [], metadata: documentInput.metadata, compiledBy: "member_1", label: null });
    resetDocumentsStore();
    expect(await mockDocumentsRepository.listComposedDocuments("ws_1")).toEqual([]);
    expect(await mockDocumentsRepository.getDocumentVersions(created.data.id)).toEqual([]);
  });
});
