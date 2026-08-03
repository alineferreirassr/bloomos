import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/data", () => ({
  fulfillEventServiceInventoryRequirement: vi.fn(),
}));
vi.mock("@/modules/services/hooks/useServicesPermissions", () => ({ useServicesPermissions: vi.fn() }));

import { InventorySection } from "@/modules/services/components/InventorySection";
import { fulfillEventServiceInventoryRequirement } from "@/lib/data";
import { useServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";

function requirement(overrides: Partial<EventServiceInventoryRequirement> = {}): EventServiceInventoryRequirement {
  return {
    id: "req_1",
    workspace_id: "ws",
    event_service_id: "es_1",
    inventory_item_id: null,
    item_name: "Linen tablecloths",
    quantity: 6,
    is_fulfilled: false,
    note: null,
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
  vi.mocked(useServicesPermissions).mockReturnValue({
    canEditIdentity: true,
    canEditDraftVersion: true,
    canPublish: true,
    canChangeStatus: true,
    canArchiveRestore: true,
    disabledReason: null,
  });
});

describe("InventorySection", () => {
  it("shows a no-requirements message when the assignment needs no inventory", () => {
    renderWithClient(<InventorySection eventServiceId="es_1" status="confirmed" inventory={[]} />);
    expect(screen.getByText("No inventory required for this assignment.")).toBeInTheDocument();
  });

  it("renders each requirement's item name and quantity", () => {
    renderWithClient(<InventorySection eventServiceId="es_1" status="confirmed" inventory={[requirement()]} />);
    expect(screen.getByText("Linen tablecloths")).toBeInTheDocument();
    expect(screen.getByText("Qty: 6")).toBeInTheDocument();
  });

  it("marks a requirement fulfilled via the reused mutation, never a new endpoint", async () => {
    const user = userEvent.setup();
    vi.mocked(fulfillEventServiceInventoryRequirement).mockResolvedValue({ success: true, data: {} } as never);
    renderWithClient(<InventorySection eventServiceId="es_1" status="confirmed" inventory={[requirement({ id: "req_9" })]} />);

    await user.click(screen.getByRole("button", { name: "Mark fulfilled" }));
    await waitFor(() => expect(fulfillEventServiceInventoryRequirement).toHaveBeenCalledWith("req_9"));
  });

  it("shows 'Fulfilled' and no action once a requirement is resolved", () => {
    renderWithClient(<InventorySection eventServiceId="es_1" status="confirmed" inventory={[requirement({ is_fulfilled: true })]} />);
    expect(screen.getByText("Fulfilled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark fulfilled" })).not.toBeInTheDocument();
  });

  it("hides the fulfill action once the assignment reaches a terminal status", () => {
    renderWithClient(<InventorySection eventServiceId="es_1" status="completed" inventory={[requirement()]} />);
    expect(screen.queryByRole("button", { name: "Mark fulfilled" })).not.toBeInTheDocument();
  });
});
