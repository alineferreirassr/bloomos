import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/services/hooks/useServiceAssignments", () => ({ useServiceAssignments: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceWorkspace", () => ({ useEventServiceWorkspace: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceOverrideMutations", () => ({ useUpdateEventServiceOverrides: vi.fn() }));

import { ServiceAssignmentsPage } from "@/modules/services/components/ServiceAssignmentsPage";
import { useServiceAssignments } from "@/modules/services/hooks/useServiceAssignments";
import { useEventServiceWorkspace } from "@/modules/services/hooks/useEventServiceWorkspace";
import { useUpdateEventServiceOverrides } from "@/modules/services/hooks/useEventServiceOverrideMutations";
import { makeService, makeEventService, makeEvent, makeClient } from "@/modules/services/testUtils";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";
import type { EventServiceWorkspaceData } from "@/lib/queries/services/types";

function makeWorkspace(overrides: Partial<EventServiceWorkspaceData> = {}): EventServiceWorkspaceData {
  return {
    eventService: makeEventService(),
    event: makeEvent(),
    client: makeClient(),
    version: { id: "version_1" } as never,
    isNameOverridden: false,
    isPriceOverridden: false,
    requirements: {
      inventory: [],
      purchase: [],
      budget: [],
      team: [{ id: "team_1", workspace_id: "workspace_1", event_service_id: "es_1", role_label: "Coordinator", quantity: 1, note: null, assigned_member_id: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
      vendor: [],
    },
    fulfillmentSummary: { resolved: 1, total: 1 },
    questionnaire: [],
    notes: [],
    timeline: [],
    ...overrides,
  };
}

// Deliberately far in the future/past of any real test run, so "Upcoming"/"Past"
// classification is deterministic without needing to fake the system clock
// (which fights userEvent's own internal timers).
const upcomingRow: ServiceAssignmentRow = {
  eventService: makeEventService({ id: "es_1", event_id: "event_1", status: "confirmed" }),
  event: makeEvent({ id: "event_1", title: "Amelia & Noah's Wedding", client_id: "client_1", event_date: "2099-06-15", status: "confirmed" }),
  client: makeClient({ id: "client_1", first_name: "Amelia", last_name: "Carter" }),
  versionNumber: 1,
  isNameOverridden: false,
  isPriceOverridden: false,
  team: { resolved: 1, total: 2 },
  completion: { resolved: 3, total: 4 },
};

const pastRow: ServiceAssignmentRow = {
  eventService: makeEventService({ id: "es_2", event_id: "event_2", status: "cancelled", name: "Custom Name", name_template_value: "Live Music" }),
  event: makeEvent({ id: "event_2", title: "Liam's Birthday", client_id: "client_2", event_date: "2020-01-01", status: "completed" }),
  client: makeClient({ id: "client_2", first_name: "Liam", last_name: "Chen" }),
  versionNumber: 2,
  isNameOverridden: true,
  isPriceOverridden: false,
  team: { resolved: 0, total: 0 },
  completion: { resolved: 4, total: 4 },
};

// A row belonging to an archived Event — hidden by default, revealed only via
// the "Show archived events" checkbox, mirroring the includeArchived
// convention used across every other module's filter bar.
const archivedRow: ServiceAssignmentRow = {
  eventService: makeEventService({ id: "es_3", event_id: "event_3", status: "confirmed" }),
  event: makeEvent({ id: "event_3", title: "Noah's Anniversary", client_id: "client_3", event_date: "2019-01-01", status: "archived" }),
  client: makeClient({ id: "client_3", first_name: "Noah", last_name: "Diaz" }),
  versionNumber: 1,
  isNameOverridden: false,
  isPriceOverridden: false,
  team: { resolved: 1, total: 1 },
  completion: { resolved: 1, total: 1 },
};

const rows = [upcomingRow, pastRow];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "success", data: makeWorkspace(), refetch: vi.fn() } as never);
  vi.mocked(useUpdateEventServiceOverrides).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false, isError: false } as never);
});

describe("ServiceAssignmentsPage", () => {
  it("shows a loading state while pending", () => {
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
    const { container } = render(<ServiceAssignmentsPage serviceId="service_1" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows an error state with retry wired to refetch", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "error", data: undefined, error: new Error("boom"), refetch } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    expect(screen.getByText(/couldn't load this Service's assignments/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty state when there are no assignment rows", () => {
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows: [] }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    expect(screen.getByText("No assignments yet")).toBeInTheDocument();
  });

  it("renders every row with its Event, Client, and status badge", () => {
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    const table = screen.getByRole("table");
    expect(screen.getByText("Amelia & Noah's Wedding")).toBeInTheDocument();
    expect(screen.getByText("Liam's Birthday")).toBeInTheDocument();
    expect(screen.getByText("Amelia Carter")).toBeInTheDocument();
    expect(within(table).getByText("Confirmed")).toBeInTheDocument();
    expect(within(table).getByText("Cancelled")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "cancelled");
    expect(screen.queryByText("Amelia & Noah's Wedding")).not.toBeInTheDocument();
    expect(screen.getByText("Liam's Birthday")).toBeInTheDocument();
  });

  it("filters by search across Event title and Client name", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    await user.type(screen.getByRole("textbox", { name: "Search assignments" }), "Chen");
    expect(screen.queryByText("Amelia & Noah's Wedding")).not.toBeInTheDocument();
    expect(screen.getByText("Liam's Birthday")).toBeInTheDocument();
  });

  it("shows a clear-filters affordance when filters match nothing", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    await user.type(screen.getByRole("textbox", { name: "Search assignments" }), "nonexistent");
    expect(screen.getByText("No assignments match the current filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Amelia & Noah's Wedding")).toBeInTheDocument();
  });

  it("selecting a row opens the detail panel, showing summary immediately and team/timeline once the lazy workspace resolves", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    await user.click(screen.getByRole("button", { name: "Amelia & Noah's Wedding" }));
    expect(screen.getByRole("status")).toHaveTextContent("Viewing Amelia & Noah's Wedding.");
    expect(screen.getByRole("heading", { name: "Overrides" })).toBeInTheDocument();
    expect(screen.getByText("Coordinator × 1")).toBeInTheDocument();
  });

  it("renders override state, including the overridden name and its template value", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    await user.click(screen.getByRole("button", { name: "Liam's Birthday" }));
    expect(screen.getByText("Name (overridden)")).toBeInTheDocument();
    expect(screen.getByText("Template: Live Music")).toBeInTheDocument();
    // A cancelled assignment can no longer be overridden — no Edit affordance.
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("shows an Edit affordance for a non-terminal assignment, and never renders a Publish/Archive action anywhere", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    await user.click(screen.getByRole("button", { name: "Amelia & Noah's Wedding" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Archive/ })).not.toBeInTheDocument();
  });

  it("renders the sidebar's timing/event/version-usage summaries from the full unfiltered set", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    // Filter down to one row — the sidebar must still report totals across both.
    await user.type(screen.getByRole("textbox", { name: "Search assignments" }), "Amelia");
    expect(screen.getByText("Upcoming assignments")).toBeInTheDocument();
    const upcoming = screen.getByText("Upcoming assignments").nextElementSibling;
    expect(upcoming).toHaveTextContent("1");
    const past = screen.getByText("Past assignments").nextElementSibling;
    expect(past).toHaveTextContent("1");
    expect(screen.getByText("Active assignments")).toBeInTheDocument();
    const active = screen.getByText("Active assignments").nextElementSibling;
    expect(active).toHaveTextContent("1");
    const cancelled = screen.getByText("Cancelled assignments").nextElementSibling;
    expect(cancelled).toHaveTextContent("1");
  });

  it("hides an archived Event's assignment by default, and reveals it via the archived checkbox", async () => {
    const user = userEvent.setup();
    const rowsWithArchived = [...rows, archivedRow];
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows: rowsWithArchived }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    expect(screen.queryByText("Noah's Anniversary")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Show archived events" }));
    expect(screen.getByText("Noah's Anniversary")).toBeInTheDocument();
  });

  it("sidebar quick filters update the visible rows", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    const sidebarQuickFilters = screen.getByText("Quick filters").parentElement as HTMLElement;
    await user.click(within(sidebarQuickFilters).getByRole("button", { name: "Past" }));
    expect(screen.queryByText("Amelia & Noah's Wedding")).not.toBeInTheDocument();
    expect(screen.getByText("Liam's Birthday")).toBeInTheDocument();
  });

  it("exposes each row's action menu accessibly", () => {
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    expect(screen.getAllByRole("button", { name: "Item actions" })).toHaveLength(2);
  });

  it("exposes completion as a real progressbar per row", () => {
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThanOrEqual(2);
  });

  it("supports keyboard activation of a row (native button semantics — Enter triggers selection)", async () => {
    const user = userEvent.setup();
    vi.mocked(useServiceAssignments).mockReturnValue({ status: "success", data: { service: makeService(), rows }, refetch: vi.fn() } as never);
    render(<ServiceAssignmentsPage serviceId="service_1" />);
    const eventButton = screen.getByRole("button", { name: "Amelia & Noah's Wedding" });
    eventButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Viewing Amelia & Noah's Wedding.");
  });
});
