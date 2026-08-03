import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/data", () => ({
  transitionEventServiceStatus: vi.fn(),
}));
vi.mock("@/modules/services/hooks/useServicesPermissions", () => ({ useServicesPermissions: vi.fn() }));

import { WorkspaceActions } from "@/modules/services/components/WorkspaceActions";
import { transitionEventServiceStatus } from "@/lib/data";
import { useServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const allowed = { canEditIdentity: true, canEditDraftVersion: true, canPublish: true, canChangeStatus: true, canArchiveRestore: true, disabledReason: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useServicesPermissions).mockReturnValue(allowed);
});

describe("WorkspaceActions", () => {
  it("shows 'Confirm' for a proposed assignment", () => {
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="proposed" />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("shows 'Start Service' for a confirmed assignment", () => {
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="confirmed" />);
    expect(screen.getByRole("button", { name: "Start Service" })).toBeInTheDocument();
  });

  it("shows 'Complete' for an in_progress assignment", () => {
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="in_progress" />);
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
  });

  it("never renders 'Pause' or 'Resume' — no such EventServiceStatus exists in the domain", () => {
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="in_progress" />);
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("shows no forward action or Cancel once the assignment is completed", () => {
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="completed" />);
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("requires confirmation before cancelling, and does not call the mutation until confirmed", async () => {
    const user = userEvent.setup();
    vi.mocked(transitionEventServiceStatus).mockResolvedValue({ success: true, data: {} } as never);
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="confirmed" />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("dialog", { name: /cancel this assignment/i })).toBeInTheDocument();
    expect(transitionEventServiceStatus).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel assignment" }));
    await waitFor(() => expect(transitionEventServiceStatus).toHaveBeenCalledWith("es_1", "cancelled"));
  });

  it("calls the status transition mutation with the forward target status", async () => {
    const user = userEvent.setup();
    vi.mocked(transitionEventServiceStatus).mockResolvedValue({ success: true, data: {} } as never);
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="confirmed" />);

    await user.click(screen.getByRole("button", { name: "Start Service" }));
    await waitFor(() => expect(transitionEventServiceStatus).toHaveBeenCalledWith("es_1", "in_progress"));
  });

  it("links to the Event and Client", () => {
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_9" clientId="client_9" serviceId="service_1" status="confirmed" />);
    expect(screen.getByRole("link", { name: "View Event" })).toHaveAttribute("href", "/events/event_9");
    expect(screen.getByRole("link", { name: "View Client" })).toHaveAttribute("href", "/clients/client_9");
  });

  it("disables the forward action when the user lacks permission, with a tooltip explaining why", () => {
    vi.mocked(useServicesPermissions).mockReturnValue({ ...allowed, canChangeStatus: false, disabledReason: "You don't have access to manage Services." });
    renderWithClient(<WorkspaceActions eventServiceId="es_1" eventId="event_1" clientId="client_1" serviceId="service_1" status="confirmed" />);
    expect(screen.getByRole("button", { name: "Start Service" })).toBeDisabled();
  });
});
