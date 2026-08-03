import { beforeEach, describe, expect, it, vi } from "vitest";

// v2 Checkpoint 45 — the compiler's own MergeContext ownership check (security fix) now
// calls the real `@/lib/data` accessors for every id-bearing context field; this suite tests
// the DocumentsManager itself, not real CRM/Finance linkage, so `client_1`/`event_1` are
// stubbed to belong to `ws_1` the same way `compiler.test.ts`'s own security tests do.
vi.mock("@/lib/data", () => ({
  getClientById: vi.fn().mockResolvedValue({ id: "client_1", workspace_id: "ws_1" }),
  getLeadById: vi.fn().mockRejectedValue(new Error("not used in this suite")),
  getEventById: vi.fn().mockResolvedValue({ id: "event_1", workspace_id: "ws_1" }),
  getInvoiceById: vi.fn().mockRejectedValue(new Error("not used in this suite")),
  getContract: vi.fn().mockRejectedValue(new Error("not used in this suite")),
  getVendorById: vi.fn().mockRejectedValue(new Error("not used in this suite")),
}));
vi.mock("@/lib/data/proposals", () => ({ getProposalsRepository: () => ({ getProposalById: vi.fn().mockResolvedValue(null) }) }));

import { getDocumentsManager } from "@/core/documents/manager";
import { resetDocumentsStore } from "@/lib/data/core/documents/mockRepository";
import { registerMergeField, resetMergeFieldRegistry } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver, resetMergeResolvers } from "@/core/documents/mergeEngine";
import { readActivities, resetTimelineStore } from "@/lib/data/mock/timelineStore";
import type { CreateTemplateInput } from "@/lib/data/core/documents/repository";
import type { MergeContext } from "@/types/documentPlatform";

const context: MergeContext = { workspaceId: "ws_1", memberId: "member_1", clientId: "client_1", eventId: "event_1" };
const openPermissions = { permissions: [], role: null };

const templateInput: CreateTemplateInput = {
  documentTypeId: "contract",
  name: "Wedding Contract",
  description: "Standard wedding services contract.",
  content: [{ id: "p1", type: "paragraph", runs: [{ text: "Dear {{client_name}}, regarding {{event_title}}." }] }],
  header: [],
  footer: [],
  variables: [],
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

beforeEach(() => {
  resetDocumentsStore();
  resetTimelineStore();
  resetMergeFieldRegistry();
  resetMergeResolvers();
  registerMergeField({ key: "client_name", label: "Client Name", description: "", domain: "crm", valueType: "string", required: false });
  registerMergeField({ key: "event_title", label: "Event Title", description: "", domain: "crm", valueType: "string", required: false });
  registerMergeResolver("client_name", async () => "Alex Rivera");
  registerMergeResolver("event_title", async () => "Rivera Wedding");
});

describe("compileAndCreateDocument", () => {
  it("returns unknown_template and persists nothing for a nonexistent templateId", async () => {
    const result = await getDocumentsManager().compileAndCreateDocument("template_missing", context, openPermissions);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0].code).toBe("unknown_template");
    expect(await getDocumentsManager().listComposedDocuments("ws_1")).toEqual([]);
  });

  it("returns validation issues and persists nothing when compilation fails", async () => {
    const created = await getDocumentsManager().createTemplate("ws_1", "member_1", {
      ...templateInput,
      content: [{ id: "p1", type: "paragraph", runs: [{ text: "{{not_a_real_field}}" }] }],
    });
    if (!created.success) throw new Error("setup failed");

    const result = await getDocumentsManager().compileAndCreateDocument(created.data.id, context, openPermissions);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.some((issue) => issue.code === "unknown_field")).toBe(true);
    expect(await getDocumentsManager().listComposedDocuments("ws_1")).toEqual([]);
  });

  it("compiles and persists a real ComposedDocument, deriving metadata from the resolved scope", async () => {
    const created = await getDocumentsManager().createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");

    const result = await getDocumentsManager().compileAndCreateDocument(created.data.id, context, openPermissions);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.document.status).toBe("draft");
    expect(result.document.metadata.clientName).toBe("Alex Rivera");
    expect(result.document.metadata.eventTitle).toBe("Rivera Wedding");
    expect(result.document.metadata.title).toBe("Wedding Contract");
    expect(result.document.content[0]).toMatchObject({ type: "paragraph", runs: [{ text: "Dear Alex Rivera, regarding Rivera Wedding." }] });

    const persisted = await getDocumentsManager().getComposedDocumentById(result.document.id);
    expect(persisted).not.toBeNull();
  });

  it("raises permission_denied and persists nothing when the caller lacks the Template's own required permission", async () => {
    const created = await getDocumentsManager().createTemplate("ws_1", "member_1", { ...templateInput, requiredPermissions: ["documents.create"] });
    if (!created.success) throw new Error("setup failed");

    const result = await getDocumentsManager().compileAndCreateDocument(created.data.id, context, { permissions: [], role: null });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues[0].code).toBe("permission_denied");
    expect(await getDocumentsManager().listComposedDocuments("ws_1")).toEqual([]);
  });
});

describe("DocumentsManager version operations", () => {
  it("records a version and it's immediately visible via getDocumentVersions", async () => {
    const created = await getDocumentsManager().createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    const compiled = await getDocumentsManager().compileAndCreateDocument(created.data.id, context, openPermissions);
    if (!compiled.success) throw new Error("setup failed");

    const version = await getDocumentsManager().recordDocumentVersion(compiled.document.id, {
      content: compiled.document.content,
      metadata: compiled.document.metadata,
      compiledBy: "member_1",
      label: null,
    });
    expect(version.success).toBe(true);

    const versions = await getDocumentsManager().getDocumentVersions(compiled.document.id);
    expect(versions).toHaveLength(1);
  });

  it("restoreDocumentVersion round-trips through the manager", async () => {
    const created = await getDocumentsManager().createTemplate("ws_1", "member_1", templateInput);
    if (!created.success) throw new Error("setup failed");
    const compiled = await getDocumentsManager().compileAndCreateDocument(created.data.id, context, openPermissions);
    if (!compiled.success) throw new Error("setup failed");
    await getDocumentsManager().recordDocumentVersion(compiled.document.id, { content: compiled.document.content, metadata: compiled.document.metadata, compiledBy: "member_1", label: null });

    const restored = await getDocumentsManager().restoreDocumentVersion(compiled.document.id, 1);
    expect(restored.success).toBe(true);
  });
});

describe("DocumentsManager v2 Checkpoint 44 Document Bundle operations", () => {
  it("creates a Bundle empty, then adds items by reference", async () => {
    const created = await getDocumentsManager().createDocumentBundle("ws_1", "member_1", {
      clientId: "client_1",
      eventId: "event_1",
      title: "Rivera Wedding Package",
      description: "Everything for the Rivera wedding.",
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.data.status).toBe("draft");
    expect(created.data.items).toEqual([]);

    const withItem = await getDocumentsManager().addDocumentBundleItem(created.data.id, "proposal", "proposal_1");
    expect(withItem.success).toBe(true);
    if (!withItem.success) return;
    expect(withItem.data.items).toHaveLength(1);
    expect(withItem.data.items[0]).toMatchObject({ kind: "proposal", refId: "proposal_1" });
  });

  it("rejects adding a duplicate (kind, refId) item", async () => {
    const created = await getDocumentsManager().createDocumentBundle("ws_1", "member_1", { clientId: "client_1", eventId: null, title: "Bundle", description: "" });
    if (!created.success) throw new Error("setup failed");
    await getDocumentsManager().addDocumentBundleItem(created.data.id, "contract", "contract_1");
    const duplicate = await getDocumentsManager().addDocumentBundleItem(created.data.id, "contract", "contract_1");
    expect(duplicate.success).toBe(false);
  });

  it("removes an item from a Bundle", async () => {
    const created = await getDocumentsManager().createDocumentBundle("ws_1", "member_1", { clientId: "client_1", eventId: null, title: "Bundle", description: "" });
    if (!created.success) throw new Error("setup failed");
    const withItem = await getDocumentsManager().addDocumentBundleItem(created.data.id, "invoice", "invoice_1");
    if (!withItem.success) throw new Error("setup failed");

    const removed = await getDocumentsManager().removeDocumentBundleItem(created.data.id, withItem.data.items[0].id);
    expect(removed.success).toBe(true);
    if (!removed.success) return;
    expect(removed.data.items).toEqual([]);
  });

  it("moves status forward only: draft -> ready -> sent -> viewed", async () => {
    const created = await getDocumentsManager().createDocumentBundle("ws_1", "member_1", { clientId: "client_1", eventId: null, title: "Bundle", description: "" });
    if (!created.success) throw new Error("setup failed");

    const ready = await getDocumentsManager().updateDocumentBundleStatus(created.data.id, "ready");
    expect(ready.success).toBe(true);

    const sent = await getDocumentsManager().updateDocumentBundleStatus(created.data.id, "sent");
    expect(sent.success).toBe(true);
    if (sent.success) expect(sent.data.sentAt).not.toBeNull();

    const backwards = await getDocumentsManager().updateDocumentBundleStatus(created.data.id, "draft");
    expect(backwards.success).toBe(false);
  });

  it("listDocumentBundlesForClient only returns Bundles for that Client", async () => {
    await getDocumentsManager().createDocumentBundle("ws_1", "member_1", { clientId: "client_1", eventId: null, title: "Client 1 Bundle", description: "" });
    await getDocumentsManager().createDocumentBundle("ws_1", "member_1", { clientId: "client_2", eventId: null, title: "Client 2 Bundle", description: "" });

    const forClient1 = await getDocumentsManager().listDocumentBundlesForClient("ws_1", "client_1");
    expect(forClient1).toHaveLength(1);
    expect(forClient1[0].title).toBe("Client 1 Bundle");
  });

  it("v2 Checkpoint 44, Step 13 — records a Timeline event for every real Bundle mutation", async () => {
    const created = await getDocumentsManager().createDocumentBundle("ws_1", "member_1", { clientId: "client_1", eventId: null, title: "Timeline Bundle", description: "" });
    if (!created.success) throw new Error("setup failed");
    const withItem = await getDocumentsManager().addDocumentBundleItem(created.data.id, "proposal", "proposal_1");
    if (!withItem.success) throw new Error("setup failed");
    await getDocumentsManager().removeDocumentBundleItem(created.data.id, withItem.data.items[0].id);
    await getDocumentsManager().updateDocumentBundleStatus(created.data.id, "ready");
    await getDocumentsManager().updateDocumentBundleStatus(created.data.id, "sent");

    const activities = readActivities().filter((a) => a.owner_type === "document_bundle" && a.owner_id === created.data.id);
    const types = activities.map((a) => a.type);
    expect(types).toContain("document_bundle_created");
    expect(types).toContain("document_bundle_item_added");
    expect(types).toContain("document_bundle_item_removed");
    expect(types).toContain("document_bundle_ready");
    expect(types).toContain("document_bundle_sent");
  });
});
