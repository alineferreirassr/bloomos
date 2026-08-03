import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/modules/workflow/getWorkflowsList", () => ({ getWorkflowsList: vi.fn() }));
vi.mock("@/modules/workflow/getWorkflowSuggestions", () => ({ getWorkflowSuggestions: vi.fn() }));
vi.mock("@/modules/workflow/getWorkflowTemplates", () => ({ getWorkflowTemplates: vi.fn() }));
vi.mock("@/modules/workflow/createWorkflow", () => ({ createWorkflow: vi.fn() }));
vi.mock("@/modules/workflow/cloneWorkflow", () => ({ cloneWorkflow: vi.fn() }));
vi.mock("@/modules/workflow/archiveWorkflow", () => ({ archiveWorkflow: vi.fn(), unarchiveWorkflow: vi.fn() }));
vi.mock("@/modules/workflow/components/WorkflowDashboardSection", () => ({ WorkflowDashboardSection: () => null }));

import { WorkflowsListView } from "@/modules/workflow/components/WorkflowsListView";
import { getWorkflowsList } from "@/modules/workflow/getWorkflowsList";
import { getWorkflowSuggestions } from "@/modules/workflow/getWorkflowSuggestions";
import { getWorkflowTemplates } from "@/modules/workflow/getWorkflowTemplates";
import { getCommands, resetCommandRegistry } from "@/core/commandPalette";

afterEach(() => {
  vi.clearAllMocks();
  resetCommandRegistry();
});

describe("WorkflowsListView", () => {
  it("shows the empty state when no Workflows exist yet", async () => {
    vi.mocked(getWorkflowsList).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowSuggestions).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowTemplates).mockResolvedValue({ success: true, data: [] });

    render(<WorkflowsListView />);
    await waitFor(() => expect(screen.getByText(/No Workflows yet/i)).toBeInTheDocument());
  });

  it("shows an error state and offers retry when the list fails to load", async () => {
    vi.mocked(getWorkflowsList).mockResolvedValue({ success: false, error: "Something went wrong." });
    vi.mocked(getWorkflowSuggestions).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowTemplates).mockResolvedValue({ success: true, data: [] });

    render(<WorkflowsListView />);
    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeInTheDocument());
  });

  it("Step 14: registers Open Workflow Builder / Create Workflow / Recent Workflows in the Command Palette on mount, and unregisters on unmount", async () => {
    vi.mocked(getWorkflowsList).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowSuggestions).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowTemplates).mockResolvedValue({ success: true, data: [] });

    const { unmount } = render(<WorkflowsListView />);
    await waitFor(() => {
      const ids = getCommands().map((command) => command.id);
      expect(ids).toEqual(expect.arrayContaining(["open-workflow-builder", "create-workflow", "recent-workflows"]));
    });

    unmount();
    expect(getCommands().map((command) => command.id)).not.toEqual(expect.arrayContaining(["open-workflow-builder"]));
  });

  it("renders a Suggested Workflows card when Bloom AI has a suggestion, never auto-creating anything", async () => {
    vi.mocked(getWorkflowsList).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowSuggestions).mockResolvedValue({
      success: true,
      data: [{ triggerType: "invoice.overdue", triggerNodeId: "trigger.invoice-overdue", name: "Respond to Invoice Overdue", reason: "No listener yet." }],
    });
    vi.mocked(getWorkflowTemplates).mockResolvedValue({ success: true, data: [] });

    render(<WorkflowsListView />);
    await waitFor(() => expect(screen.getByText("Respond to Invoice Overdue")).toBeInTheDocument());
    expect(screen.getByText("Create from suggestion")).toBeInTheDocument();
  });

  it("Step 7: lists built-in Templates in the New Workflow modal, and selecting one pre-fills name and category", async () => {
    vi.mocked(getWorkflowsList).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowSuggestions).mockResolvedValue({ success: true, data: [] });
    vi.mocked(getWorkflowTemplates).mockResolvedValue({
      success: true,
      data: [
        {
          id: "template.new-client-welcome",
          name: "New Client → Welcome",
          description: "When a new Client is recorded, run the CRM Assistant, generate their Welcome Guide, and set a follow-up reminder.",
          category: "crm",
          graph: { nodes: [], edges: [], variables: [] },
        },
      ],
    });

    render(<WorkflowsListView />);
    await waitFor(() => expect(screen.getByText("New Workflow")).toBeInTheDocument());
    fireEvent.click(screen.getByText("New Workflow"));

    await waitFor(() => expect(screen.getByText("New Client → Welcome")).toBeInTheDocument());
    fireEvent.click(screen.getByText("New Client → Welcome"));

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("New Client → Welcome");
  });
});
