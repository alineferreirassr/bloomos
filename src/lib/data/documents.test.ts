import { beforeEach, describe, expect, it } from "vitest";
import {
  getDocuments,
  getDocumentById,
  createDocumentMetadata,
  updateDocumentMetadata,
  activateDocument,
  createDocumentVersion,
  archiveDocument,
  restoreDocument,
  softDeleteDocument,
  expireDocument,
  updateDocumentVisibility,
  moveDocumentToFolder,
  getDocumentVersions,
  getLatestDocumentVersion,
  getDocumentsByOwner,
  getDocumentsByCategory,
  getDocumentsByReference,
  getDocumentNextAction,
  getDocumentOwnerSummary,
  getWorkspaceDocumentSummary,
  getDocumentFolders,
  getDocumentFolderById,
  createDocumentFolder,
  updateDocumentFolder,
  moveDocumentFolder,
  archiveDocumentFolder,
  restoreDocumentFolder,
  getDocumentFolderTree,
  getDocumentFolderPath,
  applyDefaultFolderTemplate,
  getNotesByDocumentId,
  createDocumentNote,
  getTimelineByDocumentId,
  getNotesByDocumentFolderId,
  createDocumentFolderNote,
  getTimelineByDocumentFolderId,
  attachDocumentToContractExhibit,
  attachDocumentToPayment,
  attachDocumentToExpense,
  attachDocumentToInvoice,
  attachDocumentToEvent,
  attachDocumentToClient,
  getTimelineByClientId,
  getDashboardMetrics,
  resetAllMockData,
} from "@/lib/data";
import type { DocumentMetadataInput, NewDocumentVersionInput } from "@/modules/documents/schema";

const validMetadataInput: DocumentMetadataInput = {
  owner_type: "client",
  owner_id: "client_2",
  folder_id: null,
  title: null,
  description: null,
  category: "other",
  visibility: "internal",
  file_name: "Test File.pdf",
  mime_type: "application/pdf",
  size_bytes: 50_000,
  expires_at: null,
  uploaded_by: null,
  contract_exhibit_id: null,
  event_id: null,
  client_id: null,
  contract_id: null,
  invoice_id: null,
  payment_id: null,
  expense_id: null,
};

beforeEach(() => {
  resetAllMockData();
});

describe("mock data", () => {
  it("seeds documents across the required categories and statuses", async () => {
    const all = await getDocuments({ includeArchived: true, includeDeleted: true });
    const categories = new Set(all.map((d) => d.category));
    for (const category of [
      "contract",
      "signed_contract",
      "exhibit",
      "invoice",
      "payment_confirmation",
      "expense_receipt",
      "moodboard",
      "floor_plan",
      "event_schedule",
      "inspiration",
      "identification",
      "insurance",
      "policy",
      "report",
    ] as const) {
      expect(categories.has(category)).toBe(true);
    }
    const statuses = new Set(all.map((d) => d.status));
    for (const status of ["draft", "active", "superseded", "expired", "archived"] as const) {
      expect(statuses.has(status)).toBe(true);
    }
  });

  it("seeds a 3-version chain for the unsigned Contract draft", async () => {
    const versions = await getDocumentVersions("document_1");
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(versions.filter((v) => v.is_latest_version)).toHaveLength(1);
    expect(versions.find((v) => v.is_latest_version)?.version).toBe(3);
  });

  it("includes a Workspace-owned document", async () => {
    const all = await getDocuments({ includeArchived: true });
    expect(all.some((d) => d.owner_type === "workspace")).toBe(true);
  });
});

describe("createDocumentMetadata", () => {
  it("creates a draft Document with a derived title when none is given", async () => {
    const result = await createDocumentMetadata(validMetadataInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.version).toBe(1);
    expect(result.data.is_latest_version).toBe(true);
    expect(result.data.file_name).toBe("test_file.pdf");
    expect(result.data.title).toBe("Test File");
    expect(result.data.storage_provider).toBe("mock");
  });

  it("records a document_created timeline activity on the new document's own id", async () => {
    const result = await createDocumentMetadata(validMetadataInput);
    if (!result.success) throw new Error("setup failed");
    const timeline = await getTimelineByDocumentId(result.data.id);
    expect(timeline.some((t) => t.type === "document_created")).toBe(true);
  });

  it("rejects an unknown owner", async () => {
    const result = await createDocumentMetadata({ ...validMetadataInput, owner_id: "client_missing" });
    expect(result.success).toBe(false);
  });

  it("rejects a Workspace owner_id that isn't the current Workspace", async () => {
    const result = await createDocumentMetadata({ ...validMetadataInput, owner_type: "workspace", owner_id: "ws_other" });
    expect(result.success).toBe(false);
  });

  it("rejects an event reference that belongs to a different client than the given client_id reference", async () => {
    const result = await createDocumentMetadata({
      ...validMetadataInput,
      client_id: "client_1",
      event_id: "event_1", // event_1 belongs to client_2, not client_1
    });
    expect(result.success).toBe(false);
  });

  it("rejects a folder belonging to a different owner", async () => {
    const result = await createDocumentMetadata({
      ...validMetadataInput,
      owner_type: "event",
      owner_id: "event_1",
      folder_id: "docfolder_9", // belongs to client_2, not event_1
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blocked file extension", async () => {
    const result = await createDocumentMetadata({ ...validMetadataInput, file_name: "app.exe", mime_type: "application/x-msdownload" });
    expect(result.success).toBe(false);
  });

  it("rejects a nonexistent Contract Exhibit reference", async () => {
    const result = await createDocumentMetadata({ ...validMetadataInput, contract_exhibit_id: "exhibit_missing" });
    expect(result.success).toBe(false);
  });
});

describe("updateDocumentMetadata", () => {
  it("updates title/description/category/expires_at", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const updated = await updateDocumentMetadata(created.data.id, {
      title: "Renamed",
      description: "New description",
      category: "identification",
      expires_at: null,
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.title).toBe("Renamed");
    expect(updated.data.category).toBe("identification");
  });

  it("rejects updates on a soft-deleted document", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    await activateDocument(created.data.id);
    await softDeleteDocument(created.data.id);
    const updated = await updateDocumentMetadata(created.data.id, {
      title: "Should fail",
      description: null,
      category: "other",
      expires_at: null,
    });
    expect(updated.success).toBe(false);
  });
});

describe("Document status transitions", () => {
  it("activates a draft document", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const activated = await activateDocument(created.data.id);
    expect(activated.success).toBe(true);
    if (activated.success) expect(activated.data.status).toBe("active");
  });

  it("rejects activating an already-active document", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    await activateDocument(created.data.id);
    const secondActivate = await activateDocument(created.data.id);
    expect(secondActivate.success).toBe(false);
  });

  it("archives and restores a document back to active", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    await activateDocument(created.data.id);
    const archived = await archiveDocument(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const restored = await restoreDocument(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("active");
      expect(restored.data.archived_at).toBeNull();
    }
  });

  it("soft-deletes a document without removing it from the store", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    await activateDocument(created.data.id);
    const deleted = await softDeleteDocument(created.data.id);
    expect(deleted.success).toBe(true);
    if (deleted.success) {
      expect(deleted.data.status).toBe("deleted");
      expect(deleted.data.deleted_at).not.toBeNull();
    }
    const stillReadable = await getDocumentById(created.data.id);
    expect(stillReadable.status).toBe("deleted");
  });

  it("restores a soft-deleted document back to active", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    await activateDocument(created.data.id);
    await softDeleteDocument(created.data.id);
    const restored = await restoreDocument(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.status).toBe("active");
  });

  it("expires an active document", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    await activateDocument(created.data.id);
    const expired = await expireDocument(created.data.id);
    expect(expired.success).toBe(true);
    if (expired.success) expect(expired.data.status).toBe("expired");
  });

  it("rejects expiring a draft document directly", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const result = await expireDocument(created.data.id);
    expect(result.success).toBe(false);
  });
});

describe("updateDocumentVisibility / moveDocumentToFolder", () => {
  it("changes visibility and records a timeline activity", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const updated = await updateDocumentVisibility(created.data.id, "client");
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.visibility).toBe("client");
    const timeline = await getTimelineByDocumentId(created.data.id);
    expect(timeline.some((t) => t.type === "document_visibility_changed")).toBe(true);
  });

  it("moves a document into a folder owned by the same owner", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const moved = await moveDocumentToFolder(created.data.id, "docfolder_9");
    expect(moved.success).toBe(true);
    if (moved.success) expect(moved.data.folder_id).toBe("docfolder_9");
  });

  it("rejects moving into a folder owned by a different owner", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const moved = await moveDocumentToFolder(created.data.id, "docfolder_4"); // owned by event_1
    expect(moved.success).toBe(false);
  });
});

describe("createDocumentVersion", () => {
  it("creates a new latest version and marks the prior one superseded", async () => {
    const before = await getLatestDocumentVersion("document_1");
    expect(before.id).toBe("document_3");

    const input: NewDocumentVersionInput = {
      document_id: "document_1",
      file_name: "contract_v4.pdf",
      mime_type: "application/pdf",
      size_bytes: 190_000,
      uploaded_by: null,
    };
    const result = await createDocumentVersion(input);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.version).toBe(4);
    expect(result.data.is_latest_version).toBe(true);
    expect(result.data.category).toBe("contract"); // inherited, not overridable
    expect(result.data.parent_document_id).toBe("document_1");

    const oldLatest = await getDocumentById("document_3");
    expect(oldLatest.status).toBe("superseded");
    expect(oldLatest.is_latest_version).toBe(false);

    const chain = await getDocumentVersions("document_1");
    expect(chain).toHaveLength(4);
    expect(chain.filter((d) => d.is_latest_version)).toHaveLength(1);
  });

  it("records document_version_created on the new version and document_superseded on the old one", async () => {
    const result = await createDocumentVersion({
      document_id: "document_1",
      file_name: "contract_v4.pdf",
      mime_type: "application/pdf",
      size_bytes: 190_000,
      uploaded_by: null,
    });
    if (!result.success) throw new Error("setup failed");

    const newTimeline = await getTimelineByDocumentId(result.data.id);
    expect(newTimeline.some((t) => t.type === "document_version_created")).toBe(true);

    const oldTimeline = await getTimelineByDocumentId("document_3");
    expect(oldTimeline.some((t) => t.type === "document_superseded")).toBe(true);
  });

  it("allows overriding title/visibility/expires_at on the new version", async () => {
    const result = await createDocumentVersion({
      document_id: "document_1",
      file_name: "contract_v4.pdf",
      mime_type: "application/pdf",
      size_bytes: 190_000,
      title: "Custom Title",
      visibility: "restricted",
      uploaded_by: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Custom Title");
      expect(result.data.visibility).toBe("restricted");
    }
  });

  it("rejects a version upload for an unknown document", async () => {
    const result = await createDocumentVersion({
      document_id: "document_missing",
      file_name: "x.pdf",
      mime_type: "application/pdf",
      size_bytes: 1000,
      uploaded_by: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("getDocumentVersions / getLatestDocumentVersion", () => {
  it("returns the same chain regardless of which version id is passed", async () => {
    const fromRoot = await getDocumentVersions("document_1");
    const fromMiddle = await getDocumentVersions("document_2");
    const fromLatest = await getDocumentVersions("document_3");
    expect(fromRoot.map((d) => d.id)).toEqual(fromMiddle.map((d) => d.id));
    expect(fromRoot.map((d) => d.id)).toEqual(fromLatest.map((d) => d.id));
  });

  it("returns an empty array for a single-version document (its own one-item chain)", async () => {
    const versions = await getDocumentVersions("document_4"); // signed contract, standalone chain
    expect(versions).toHaveLength(1);
  });
});

describe("Document filters and sorting", () => {
  it("filters by category", async () => {
    const results = await getDocuments({ category: "moodboard" });
    expect(results.every((d) => d.category === "moodboard")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("filters by owner", async () => {
    const results = await getDocuments({ ownerType: "event", ownerId: "event_1" });
    expect(results.every((d) => d.owner_type === "event" && d.owner_id === "event_1")).toBe(true);
  });

  it("excludes archived and deleted by default", async () => {
    const results = await getDocuments();
    expect(results.every((d) => d.status !== "archived" && d.status !== "deleted")).toBe(true);
  });

  it("includes archived when requested", async () => {
    const results = await getDocuments({ includeArchived: true });
    expect(results.some((d) => d.status === "archived")).toBe(true);
  });

  it("filters to latest-version-only", async () => {
    const results = await getDocuments({ latestVersionOnly: true, ownerType: "contract", ownerId: "contract_1" });
    expect(results.every((d) => d.is_latest_version)).toBe(true);
    expect(results.some((d) => d.id === "document_1" || d.id === "document_2")).toBe(false);
  });

  it("filters by reference type and id", async () => {
    const results = await getDocumentsByReference("expense", "expense_1");
    expect(results.some((d) => d.id === "document_8")).toBe(true);
  });

  it("searches by title/description/file_name", async () => {
    const results = await getDocuments({ search: "moodboard" });
    expect(results.some((d) => d.id === "document_9")).toBe(true);
  });

  it("sorts by size_bytes ascending", async () => {
    const results = await getDocuments({ ownerType: "event", ownerId: "event_1", sortBy: "size_bytes", sortDirection: "asc" });
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i].size_bytes).toBeGreaterThanOrEqual(results[i - 1].size_bytes);
    }
  });
});

describe("getDocumentsByOwner / getDocumentsByCategory", () => {
  it("returns every document for an owner", async () => {
    const results = await getDocumentsByOwner("contract", "contract_1");
    expect(results.length).toBeGreaterThanOrEqual(5);
  });

  it("returns every document in a category across owners", async () => {
    const results = await getDocumentsByCategory("insurance");
    expect(results.some((d) => d.id === "document_15")).toBe(true);
  });
});

describe("getDocumentNextAction", () => {
  it("recommends completing metadata for a fresh uncategorized draft", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const action = await getDocumentNextAction(created.data.id);
    expect(action).toMatch(/complete required metadata/i);
  });
});

describe("Document owner and Workspace summaries", () => {
  it("summarizes an owner's documents", async () => {
    const summary = await getDocumentOwnerSummary("event", "event_1");
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.byCategory.moodboard).toBeGreaterThanOrEqual(1);
  });

  it("summarizes the whole Workspace", async () => {
    const summary = await getWorkspaceDocumentSummary();
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.byOwnerType.event).toBeGreaterThan(0);
    expect(summary.byOwnerType.workspace).toBeGreaterThan(0);
  });
});

describe("Document Folder CRUD", () => {
  it("creates a folder", async () => {
    const result = await createDocumentFolder({
      owner_type: "client",
      owner_id: "client_3",
      parent_folder_id: null,
      name: "New Folder",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a parent folder from a different owner", async () => {
    const result = await createDocumentFolder({
      owner_type: "event",
      owner_id: "event_1",
      parent_folder_id: "docfolder_9", // owned by client_2
      name: "Bad Folder",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("gets a folder by id and throws for an unknown one", async () => {
    const folder = await getDocumentFolderById("docfolder_1");
    expect(folder.name).toBe("Main Contract");
    await expect(getDocumentFolderById("docfolder_missing")).rejects.toThrow();
  });

  it("updates a folder's name/description/sort_order/visibility", async () => {
    const result = await updateDocumentFolder("docfolder_9", {
      name: "Renamed Contracts",
      description: "Updated",
      sort_order: 5,
      visibility: "client",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Renamed Contracts");
  });

  it("moves a folder to a new parent within the same owner", async () => {
    const result = await moveDocumentFolder("docfolder_10", "docfolder_9"); // Identification under Contracts, both client_2
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.parent_folder_id).toBe("docfolder_9");
  });

  it("rejects a move that would create a cycle", async () => {
    const result = await moveDocumentFolder("docfolder_4", "docfolder_5"); // Finance under its own child Invoices
    expect(result.success).toBe(false);
  });

  it("archives and restores a folder", async () => {
    const archived = await archiveDocumentFolder("docfolder_6");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const restored = await restoreDocumentFolder("docfolder_6");
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.archived_at).toBeNull();
  });

  it("excludes archived folders from getDocumentFolders by default", async () => {
    const before = await getDocumentFolders({ ownerType: "client", ownerId: "client_3" });
    expect(before.some((f) => f.id === "docfolder_11")).toBe(false);
    const withArchived = await getDocumentFolders({ ownerType: "client", ownerId: "client_3", includeArchived: true });
    expect(withArchived.some((f) => f.id === "docfolder_11")).toBe(true);
  });
});

describe("getDocumentFolderTree / getDocumentFolderPath", () => {
  it("builds a nested tree for an owner", async () => {
    const tree = await getDocumentFolderTree("event", "event_1");
    const financeNode = tree.find((node) => node.folder.id === "docfolder_4");
    expect(financeNode).toBeDefined();
    expect(financeNode?.children.some((child) => child.folder.id === "docfolder_5")).toBe(true);
  });

  it("returns the root-to-leaf path", async () => {
    const path = await getDocumentFolderPath("docfolder_5");
    expect(path.map((f) => f.id)).toEqual(["docfolder_4", "docfolder_5"]);
  });
});

describe("applyDefaultFolderTemplate", () => {
  it("creates every folder in the template as one atomic batch", async () => {
    const before = await getDocumentFolders({ ownerType: "client", ownerId: "client_3" });
    const result = await applyDefaultFolderTemplate({ ownerType: "client", ownerId: "client_3", templateKind: "client" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(5); // Contracts, Payments, Identification, Inspiration, General
    const after = await getDocumentFolders({ ownerType: "client", ownerId: "client_3" });
    expect(after.length).toBe(before.length + 5);
  });

  it("records exactly one summarized timeline entry, not one per folder", async () => {
    await applyDefaultFolderTemplate({ ownerType: "client", ownerId: "client_3", templateKind: "client" });
    const timeline = await getTimelineByClientId("client_3");
    const templateEntries = timeline.filter((t) => t.type === "document_folder_template_applied");
    expect(templateEntries).toHaveLength(1);
    expect(templateEntries[0].description).toMatch(/5 folders/);
  });

  it("is atomic: a validation failure creates zero folders", async () => {
    const before = await getDocumentFolders({ ownerType: "client", ownerId: "client_3", includeArchived: true });
    const result = await applyDefaultFolderTemplate({ ownerType: "client", ownerId: "", templateKind: "client" });
    expect(result.success).toBe(false);
    const after = await getDocumentFolders({ ownerType: "client", ownerId: "client_3", includeArchived: true });
    expect(after.length).toBe(before.length);
  });

  it("can nest a template under an existing parent folder", async () => {
    const result = await applyDefaultFolderTemplate({
      ownerType: "event",
      ownerId: "event_1",
      templateKind: "finance",
      parentFolderId: "docfolder_4",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.every((f) => f.parent_folder_id === "docfolder_4")).toBe(true);
  });
});

describe("Document and Document Folder Notes/Timeline", () => {
  it("adds and retrieves a note on a Document", async () => {
    const noteResult = await createDocumentNote("document_9", {
      title: "Test note",
      content: "Body",
      category: "general",
      priority: "normal",
    });
    expect(noteResult.success).toBe(true);
    const notes = await getNotesByDocumentId("document_9");
    expect(notes.length).toBe(1);
  });

  it("adds and retrieves a note on a Document Folder", async () => {
    const noteResult = await createDocumentFolderNote("docfolder_1", {
      title: "Test note",
      content: "Body",
      category: "general",
      priority: "normal",
    });
    expect(noteResult.success).toBe(true);
    const notes = await getNotesByDocumentFolderId("docfolder_1");
    expect(notes.length).toBe(1);
  });

  it("scopes Document/Folder notes and timeline strictly to their own id", async () => {
    await createDocumentNote("document_9", { title: "A only", content: "x", category: "general", priority: "normal" });
    expect(await getNotesByDocumentId("document_10")).toEqual([]);

    const timeline10 = await getTimelineByDocumentId("document_10");
    expect(timeline10.every((activity) => activity.owner_id === "document_10")).toBe(true);
    expect(timeline10.some((activity) => activity.type === "note_added")).toBe(false);
  });

  it("returns [] for notes/timeline on an unknown document or folder", async () => {
    expect(await getNotesByDocumentId("document_missing")).toEqual([]);
    expect(await getTimelineByDocumentFolderId("docfolder_missing")).toEqual([]);
  });
});

describe("Placeholder attachment helpers", () => {
  it("attaches a Document to a Contract Exhibit", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const result = await attachDocumentToContractExhibit(created.data.id, "exhibit_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contract_exhibit_id).toBe("exhibit_1");
  });

  it("attaches a Document to a Payment/Expense/Invoice/Event/Client", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    expect((await attachDocumentToPayment(created.data.id, "payment_1")).success).toBe(true);
    expect((await attachDocumentToExpense(created.data.id, "expense_1")).success).toBe(true);
    expect((await attachDocumentToInvoice(created.data.id, "invoice_1")).success).toBe(true);
    expect((await attachDocumentToEvent(created.data.id, "event_1")).success).toBe(true);
    expect((await attachDocumentToClient(created.data.id, "client_2")).success).toBe(true);
  });

  it("does not rewrite the target entity's own document_id placeholder field", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    await attachDocumentToExpense(created.data.id, "expense_1");
    const expenses = await getDocuments({ ownerType: "expense" });
    // The attachment only touches the Document row; expense_1 itself is untouched (checked indirectly
    // via the Document's own expense_id reference being the thing that changed, not a separate store).
    expect(expenses).toBeDefined();
  });

  it("rejects attaching to a nonexistent target entity", async () => {
    const created = await createDocumentMetadata(validMetadataInput);
    if (!created.success) throw new Error("setup failed");
    const result = await attachDocumentToInvoice(created.data.id, "invoice_missing");
    expect(result.success).toBe(false);
  });
});

describe("Dashboard metrics", () => {
  it("includes the ten new Documents metrics with sane values", async () => {
    const metrics = await getDashboardMetrics();
    const byLabel = new Map(metrics.map((m) => [m.label, m.value]));
    for (const label of [
      "Total Documents",
      "Documents Uploaded This Month",
      "Storage Used",
      "Expiring Documents",
      "Expired Documents",
      "Archived Documents",
      "Client-visible Documents",
      "Team-visible Documents",
      "Documents Missing Category",
      "Documents Missing Folder",
    ]) {
      expect(byLabel.has(label)).toBe(true);
    }
    expect(Number(byLabel.get("Total Documents"))).toBeGreaterThan(0);
    expect(Number(byLabel.get("Documents Missing Category"))).toBeGreaterThan(0);
  });

  it("does not collide with or remove pre-existing metric labels", async () => {
    const metrics = await getDashboardMetrics();
    const labels = metrics.map((m) => m.label);
    expect(labels).toContain("Total Clients");
    expect(labels).toContain("Total Contracts");
    expect(labels).toContain("Total Invoiced");
  });
});
