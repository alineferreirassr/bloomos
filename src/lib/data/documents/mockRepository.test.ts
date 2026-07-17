import { afterEach, describe, expect, it } from "vitest";
import { mockDocumentsRepository } from "@/lib/data/documents/mockRepository";
import { mockMediaAssetsRepository } from "@/lib/data/media/mockRepository";
import { resetDocumentsStore, readDocuments } from "@/lib/data/mock/documentsStore";
import { resetDocumentFoldersStore, readDocumentFolders } from "@/lib/data/mock/documentFoldersStore";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { NotFoundError } from "@/core/errors";
import type { DocumentMetadataInput, NewDocumentVersionInput, DocumentFolderInput } from "@/modules/documents/schema";

afterEach(() => {
  resetDocumentsStore();
  resetDocumentFoldersStore();
  resetMediaAssetsStore();
  resetNotesStore();
  resetTimelineStore();
});

// contract_1 -> client_2, event_1; exhibit_1/invoice_1/payment_1/expense_1 all chain onto client_2/event_1/contract_1.
const BASE_METADATA_INPUT: DocumentMetadataInput = {
  owner_type: "contract",
  owner_id: "contract_1",
  folder_id: null,
  title: "Vendor Insurance Certificate",
  description: null,
  category: "insurance",
  visibility: "internal",
  media_asset_id: null,
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

async function uploadTestMediaAsset(ownerId: string, filename = "certificate.pdf") {
  const result = await mockMediaAssetsRepository.uploadMediaAsset({
    ownerType: "document",
    ownerId,
    file: new Blob(["test file contents"], { type: "application/pdf" }),
    originalFilename: filename,
  });
  if (!result.success) throw new Error(`Failed to upload test MediaAsset: ${result.error}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

describe("mockDocumentsRepository.getDocuments / getDocumentById", () => {
  it("excludes archived and deleted documents by default", async () => {
    const all = await mockDocumentsRepository.getDocuments();
    expect(all.every((d) => d.status !== "archived" && d.status !== "deleted")).toBe(true);
  });

  it("filters by ownerType/ownerId/category/status/visibility/folderId/latestVersionOnly", async () => {
    const all = await mockDocumentsRepository.getDocuments();

    const byOwner = await mockDocumentsRepository.getDocuments({ ownerType: "contract", ownerId: "contract_1" });
    expect(byOwner.every((d) => d.owner_type === "contract" && d.owner_id === "contract_1")).toBe(true);
    expect(byOwner.length).toBeGreaterThan(0);

    const byCategory = await mockDocumentsRepository.getDocuments({ category: "identification", includeArchived: true, includeDeleted: true });
    expect(byCategory.every((d) => d.category === "identification")).toBe(true);

    const latestOnly = await mockDocumentsRepository.getDocuments({ ownerType: "contract", ownerId: "contract_1", includeArchived: true, latestVersionOnly: true });
    expect(latestOnly.every((d) => d.is_latest_version)).toBe(true);

    const withArchived = await mockDocumentsRepository.getDocuments({ includeArchived: true });
    expect(withArchived.length).toBeGreaterThanOrEqual(all.length);
  });

  it("throws NotFoundError for an unknown document id", async () => {
    await expect(mockDocumentsRepository.getDocumentById("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("mockDocumentsRepository.createDocumentMetadata", () => {
  it("rejects an unknown owner", async () => {
    const result = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, owner_type: "client", owner_id: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects an event that doesn't belong to the selected client", async () => {
    const result = await mockDocumentsRepository.createDocumentMetadata({
      ...BASE_METADATA_INPUT,
      owner_type: "workspace",
      owner_id: "ws_amore_bloom",
      client_id: "client_2",
      event_id: "event_2", // event_2 belongs to client_3, not client_2
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown MediaAsset id", async () => {
    const result = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, media_asset_id: "media_missing" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.fieldErrors?.media_asset_id).toBe("MediaAsset not found.");
  });

  it("defaults a null/empty title to 'Untitled Document' and starts in draft status with version 1", async () => {
    const result = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, title: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Untitled Document");
    expect(result.data.status).toBe("draft");
    expect(result.data.version).toBe(1);
    expect(result.data.is_latest_version).toBe(true);
    expect(result.data.parent_document_id).toBeNull();
    expect(result.data.media_asset_id).toBeNull();
  });

  it("creates a document linked to a real MediaAsset and copies its derived fields", async () => {
    const asset = await uploadTestMediaAsset("pending_document");
    const result = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, media_asset_id: asset.id });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBe(asset.id);
    expect(result.data.original_file_name).toBe("certificate.pdf");
    expect(result.data.mime_type).toBe("application/pdf");
    expect(result.data.storage_provider).toBe("mock");
  });
});

describe("mockDocumentsRepository.updateDocumentMetadata", () => {
  it("fails for an unknown document", async () => {
    const result = await mockDocumentsRepository.updateDocumentMetadata("nope", {
      title: "New Title",
      description: null,
      category: "other",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank title", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.updateDocumentMetadata(created.data.id, {
      title: "   ",
      description: null,
      category: "other",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("is read-only once soft-deleted", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.softDeleteDocument(created.data.id);

    const result = await mockDocumentsRepository.updateDocumentMetadata(created.data.id, {
      title: "New Title",
      description: null,
      category: "other",
      expires_at: null,
    });
    expect(result.success).toBe(false);
  });

  it("links a MediaAsset via an optional media_asset_id and copies its derived fields", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    const asset = await uploadTestMediaAsset(created.data.id);

    const result = await mockDocumentsRepository.updateDocumentMetadata(created.data.id, {
      title: created.data.title,
      description: null,
      category: created.data.category,
      expires_at: null,
      media_asset_id: asset.id,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBe(asset.id);
    expect(result.data.original_file_name).toBe("certificate.pdf");
  });

  it("rejects an unknown MediaAsset id when attaching", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.updateDocumentMetadata(created.data.id, {
      title: created.data.title,
      description: null,
      category: created.data.category,
      expires_at: null,
      media_asset_id: "media_missing",
    });
    expect(result.success).toBe(false);
  });

  it("leaves the existing MediaAsset link untouched when media_asset_id is omitted", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    const asset = await uploadTestMediaAsset(created.data.id);
    await mockDocumentsRepository.updateDocumentMetadata(created.data.id, {
      title: created.data.title,
      description: null,
      category: created.data.category,
      expires_at: null,
      media_asset_id: asset.id,
    });

    const result = await mockDocumentsRepository.updateDocumentMetadata(created.data.id, {
      title: "Renamed",
      description: null,
      category: created.data.category,
      expires_at: null,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBe(asset.id);
  });
});

describe("mockDocumentsRepository status transitions", () => {
  it("activateDocument rejects an illegal transition", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.activateDocument(created.data.id);

    const result = await mockDocumentsRepository.activateDocument(created.data.id);
    expect(result.success).toBe(false);
  });

  it("archiveDocument stamps archived_at and restoreDocument returns to active", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.activateDocument(created.data.id);

    const archived = await mockDocumentsRepository.archiveDocument(created.data.id);
    expect(archived.success).toBe(true);
    if (!archived.success) return;
    expect(archived.data.status).toBe("archived");
    expect(archived.data.archived_at).not.toBeNull();

    const restored = await mockDocumentsRepository.restoreDocument(created.data.id);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.data.status).toBe("active");
    expect(restored.data.archived_at).toBeNull();
  });

  it("softDeleteDocument is a soft delete only — the record remains readable", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const deleted = await mockDocumentsRepository.softDeleteDocument(created.data.id);
    expect(deleted.success).toBe(true);
    if (!deleted.success) return;
    expect(deleted.data.status).toBe("deleted");
    expect(deleted.data.deleted_at).not.toBeNull();

    const fetched = await mockDocumentsRepository.getDocumentById(created.data.id);
    expect(fetched.id).toBe(created.data.id);
  });

  it("expireDocument requires the document to currently be active", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.expireDocument(created.data.id);
    expect(result.success).toBe(false);
  });

  it("updateDocumentVisibility is blocked once soft-deleted", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.softDeleteDocument(created.data.id);

    const result = await mockDocumentsRepository.updateDocumentVisibility(created.data.id, "client");
    expect(result.success).toBe(false);
  });

  it("moveDocumentToFolder rejects a folder belonging to a different owner", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, owner_type: "contract", owner_id: "contract_1" });
    if (!created.success) throw new Error("setup failed");

    // docfolder_4 belongs to event_1, not contract_1.
    const result = await mockDocumentsRepository.moveDocumentToFolder(created.data.id, "docfolder_4");
    expect(result.success).toBe(false);
  });

  it("moveDocumentToFolder succeeds into a same-owner folder and accepts null to un-file it", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, owner_type: "contract", owner_id: "contract_1" });
    if (!created.success) throw new Error("setup failed");

    const moved = await mockDocumentsRepository.moveDocumentToFolder(created.data.id, "docfolder_1");
    expect(moved.success).toBe(true);
    if (!moved.success) return;
    expect(moved.data.folder_id).toBe("docfolder_1");

    const unfiled = await mockDocumentsRepository.moveDocumentToFolder(created.data.id, null);
    expect(unfiled.success).toBe(true);
    if (!unfiled.success) return;
    expect(unfiled.data.folder_id).toBeNull();
  });
});

describe("mockDocumentsRepository.createDocumentVersion", () => {
  const NEW_VERSION_BASE: NewDocumentVersionInput = {
    document_id: "document_1",
    media_asset_id: null,
    uploaded_by: null,
  };

  it("fails for an unknown document chain", async () => {
    const result = await mockDocumentsRepository.createDocumentVersion({ ...NEW_VERSION_BASE, document_id: "nope" });
    expect(result.success).toBe(false);
  });

  it("fails when the document has been soft-deleted", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    await mockDocumentsRepository.softDeleteDocument(created.data.id);

    const result = await mockDocumentsRepository.createDocumentVersion({ ...NEW_VERSION_BASE, document_id: created.data.id });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown MediaAsset id", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.createDocumentVersion({
      ...NEW_VERSION_BASE,
      document_id: created.data.id,
      media_asset_id: "media_missing",
    });
    expect(result.success).toBe(false);
  });

  it("creates version 2, marks version 1 superseded, and inherits owner/category/references", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.createDocumentVersion({ ...NEW_VERSION_BASE, document_id: created.data.id });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.version).toBe(2);
    expect(result.data.is_latest_version).toBe(true);
    expect(result.data.status).toBe("active");
    expect(result.data.parent_document_id).toBe(created.data.id);
    expect(result.data.owner_type).toBe(created.data.owner_type);
    expect(result.data.category).toBe(created.data.category);

    const superseded = await mockDocumentsRepository.getDocumentById(created.data.id);
    expect(superseded.status).toBe("superseded");
    expect(superseded.is_latest_version).toBe(false);
  });

  it("links a new version to a MediaAsset uploaded against the chain root's id", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    const asset = await uploadTestMediaAsset(created.data.id, "certificate_v2.pdf");

    const result = await mockDocumentsRepository.createDocumentVersion({
      ...NEW_VERSION_BASE,
      document_id: created.data.id,
      media_asset_id: asset.id,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBe(asset.id);
    expect(result.data.original_file_name).toBe("certificate_v2.pdf");
  });

  it("an explicit null expires_at clears it, while an omitted expires_at inherits the prior version's", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, expires_at: "2027-01-01T00:00:00.000Z" });
    if (!created.success) throw new Error("setup failed");

    const inherited = await mockDocumentsRepository.createDocumentVersion({ ...NEW_VERSION_BASE, document_id: created.data.id });
    expect(inherited.success).toBe(true);
    if (!inherited.success) return;
    expect(inherited.data.expires_at).toBe("2027-01-01T00:00:00.000Z");

    const cleared = await mockDocumentsRepository.createDocumentVersion({ ...NEW_VERSION_BASE, document_id: inherited.data.id, expires_at: null });
    expect(cleared.success).toBe(true);
    if (!cleared.success) return;
    expect(cleared.data.expires_at).toBeNull();
  });

  it("getDocumentVersions/getLatestDocumentVersion resolve the whole chain from any version's id", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");
    const v2 = await mockDocumentsRepository.createDocumentVersion({ ...NEW_VERSION_BASE, document_id: created.data.id });
    if (!v2.success) throw new Error("setup failed");

    const versions = await mockDocumentsRepository.getDocumentVersions(created.data.id);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);

    const latest = await mockDocumentsRepository.getLatestDocumentVersion(created.data.id);
    expect(latest.id).toBe(v2.data.id);
  });
});

describe("mockDocumentsRepository lookups and summaries", () => {
  it("getDocumentsByOwner/getDocumentsByCategory/getDocumentsByReference filter correctly", async () => {
    const byOwner = await mockDocumentsRepository.getDocumentsByOwner("contract", "contract_1");
    expect(byOwner.length).toBeGreaterThan(0);
    expect(byOwner.every((d) => d.owner_type === "contract" && d.owner_id === "contract_1")).toBe(true);

    const byCategory = await mockDocumentsRepository.getDocumentsByCategory("identification");
    expect(byCategory.every((d) => d.category === "identification")).toBe(true);

    const byReference = await mockDocumentsRepository.getDocumentsByReference("contract_exhibit", "exhibit_1");
    expect(byReference.every((d) => d.contract_exhibit_id === "exhibit_1")).toBe(true);
  });

  it("getDocumentNextAction returns a recommendation for a draft with incomplete metadata", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata({ ...BASE_METADATA_INPUT, category: "other", folder_id: null });
    if (!created.success) throw new Error("setup failed");

    const action = await mockDocumentsRepository.getDocumentNextAction(created.data.id);
    expect(action).toMatch(/complete required metadata/i);
  });

  it("getDocumentOwnerSummary/getWorkspaceDocumentSummary compute over the current store", async () => {
    const ownerSummary = await mockDocumentsRepository.getDocumentOwnerSummary("contract", "contract_1");
    expect(ownerSummary.total).toBeGreaterThan(0);

    const workspaceSummary = await mockDocumentsRepository.getWorkspaceDocumentSummary();
    expect(workspaceSummary.total).toBeGreaterThan(0);
  });
});

describe("mockDocumentsRepository attachDocumentTo*", () => {
  it("attachDocumentToClient rejects an unknown client and links a real one", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const rejected = await mockDocumentsRepository.attachDocumentToClient(created.data.id, "nope");
    expect(rejected.success).toBe(false);

    const linked = await mockDocumentsRepository.attachDocumentToClient(created.data.id, "client_2");
    expect(linked.success).toBe(true);
    if (!linked.success) return;
    expect(linked.data.client_id).toBe("client_2");
  });

  it("attachDocumentToContractExhibit rejects an unknown exhibit and links a real one", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const rejected = await mockDocumentsRepository.attachDocumentToContractExhibit(created.data.id, "nope");
    expect(rejected.success).toBe(false);

    const linked = await mockDocumentsRepository.attachDocumentToContractExhibit(created.data.id, "exhibit_1");
    expect(linked.success).toBe(true);
    if (!linked.success) return;
    expect(linked.data.contract_exhibit_id).toBe("exhibit_1");
  });
});

// ---------------------------------------------------------------------------
// Document Folders
// ---------------------------------------------------------------------------

const BASE_FOLDER_INPUT: DocumentFolderInput = {
  owner_type: "client",
  owner_id: "client_1",
  parent_folder_id: null,
  name: "Contracts",
  description: null,
  sort_order: 0,
  visibility: "internal",
};

describe("mockDocumentsRepository folders CRUD", () => {
  it("getDocumentFolders excludes archived by default and filters by owner", async () => {
    const all = await mockDocumentsRepository.getDocumentFolders();
    expect(all.every((f) => f.archived_at === null)).toBe(true);

    const byOwner = await mockDocumentsRepository.getDocumentFolders({ ownerType: "contract", ownerId: "contract_1" });
    expect(byOwner.every((f) => f.owner_type === "contract" && f.owner_id === "contract_1")).toBe(true);
    expect(byOwner.length).toBeGreaterThan(0);
  });

  it("getDocumentFolderById throws NotFoundError for an unknown id", async () => {
    await expect(mockDocumentsRepository.getDocumentFolderById("nope")).rejects.toThrow(NotFoundError);
  });

  it("createDocumentFolder rejects a parent folder belonging to a different owner", async () => {
    // docfolder_1 belongs to contract_1, not client_1.
    const result = await mockDocumentsRepository.createDocumentFolder({ ...BASE_FOLDER_INPUT, parent_folder_id: "docfolder_1" });
    expect(result.success).toBe(false);
  });

  it("createDocumentFolder creates a root folder for a valid owner", async () => {
    const result = await mockDocumentsRepository.createDocumentFolder(BASE_FOLDER_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.owner_id).toBe("client_1");
    expect(result.data.archived_at).toBeNull();
  });

  it("updateDocumentFolder rejects a blank name", async () => {
    const created = await mockDocumentsRepository.createDocumentFolder(BASE_FOLDER_INPUT);
    if (!created.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.updateDocumentFolder(created.data.id, {
      name: "   ",
      description: null,
      sort_order: 0,
      visibility: "internal",
    });
    expect(result.success).toBe(false);
  });

  it("moveDocumentFolder prevents a cycle", async () => {
    const parent = await mockDocumentsRepository.createDocumentFolder(BASE_FOLDER_INPUT);
    if (!parent.success) throw new Error("setup failed");
    const child = await mockDocumentsRepository.createDocumentFolder({ ...BASE_FOLDER_INPUT, name: "Child", parent_folder_id: parent.data.id });
    if (!child.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.moveDocumentFolder(parent.data.id, child.data.id);
    expect(result.success).toBe(false);
  });

  it("moveDocumentFolder succeeds for a legal move", async () => {
    const folderA = await mockDocumentsRepository.createDocumentFolder(BASE_FOLDER_INPUT);
    if (!folderA.success) throw new Error("setup failed");
    const folderB = await mockDocumentsRepository.createDocumentFolder({ ...BASE_FOLDER_INPUT, name: "Payments" });
    if (!folderB.success) throw new Error("setup failed");

    const result = await mockDocumentsRepository.moveDocumentFolder(folderB.data.id, folderA.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.parent_folder_id).toBe(folderA.data.id);
  });

  it("archiveDocumentFolder then restoreDocumentFolder round-trips archived_at", async () => {
    const created = await mockDocumentsRepository.createDocumentFolder(BASE_FOLDER_INPUT);
    if (!created.success) throw new Error("setup failed");

    const archived = await mockDocumentsRepository.archiveDocumentFolder(created.data.id);
    expect(archived.success).toBe(true);
    if (!archived.success) return;
    expect(archived.data.archived_at).not.toBeNull();

    const doubleArchive = await mockDocumentsRepository.archiveDocumentFolder(created.data.id);
    expect(doubleArchive.success).toBe(false);

    const restored = await mockDocumentsRepository.restoreDocumentFolder(created.data.id);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.data.archived_at).toBeNull();
  });

  it("getDocumentFolderTree nests children under their parent", async () => {
    const tree = await mockDocumentsRepository.getDocumentFolderTree("event", "event_1");
    expect(tree.length).toBeGreaterThan(0);
    const withChildren = tree.find((node) => node.children.length > 0);
    expect(withChildren).toBeDefined();
  });

  it("getDocumentFolderPath returns the root-to-leaf chain", async () => {
    const path = await mockDocumentsRepository.getDocumentFolderPath("docfolder_5");
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1].id).toBe("docfolder_5");
  });
});

describe("mockDocumentsRepository.applyDefaultFolderTemplate", () => {
  it("bulk-creates every folder in the named template for the given owner, nested under an optional parent", async () => {
    const result = await mockDocumentsRepository.applyDefaultFolderTemplate({
      ownerType: "client",
      ownerId: "client_4",
      templateKind: "client",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.length).toBe(5); // client template: 5 folder names
    expect(result.data.every((f) => f.owner_type === "client" && f.owner_id === "client_4")).toBe(true);

    const stored = readDocumentFolders().filter((f) => f.owner_id === "client_4");
    expect(stored.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Notes and Timeline
// ---------------------------------------------------------------------------

describe("mockDocumentsRepository Document Notes/Timeline", () => {
  it("createDocumentNote fails for an unknown document", async () => {
    const result = await mockDocumentsRepository.createDocumentNote("nope", {
      title: "Note",
      content: "Body",
      category: "general",
      priority: "normal",
    });
    expect(result.success).toBe(false);
  });

  it("creates a note, toggles pin, and records document_created + note_added on the Timeline", async () => {
    const created = await mockDocumentsRepository.createDocumentMetadata(BASE_METADATA_INPUT);
    if (!created.success) throw new Error("setup failed");

    const note = await mockDocumentsRepository.createDocumentNote(created.data.id, {
      title: "Reviewed",
      content: "Looks good.",
      category: "general",
      priority: "normal",
    });
    expect(note.success).toBe(true);
    if (!note.success) return;

    const pinned = await mockDocumentsRepository.togglePinDocumentNote(note.data.id);
    expect(pinned).not.toBeNull();
    expect(pinned?.success).toBe(true);
    if (!pinned?.success) return;
    expect(pinned.data.is_pinned).toBe(true);

    const notes = await mockDocumentsRepository.getNotesByDocumentId(created.data.id);
    expect(notes.some((n) => n.id === note.data.id)).toBe(true);

    const timeline = await mockDocumentsRepository.getTimelineByDocumentId(created.data.id);
    expect(timeline.some((t) => t.type === "document_created")).toBe(true);
    expect(timeline.some((t) => t.type === "note_added")).toBe(true);
  });

  it("togglePinDocumentNote returns null for a note that isn't Document-owned", async () => {
    const result = await mockDocumentsRepository.togglePinDocumentNote("nope");
    expect(result).toBeNull();
  });
});

describe("mockDocumentsRepository Document Folder Notes/Timeline", () => {
  it("creates a folder note, toggles pin, and records folder Timeline activity", async () => {
    const folder = await mockDocumentsRepository.createDocumentFolder(BASE_FOLDER_INPUT);
    if (!folder.success) throw new Error("setup failed");

    const note = await mockDocumentsRepository.createDocumentFolderNote(folder.data.id, {
      title: "Filed",
      content: "Organized by category.",
      category: "general",
      priority: "normal",
    });
    expect(note.success).toBe(true);
    if (!note.success) return;

    const pinned = await mockDocumentsRepository.togglePinDocumentFolderNote(note.data.id);
    expect(pinned?.success).toBe(true);

    const notes = await mockDocumentsRepository.getNotesByDocumentFolderId(folder.data.id);
    expect(notes.some((n) => n.id === note.data.id)).toBe(true);

    const timeline = await mockDocumentsRepository.getTimelineByDocumentFolderId(folder.data.id);
    expect(timeline.some((t) => t.type === "document_folder_created")).toBe(true);
  });

  it("togglePinDocumentFolderNote returns null for a note that isn't Folder-owned", async () => {
    const result = await mockDocumentsRepository.togglePinDocumentFolderNote("nope");
    expect(result).toBeNull();
  });
});

describe("mockDocumentsRepository Workspace isolation sanity", () => {
  it("every seed document and folder belongs to the single current Workspace", async () => {
    expect(readDocuments().every((d) => d.workspace_id === "ws_amore_bloom")).toBe(true);
    expect(readDocumentFolders().every((f) => f.workspace_id === "ws_amore_bloom")).toBe(true);
  });
});
