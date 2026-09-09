import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentTemplatesListView } from "@/modules/documentTemplates/components/DocumentTemplatesListView";
import type { DocumentTypeDefinition } from "@/types/documentPlatform";
import type { DocumentTemplatesListData, TemplateSummary, ComposedDocumentSummary } from "@/modules/documentTemplates/getDocumentTemplatesListData";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/modules/documentTemplates/getDocumentTemplatesListData", () => ({
  getDocumentTemplatesListData: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/createTemplateAction", () => ({
  createTemplateAction: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/searchDocumentsAction", () => ({
  searchDocumentsAction: vi.fn(),
}));

import { getDocumentTemplatesListData } from "@/modules/documentTemplates/getDocumentTemplatesListData";
import { createTemplateAction } from "@/modules/documentTemplates/createTemplateAction";

function makeDocumentType(overrides: Partial<DocumentTypeDefinition> = {}): DocumentTypeDefinition {
  return { id: "proposal", label: "Proposals", description: "", icon: "proposal", suggestedMergeFieldKeys: [], requiredPermissions: [], featureFlag: null, minimumRole: null, ...overrides };
}

function makeTemplate(overrides: Partial<TemplateSummary> = {}): TemplateSummary {
  return { id: "template_1", documentTypeId: "proposal", name: "Standard Proposal", description: "The default proposal.", status: "published", version: 1, updatedAt: "2026-08-01T00:00:00.000Z", ...overrides };
}

function makeRecentDocument(overrides: Partial<ComposedDocumentSummary> = {}): ComposedDocumentSummary {
  return { id: "document_1", templateId: "template_1", documentTypeId: "proposal", title: "Casey's Proposal", clientName: "Casey", eventTitle: null, status: "draft", currentVersion: 1, updatedAt: "2026-08-10T00:00:00.000Z", ...overrides };
}

function makeListData(overrides: Partial<DocumentTemplatesListData> = {}): DocumentTemplatesListData {
  return {
    documentTypes: [makeDocumentType()],
    templates: [makeTemplate()],
    recentDocuments: [makeRecentDocument()],
    stats: { totalTemplates: 1, publishedTemplates: 1, totalDocuments: 1, documentsThisWeek: 1 },
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("DocumentTemplatesListView", () => {
  it("does not render list content before data resolves", () => {
    vi.mocked(getDocumentTemplatesListData).mockReturnValue(new Promise(() => {}));

    render(<DocumentTemplatesListView />);

    expect(screen.queryByText("Document Templates")).not.toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", async () => {
    vi.mocked(getDocumentTemplatesListData).mockResolvedValue({ success: false, error: "boom" });

    render(<DocumentTemplatesListView />);

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders the KPI stats and templates grouped by document type", async () => {
    vi.mocked(getDocumentTemplatesListData).mockResolvedValue({ success: true, data: makeListData() });

    render(<DocumentTemplatesListView />);

    expect(await screen.findByRole("heading", { name: "Document Templates" })).toBeInTheDocument();
    expect(screen.getByText("Proposals")).toBeInTheDocument();
    expect(screen.getByText("Standard Proposal")).toBeInTheDocument();
    expect(screen.getByText("published")).toBeInTheDocument();
    expect(screen.getByText("Casey's Proposal")).toBeInTheDocument();
  });

  it("shows empty states when there are no templates or recent documents", async () => {
    vi.mocked(getDocumentTemplatesListData).mockResolvedValue({ success: true, data: makeListData({ templates: [], recentDocuments: [] }) });

    render(<DocumentTemplatesListView />);

    expect(await screen.findByText("No Templates yet")).toBeInTheDocument();
    expect(screen.getByText("No Documents generated yet.")).toBeInTheDocument();
  });

  it("renders the global search input (DocumentSearchBox)", async () => {
    vi.mocked(getDocumentTemplatesListData).mockResolvedValue({ success: true, data: makeListData() });

    render(<DocumentTemplatesListView />);
    await screen.findByRole("heading", { name: "Document Templates" });

    expect(screen.getByLabelText("Search documents")).toBeInTheDocument();
  });

  it("navigates to a recent document on click", async () => {
    vi.mocked(getDocumentTemplatesListData).mockResolvedValue({ success: true, data: makeListData() });

    render(<DocumentTemplatesListView />);
    await screen.findByText("Casey's Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: /Casey's Proposal/ }));

    expect(pushMock).toHaveBeenCalledWith("/document-templates/documents/document_1");
  });

  it("opens the New Template modal and creates a template", async () => {
    vi.mocked(getDocumentTemplatesListData).mockResolvedValue({ success: true, data: makeListData() });
    vi.mocked(createTemplateAction).mockResolvedValue({ success: true, templateId: "template_2" });

    render(<DocumentTemplatesListView />);
    await screen.findByRole("heading", { name: "Document Templates" });

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "+ New Template" }));

    const nameInput = screen.getByPlaceholderText("Template name");
    await userEvent.type(nameInput, "Follow-Up Letter");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(createTemplateAction).toHaveBeenCalledWith("proposal", "Follow-Up Letter", "");
    expect(pushMock).toHaveBeenCalledWith("/document-templates/template_2");
  });
});
