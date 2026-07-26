import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/services/service_1/assignments/es_1",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/modules/services/hooks/useEventServiceWorkspace", () => ({ useEventServiceWorkspace: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceChecklist", () => ({ useEventServiceChecklist: vi.fn() }));
vi.mock("@/modules/services/hooks/useServicesPermissions", () => ({ useServicesPermissions: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventAssignmentMutations", () => ({ useTransitionEventServiceStatus: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceOverrideMutations", () => ({ useUpdateEventServiceOverrides: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceRequirementMutations", () => ({ useFulfillEventServiceInventoryRequirement: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceNoteMutations", () => ({ useEventServiceNoteMutations: vi.fn() }));
vi.mock("@/modules/services/hooks/useUpdateChecklistItemStatus", () => ({ useUpdateChecklistItemStatus: vi.fn() }));
vi.mock("@/lib/data", () => ({ getMediaAssetsByOwner: vi.fn() }));

import { EventServiceWorkspace } from "@/modules/services/components/EventServiceWorkspace";
import { useEventServiceWorkspace } from "@/modules/services/hooks/useEventServiceWorkspace";
import { useEventServiceChecklist } from "@/modules/services/hooks/useEventServiceChecklist";
import { useServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import { useTransitionEventServiceStatus } from "@/modules/services/hooks/useEventAssignmentMutations";
import { useUpdateEventServiceOverrides } from "@/modules/services/hooks/useEventServiceOverrideMutations";
import { useFulfillEventServiceInventoryRequirement } from "@/modules/services/hooks/useEventServiceRequirementMutations";
import { useEventServiceNoteMutations } from "@/modules/services/hooks/useEventServiceNoteMutations";
import { useUpdateChecklistItemStatus } from "@/modules/services/hooks/useUpdateChecklistItemStatus";
import { getMediaAssetsByOwner } from "@/lib/data";
import { NotFoundError } from "@/core/errors";
import { makeEventService, makeEvent, makeClient } from "@/modules/services/testUtils";
import type { EventServiceWorkspaceData } from "@/lib/queries/services/types";

function mockMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false, isSuccess: false, isError: false, ...overrides };
}

function makeWorkspaceData(overrides: Partial<EventServiceWorkspaceData> = {}): EventServiceWorkspaceData {
  return {
    eventService: makeEventService({ status: "confirmed" }),
    event: makeEvent({ title: "Amelia & Noah's Wedding", event_date: "2026-06-15" }),
    client: makeClient({ first_name: "Amelia", last_name: "Carter" }),
    version: {
      id: "version_1",
      service_id: "service_1",
      workspace_id: "ws",
      version_number: 2,
      status: "published",
      name_snapshot: "Photography",
      description_snapshot: null,
      base_price_minor: 100000,
      currency: "USD",
      setup_duration_minutes: null,
      breakdown_duration_minutes: null,
      difficulty_score: null,
      experience_level_required: null,
      weather_sensitivity: "none",
      surprise_friendly: false,
      estimated_profit_minor: null,
      change_summary: null,
      published_at: "2026-01-01T00:00:00.000Z",
      published_by: "owner",
      created_at: "",
      updated_at: "",
    },
    isNameOverridden: false,
    isPriceOverridden: false,
    requirements: { inventory: [], purchase: [], budget: [], team: [], vendor: [] },
    fulfillmentSummary: { resolved: 0, total: 0 },
    questionnaire: [],
    notes: [],
    timeline: [],
    ...overrides,
  };
}

const allowedPermissions = { canEditIdentity: true, canEditDraftVersion: true, canPublish: true, canChangeStatus: true, canArchiveRestore: true, disabledReason: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  vi.mocked(useServicesPermissions).mockReturnValue(allowedPermissions);
  vi.mocked(useTransitionEventServiceStatus).mockReturnValue(mockMutation() as never);
  vi.mocked(useUpdateEventServiceOverrides).mockReturnValue(mockMutation() as never);
  vi.mocked(useFulfillEventServiceInventoryRequirement).mockReturnValue(mockMutation() as never);
  vi.mocked(useEventServiceNoteMutations).mockReturnValue({ createNote: mockMutation(), updateNote: mockMutation(), togglePin: mockMutation() } as never);
  vi.mocked(useUpdateChecklistItemStatus).mockReturnValue(mockMutation() as never);
  vi.mocked(useEventServiceChecklist).mockReturnValue({ status: "success", data: [] } as never);
  vi.mocked(getMediaAssetsByOwner).mockResolvedValue([]);
});

describe("EventServiceWorkspace", () => {
  it("shows a loading state while the workspace query is pending", () => {
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
    const { container } = render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows a not-found message when the assignment doesn't exist", () => {
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "error", error: new NotFoundError("EventService es_1 not found."), data: undefined, refetch: vi.fn() } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);
    expect(screen.getByText(/doesn't exist, or has been permanently removed/)).toBeInTheDocument();
  });

  it("shows a generic error state with retry for an unexpected failure", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "error", error: new Error("boom"), data: undefined, refetch } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);
    expect(screen.getByText(/couldn't load this assignment's workspace/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders the header, actions, and default Overview tab once the workspace resolves", () => {
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "success", data: makeWorkspaceData(), refetch: vi.fn() } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);

    expect(screen.getByRole("heading", { level: 2, name: "Amelia & Noah's Wedding" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Viewing workspace for Amelia & Noah's Wedding.");
    expect(screen.getByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Client" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Service version" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overrides" })).toBeInTheDocument();
  });

  it("navigates to the Execution tab's URL when clicked (tab selection is URL-driven, mirroring ServiceDetailPage's own ?tab= pattern)", async () => {
    const user = userEvent.setup();
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "success", data: makeWorkspaceData(), refetch: vi.fn() } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);

    await user.click(screen.getByRole("tab", { name: "Execution" }));
    expect(push).toHaveBeenCalledWith("/services/service_1/assignments/es_1?section=execution", { scroll: false });
  });

  it("renders Progress and Template execution when the URL selects the Execution section", () => {
    mockSearchParams = new URLSearchParams("section=execution");
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "success", data: makeWorkspaceData(), refetch: vi.fn() } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);

    expect(screen.getByRole("heading", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Template execution" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Client" })).not.toBeInTheDocument();
  });

  it("renders the full Timeline when the URL selects the Timeline section, reusing the existing AssignmentTimelineCard", () => {
    mockSearchParams = new URLSearchParams("section=timeline");
    vi.mocked(useEventServiceWorkspace).mockReturnValue({
      status: "success",
      data: makeWorkspaceData({
        timeline: [
          {
            id: "t1",
            workspace_id: "ws",
            owner_type: "event_service",
            owner_id: "es_1",
            type: "status_changed",
            description: "Status changed to confirmed",
            actor: "owner",
            timestamp: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      refetch: vi.fn(),
    } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);

    expect(screen.getByText("Status changed to confirmed")).toBeInTheDocument();
  });

  it("renders existing notes when the URL selects the Notes section", () => {
    mockSearchParams = new URLSearchParams("section=notes");
    vi.mocked(useEventServiceWorkspace).mockReturnValue({
      status: "success",
      data: makeWorkspaceData({
        notes: [
          {
            id: "note_1",
            workspace_id: "ws",
            owner_type: "event_service",
            owner_id: "es_1",
            title: "Setup note",
            content: "Confirm access with venue.",
            category: "general",
            priority: "normal",
            is_pinned: false,
            attachments: [],
            created_by: "owner",
            created_at: "",
            updated_at: "",
          },
        ],
      }),
      refetch: vi.fn(),
    } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);

    expect(screen.getByText("Setup note")).toBeInTheDocument();
  });

  it("renders the Attachments section when the URL selects it", async () => {
    mockSearchParams = new URLSearchParams("section=attachments");
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "success", data: makeWorkspaceData(), refetch: vi.fn() } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);

    expect(await screen.findByText("No attachments yet")).toBeInTheDocument();
  });

  it("unmounts inactive tab panels rather than merely hiding them (lazy render) — the Overview-only Client heading is absent while Notes is selected", () => {
    mockSearchParams = new URLSearchParams("section=notes");
    vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "success", data: makeWorkspaceData(), refetch: vi.fn() } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);

    expect(screen.queryByRole("heading", { name: "Client" })).not.toBeInTheDocument();
  });

  it("renders read-only (no Edit affordance) once the assignment is cancelled", () => {
    vi.mocked(useEventServiceWorkspace).mockReturnValue({
      status: "success",
      data: makeWorkspaceData({ eventService: makeEventService({ status: "cancelled" }) }),
      refetch: vi.fn(),
    } as never);
    render(<EventServiceWorkspace serviceId="service_1" eventServiceId="es_1" />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
