import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/data", () => ({
  updateChecklistItemStatus: vi.fn(),
}));

import { TemplateExecutionSection } from "@/modules/services/components/TemplateExecutionSection";
import { updateChecklistItemStatus } from "@/lib/data";
import type { ChecklistItem } from "@/types/checklistItem";

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "item_1",
    workspace_id: "ws",
    owner_type: "event",
    owner_id: "event_1",
    title: "Confirm florals",
    description: null,
    category: "flowers",
    priority: "normal",
    status: "pending",
    due_date: null,
    completed_at: null,
    assigned_type: "unknown",
    assigned_id: null,
    assigned_name: null,
    sort_order: 0,
    source_event_service_id: "es_1",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TemplateExecutionSection", () => {
  it("shows an empty message when this EventService generated no checklist items", () => {
    renderWithClient(<TemplateExecutionSection eventServiceId="es_1" status="confirmed" checklistItems={[]} />);
    expect(screen.getByText("This assignment generated no checklist items.")).toBeInTheDocument();
  });

  it("groups items by category with a per-category resolved count", () => {
    renderWithClient(
      <TemplateExecutionSection
        eventServiceId="es_1"
        status="confirmed"
        checklistItems={[
          item({ id: "i1", category: "flowers", status: "completed" }),
          item({ id: "i2", category: "venue", status: "pending", title: "Confirm venue access" }),
        ]}
      />,
    );
    expect(screen.getByText("Flowers")).toBeInTheDocument();
    expect(screen.getByText("Venue")).toBeInTheDocument();
    expect(screen.getByText("Confirm florals")).toBeInTheDocument();
    expect(screen.getByText("Confirm venue access")).toBeInTheDocument();
  });

  it("offers a status action menu with only the transitions valid from the item's current status", async () => {
    const user = userEvent.setup();
    renderWithClient(<TemplateExecutionSection eventServiceId="es_1" status="confirmed" checklistItems={[item({ status: "pending" })]} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    expect(screen.getByText("Mark in progress")).toBeInTheDocument();
    expect(screen.getByText("Mark blocked")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Mark skipped")).toBeInTheDocument();
    expect(screen.queryByText("Reopen")).not.toBeInTheDocument();
  });

  it("labels the 'skipped' action but calls the real underlying cancelled status, reusing the existing enum value", async () => {
    const user = userEvent.setup();
    vi.mocked(updateChecklistItemStatus).mockResolvedValue({ success: true, data: item({ status: "cancelled" }) } as never);
    renderWithClient(<TemplateExecutionSection eventServiceId="es_1" status="confirmed" checklistItems={[item({ id: "item_1", status: "pending" })]} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByText("Mark skipped"));

    await waitFor(() => expect(updateChecklistItemStatus).toHaveBeenCalledWith("item_1", "cancelled"));
  });

  it("offers Reopen once an item reaches a resolved or blocked status", async () => {
    const user = userEvent.setup();
    renderWithClient(<TemplateExecutionSection eventServiceId="es_1" status="confirmed" checklistItems={[item({ status: "completed" })]} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    expect(screen.getByText("Reopen")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("hides every action menu once the assignment reaches a terminal status (read-only, matching canOverrideEventService)", () => {
    renderWithClient(<TemplateExecutionSection eventServiceId="es_1" status="completed" checklistItems={[item({ status: "pending" })]} />);
    expect(screen.queryByRole("button", { name: "Item actions" })).not.toBeInTheDocument();
  });

  it("hides every action menu when the assignment is cancelled", () => {
    renderWithClient(<TemplateExecutionSection eventServiceId="es_1" status="cancelled" checklistItems={[item({ status: "pending" })]} />);
    expect(screen.queryByRole("button", { name: "Item actions" })).not.toBeInTheDocument();
  });
});
