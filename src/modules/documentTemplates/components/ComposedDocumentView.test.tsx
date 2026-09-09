import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComposedDocumentView } from "@/modules/documentTemplates/components/ComposedDocumentView";
import type { ComposedDocument, ComposedDocumentVersion, DocumentTypeDefinition, Template } from "@/types/documentPlatform";
import type { ComposedDocumentViewData } from "@/modules/documentTemplates/getComposedDocumentViewData";

vi.mock("@/modules/documentTemplates/getComposedDocumentViewData", () => ({
  getComposedDocumentViewData: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/documentLifecycleActions", () => ({
  publishDocumentVersionAction: vi.fn(),
  archiveDocumentAction: vi.fn(),
  unarchiveDocumentAction: vi.fn(),
  restoreDocumentVersionAction: vi.fn(),
  duplicateDocumentAction: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/logDocumentDownloadAction", () => ({
  logDocumentDownloadAction: vi.fn(),
}));

import { getComposedDocumentViewData } from "@/modules/documentTemplates/getComposedDocumentViewData";
import {
  publishDocumentVersionAction,
  archiveDocumentAction,
  restoreDocumentVersionAction,
  duplicateDocumentAction,
} from "@/modules/documentTemplates/documentLifecycleActions";

function makeDocument(overrides: Partial<ComposedDocument> = {}): ComposedDocument {
  return {
    id: "document_1",
    workspaceId: "ws_1",
    templateId: "template_1",
    documentTypeId: "proposal",
    status: "draft",
    content: [{ id: "b1", type: "paragraph", runs: [{ text: "Dear Casey," }] }],
    mergeContext: { workspaceId: "ws_1", memberId: "member_1" },
    metadata: { title: "Casey's Proposal", description: "", tags: [], clientName: "Casey", eventTitle: null },
    currentVersion: 1,
    createdBy: "member_1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "template_1",
    workspaceId: "ws_1",
    documentTypeId: "proposal",
    name: "Standard Proposal",
    description: "",
    status: "published",
    content: [],
    header: [],
    footer: [],
    variables: [],
    version: 1,
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    createdBy: "member_1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeDocumentType(overrides: Partial<DocumentTypeDefinition> = {}): DocumentTypeDefinition {
  return { id: "proposal", label: "Proposal", description: "", icon: "proposal", suggestedMergeFieldKeys: [], requiredPermissions: [], featureFlag: null, minimumRole: null, ...overrides };
}

function makeVersion(overrides: Partial<ComposedDocumentVersion> = {}): ComposedDocumentVersion {
  return {
    id: "version_1",
    documentId: "document_1",
    version: 1,
    content: [],
    metadata: { title: "Casey's Proposal", description: "", tags: [], clientName: "Casey", eventTitle: null },
    compiledBy: "member_1",
    compiledAt: "2026-08-10T00:00:00.000Z",
    label: null,
    ...overrides,
  };
}

function makeViewData(overrides: Partial<ComposedDocumentViewData> = {}): ComposedDocumentViewData {
  return {
    document: makeDocument(),
    template: makeTemplate(),
    documentType: makeDocumentType(),
    versions: [],
    canPublish: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ComposedDocumentView", () => {
  it("does not render document content before data resolves", () => {
    vi.mocked(getComposedDocumentViewData).mockReturnValue(new Promise(() => {}));

    render(<ComposedDocumentView documentId="document_1" />);

    expect(screen.queryByText("Casey's Proposal")).not.toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: false, error: "boom" });

    render(<ComposedDocumentView documentId="document_1" />);

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders the populated document: status, template link, and empty version history", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: true, data: makeViewData() });

    render(<ComposedDocumentView documentId="document_1" />);

    expect(await screen.findByText("Casey's Proposal")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
    const templateLink = screen.getByRole("link", { name: "Standard Proposal" });
    expect(templateLink).toHaveAttribute("href", "/document-templates/template_1");
    expect(screen.getByText(/still a draft/)).toBeInTheDocument();
    expect(screen.getByText("Dear Casey,")).toBeInTheDocument();
  });

  it("renders a populated version list", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: true, data: makeViewData({ versions: [makeVersion({ version: 2, label: "Sent to client" })] }) });

    render(<ComposedDocumentView documentId="document_1" />);

    expect(await screen.findByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Sent to client")).toBeInTheDocument();
  });

  it("publishes a new version and refetches", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: true, data: makeViewData() });
    vi.mocked(publishDocumentVersionAction).mockResolvedValue({ success: true });

    render(<ComposedDocumentView documentId="document_1" />);
    await screen.findByText("Casey's Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Publish New Version" }));

    expect(publishDocumentVersionAction).toHaveBeenCalledWith("document_1", null);
    expect(getComposedDocumentViewData).toHaveBeenCalledTimes(2);
  });

  it("duplicates the document", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: true, data: makeViewData() });
    vi.mocked(duplicateDocumentAction).mockResolvedValue({ success: true, documentId: "document_2" });

    render(<ComposedDocumentView documentId="document_1" />);
    await screen.findByText("Casey's Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(duplicateDocumentAction).toHaveBeenCalledWith("document_1");
  });

  it("archives the document and refetches", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: true, data: makeViewData({ document: makeDocument({ status: "published" }) }) });
    vi.mocked(archiveDocumentAction).mockResolvedValue({ success: true });

    render(<ComposedDocumentView documentId="document_1" />);
    await screen.findByText("Casey's Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(archiveDocumentAction).toHaveBeenCalledWith("document_1");
    expect(getComposedDocumentViewData).toHaveBeenCalledTimes(2);
  });

  it("restores a prior version and refetches", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: true, data: makeViewData({ versions: [makeVersion({ version: 1 })] }) });
    vi.mocked(restoreDocumentVersionAction).mockResolvedValue({ success: true });

    render(<ComposedDocumentView documentId="document_1" />);
    await screen.findByText("Version 1");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(restoreDocumentVersionAction).toHaveBeenCalledWith("document_1", 1);
    expect(getComposedDocumentViewData).toHaveBeenCalledTimes(2);
  });

  it("shows a toast when publishing fails", async () => {
    vi.mocked(getComposedDocumentViewData).mockResolvedValue({ success: true, data: makeViewData() });
    vi.mocked(publishDocumentVersionAction).mockResolvedValue({ success: false, error: "Cannot publish an empty document." });

    render(<ComposedDocumentView documentId="document_1" />);
    await screen.findByText("Casey's Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Publish New Version" }));

    expect(await screen.findByText("Cannot publish an empty document.")).toBeInTheDocument();
  });
});
