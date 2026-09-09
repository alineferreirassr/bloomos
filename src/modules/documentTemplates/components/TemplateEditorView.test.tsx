import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TemplateEditorView } from "@/modules/documentTemplates/components/TemplateEditorView";
import type { DocumentTypeDefinition, MergeFieldDefinition, Template } from "@/types/documentPlatform";
import type { TemplateEditorData } from "@/modules/documentTemplates/getTemplateEditorData";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/modules/documentTemplates/getTemplateEditorData", () => ({
  getTemplateEditorData: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/updateTemplateDraftAction", () => ({
  updateTemplateDraftAction: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/templateLifecycleActions", () => ({
  publishTemplateAction: vi.fn(),
  archiveTemplateAction: vi.fn(),
  unarchiveTemplateAction: vi.fn(),
  duplicateTemplateAction: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/validateTemplateAction", () => ({
  validateTemplateAction: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/getDocumentSuggestionsAction", () => ({
  getDocumentSuggestionsAction: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/getGenerateDocumentPickerData", () => ({
  getGenerateDocumentPickerData: vi.fn(),
}));
vi.mock("@/modules/documentTemplates/compileDocumentAction", () => ({
  compileDocumentAction: vi.fn(),
}));

import { getTemplateEditorData } from "@/modules/documentTemplates/getTemplateEditorData";
import { updateTemplateDraftAction } from "@/modules/documentTemplates/updateTemplateDraftAction";
import { publishTemplateAction, archiveTemplateAction, duplicateTemplateAction } from "@/modules/documentTemplates/templateLifecycleActions";
import { validateTemplateAction } from "@/modules/documentTemplates/validateTemplateAction";
import { getDocumentSuggestionsAction } from "@/modules/documentTemplates/getDocumentSuggestionsAction";
import { getGenerateDocumentPickerData } from "@/modules/documentTemplates/getGenerateDocumentPickerData";

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "template_1",
    workspaceId: "ws_1",
    documentTypeId: "proposal",
    name: "Standard Proposal",
    description: "The default proposal template.",
    status: "draft",
    content: [{ id: "b1", type: "paragraph", runs: [{ text: "Dear {{client.name}}," }] }],
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

function makeMergeField(overrides: Partial<MergeFieldDefinition> = {}): MergeFieldDefinition {
  return { key: "client.name", label: "Client Name", description: "The client's full name.", domain: "crm", valueType: "string", required: true, ...overrides };
}

function makeEditorData(overrides: Partial<TemplateEditorData> = {}): TemplateEditorData {
  return {
    template: makeTemplate(),
    documentType: makeDocumentType(),
    mergeFields: [makeMergeField()],
    canPublish: true,
    ...overrides,
  };
}

beforeEach(() => {
  // The editor autosaves 800ms after any name/description/content change via a real
  // setTimeout. Every test below mounts the editor (which sets its initial state from
  // the loaded template), so this default keeps any such background timer safe even
  // though no test here deliberately exercises the autosave path itself — see the
  // omission note in the checkpoint report for why a dedicated autosave test was
  // dropped (cross-test timer bleed-through proved broader than expected).
  vi.mocked(updateTemplateDraftAction).mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("TemplateEditorView", () => {
  it("does not render editor content before data resolves", () => {
    vi.mocked(getTemplateEditorData).mockReturnValue(new Promise(() => {}));

    render(<TemplateEditorView templateId="template_1" />);

    expect(screen.queryByDisplayValue("Standard Proposal")).not.toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: false, error: "boom" });

    render(<TemplateEditorView templateId="template_1" />);

    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders the ready base state: status, name, description, and primary actions", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });

    render(<TemplateEditorView templateId="template_1" />);

    expect(await screen.findByDisplayValue("Standard Proposal")).toBeInTheDocument();
    expect(screen.getByDisplayValue("The default proposal template.")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("renders merge fields in the Variables tab (transitively protects VariablesPanel)", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    expect(screen.getByText("{{client.name}}")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("The client's full name.")).toBeInTheDocument();
  });

  it("renders template content in the Preview tab", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByText("Dear {{client.name}},")).toBeInTheDocument();
  });

  it("runs validation from the Validation tab and shows the result", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });
    vi.mocked(validateTemplateAction).mockResolvedValue({ success: true, issues: [{ code: "missing_variable", target: "client.email", message: "client.email is not registered." }] });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: "Validation" }));
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    expect(validateTemplateAction).toHaveBeenCalledWith("template_1");
    expect(await screen.findByText("client.email is not registered.")).toBeInTheDocument();
  });

  it("gets suggestions from the Suggestions tab (transitively protects SuggestionsPanel)", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });
    vi.mocked(getDocumentSuggestionsAction).mockResolvedValue({
      success: true,
      suggestions: [{ templateId: "template_1", blockId: "b1", kind: "wording", reason: "This phrasing is informal.", suggestedRuns: [{ text: "Dear valued client," }] }],
    });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("tab", { name: "Suggestions" }));
    await userEvent.click(screen.getByRole("button", { name: "Get Suggestions" }));

    expect(getDocumentSuggestionsAction).toHaveBeenCalledWith("template_1");
    expect(await screen.findByText("This phrasing is informal.")).toBeInTheDocument();
  });

  it("opens the Generate Document modal and renders its picker fields (transitively protects GenerateDocumentModal)", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });
    vi.mocked(getGenerateDocumentPickerData).mockResolvedValue({ success: true, data: { clients: [{ id: "client_1", label: "Casey Smith" }], events: [] } });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Generate Document" }));

    expect(await screen.findByLabelText("Client")).toBeInTheDocument();
    expect(screen.getByLabelText("Event")).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Casey Smith" })).toBeInTheDocument();
  });

  it("publishes the template", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });
    vi.mocked(publishTemplateAction).mockResolvedValue({ success: true });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(publishTemplateAction).toHaveBeenCalledWith("template_1");
    expect(await screen.findByText("published")).toBeInTheDocument();
  });

  it("duplicates the template and navigates to the copy", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });
    vi.mocked(duplicateTemplateAction).mockResolvedValue({ success: true, templateId: "template_2" });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(duplicateTemplateAction).toHaveBeenCalledWith("template_1");
    expect(pushMock).toHaveBeenCalledWith("/document-templates/template_2");
  });

  it("archives the template and reloads", async () => {
    vi.mocked(getTemplateEditorData).mockResolvedValue({ success: true, data: makeEditorData() });
    vi.mocked(archiveTemplateAction).mockResolvedValue({ success: true });

    render(<TemplateEditorView templateId="template_1" />);
    await screen.findByDisplayValue("Standard Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(archiveTemplateAction).toHaveBeenCalledWith("template_1");
    expect(getTemplateEditorData).toHaveBeenCalledTimes(2);
  });
});
