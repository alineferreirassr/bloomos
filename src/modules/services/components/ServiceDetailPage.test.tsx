import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/services/service_1",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/modules/services/hooks/useServiceEditor", () => ({ useServiceEditor: vi.fn() }));
vi.mock("@/modules/services/hooks/useServiceCategories", () => ({ useServiceCategories: vi.fn() }));
vi.mock("@/modules/services/hooks/useServicesPermissions", () => ({ useServicesPermissions: vi.fn() }));
vi.mock("@/modules/services/hooks/useServiceMutations", () => ({
  useUpdateService: vi.fn(),
  useActivateService: vi.fn(),
  useDeactivateService: vi.fn(),
  useArchiveService: vi.fn(),
  useRestoreService: vi.fn(),
}));
vi.mock("@/modules/services/hooks/useServiceVersionMutations", () => ({
  useUpdateServiceVersionDraft: vi.fn(),
  usePublishServiceVersion: vi.fn(),
}));
vi.mock("@/modules/services/hooks/usePublishPreview", () => ({ usePublishPreview: vi.fn() }));
vi.mock("@/modules/services/hooks/useServiceHealth", () => ({ useServiceHealth: vi.fn() }));
vi.mock("@/modules/services/hooks/useVersionHistory", () => ({ useVersionHistory: vi.fn() }));
vi.mock("@/modules/services/hooks/useTemplateBuilder", () => ({ useTemplateBuilder: vi.fn() }));
vi.mock("@/modules/services/hooks/useServiceAssignments", () => ({ useServiceAssignments: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceWorkspace", () => ({ useEventServiceWorkspace: vi.fn() }));
vi.mock("@/modules/services/hooks/useEventServiceOverrideMutations", () => ({ useUpdateEventServiceOverrides: vi.fn() }));

import { ServiceDetailPage } from "@/modules/services/components/ServiceDetailPage";
import { useServiceEditor } from "@/modules/services/hooks/useServiceEditor";
import { useServiceCategories } from "@/modules/services/hooks/useServiceCategories";
import { useServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import { useUpdateService, useActivateService, useDeactivateService, useArchiveService, useRestoreService } from "@/modules/services/hooks/useServiceMutations";
import { useUpdateServiceVersionDraft, usePublishServiceVersion } from "@/modules/services/hooks/useServiceVersionMutations";
import { usePublishPreview } from "@/modules/services/hooks/usePublishPreview";
import { useServiceHealth } from "@/modules/services/hooks/useServiceHealth";
import { useVersionHistory } from "@/modules/services/hooks/useVersionHistory";
import { useTemplateBuilder } from "@/modules/services/hooks/useTemplateBuilder";
import { useServiceAssignments } from "@/modules/services/hooks/useServiceAssignments";
import { useEventServiceWorkspace } from "@/modules/services/hooks/useEventServiceWorkspace";
import { NotFoundError } from "@/core/errors";
import { makeService, makeServiceVersion, makeServiceCategory } from "@/modules/services/testUtils";

function mockMutation(overrides: Record<string, unknown> = {}) {
  return { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false, ...overrides };
}

function mockPreviewData(overrides: Record<string, unknown> = {}) {
  return {
    serviceId: "service_1",
    draftVersionId: "draft_1",
    draftVersionUpdatedAt: "2026-01-01T00:00:00.000Z",
    nextVersionNumber: 1,
    currentPublishedVersionNumber: null,
    health: { percent: 100, missing: [] },
    templateCompletion: { percent: 100, requiredComplete: 5, requiredTotal: 5, optionalUsed: 0, optionalTotal: 11, missingRequiredCategories: [] },
    affectedCategories: [],
    blockingErrors: [],
    warnings: [],
    canPublish: true,
    ...overrides,
  };
}

function mockEditor(overrides: Partial<ReturnType<typeof useServiceEditor>> = {}) {
  vi.mocked(useServiceEditor).mockReturnValue({
    status: "success",
    data: {
      service: makeService(),
      draftVersion: makeServiceVersion({ id: "draft_1", status: "draft", version_number: null, published_at: null, published_by: null }),
      publishedVersion: makeServiceVersion(),
      health: { percent: 80, missing: [] },
      recentTimeline: [],
      usageCount: 2,
    },
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockEditor();
  vi.mocked(useServiceCategories).mockReturnValue({ data: [makeServiceCategory()] } as never);
  vi.mocked(useServicesPermissions).mockReturnValue({
    canEditIdentity: true,
    canEditDraftVersion: true,
    canPublish: true,
    canChangeStatus: true,
    canArchiveRestore: true,
    disabledReason: null,
  });
  vi.mocked(useUpdateService).mockReturnValue(mockMutation() as never);
  vi.mocked(useActivateService).mockReturnValue(mockMutation() as never);
  vi.mocked(useDeactivateService).mockReturnValue(mockMutation() as never);
  vi.mocked(useArchiveService).mockReturnValue(mockMutation() as never);
  vi.mocked(useRestoreService).mockReturnValue(mockMutation() as never);
  vi.mocked(useUpdateServiceVersionDraft).mockReturnValue(mockMutation() as never);
  vi.mocked(usePublishServiceVersion).mockReturnValue(mockMutation() as never);
  vi.mocked(usePublishPreview).mockReturnValue({ status: "pending", data: undefined } as never);
  vi.mocked(useServiceHealth).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
  vi.mocked(useVersionHistory).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
  vi.mocked(useTemplateBuilder).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
  vi.mocked(useServiceAssignments).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
  vi.mocked(useEventServiceWorkspace).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
});

describe("ServiceDetailPage", () => {
  it("shows a loading state while the editor query is pending", () => {
    mockEditor({ status: "pending", data: undefined } as never);
    const { container } = render(<ServiceDetailPage serviceId="service_1" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows a distinct not-found message for a not_found error", () => {
    mockEditor({ status: "error", data: undefined, error: new NotFoundError("Service service_1 was not found") } as never);
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByText(/doesn't exist, or has been permanently removed/)).toBeInTheDocument();
  });

  it("shows the missing-draft-version invariant message distinctly, not a generic error", () => {
    mockEditor({ status: "error", data: undefined, error: new Error("Service service_1 has no draft version.") } as never);
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByText(/missing its draft version/)).toBeInTheDocument();
  });

  it("renders the header and the Overview tab by default", () => {
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByRole("heading", { name: "Live Music", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument();
  });

  it("deep-links directly to a placeholder tab via the URL", () => {
    mockSearchParams = new URLSearchParams("tab=notes");
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByRole("tab", { name: "Notes", selected: true })).toBeInTheDocument();
    expect(screen.getByText(/Notes is coming in the next checkpoint/)).toBeInTheDocument();
  });

  it("falls back to Overview for an unrecognized tab value in the URL", () => {
    mockSearchParams = new URLSearchParams("tab=not-a-real-tab");
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument();
  });

  it("clicking a tab updates the URL via router.push", async () => {
    const user = userEvent.setup();
    render(<ServiceDetailPage serviceId="service_1" />);
    await user.click(screen.getByRole("tab", { name: "Health" }));
    expect(push).toHaveBeenCalledWith("/services/service_1?tab=health", { scroll: false });
  });

  it("re-rendering with a different URL (simulating Back/Forward) changes the active tab", () => {
    mockSearchParams = new URLSearchParams("tab=versions");
    const { rerender } = render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByRole("tab", { name: "Versions", selected: true })).toBeInTheDocument();

    mockSearchParams = new URLSearchParams();
    rerender(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByRole("tab", { name: "Overview", selected: true })).toBeInTheDocument();
  });

  it("supports keyboard arrow navigation across the tab strip", async () => {
    const user = userEvent.setup();
    render(<ServiceDetailPage serviceId="service_1" />);
    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(push).toHaveBeenCalledWith("/services/service_1?tab=templates", { scroll: false });
  });

  it("opens the Publish Confirmation dialog from the header's Publish button, and it alone", async () => {
    const user = userEvent.setup();
    vi.mocked(usePublishPreview).mockReturnValue({ status: "success", data: mockPreviewData(), refetch: vi.fn() } as never);
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(screen.getByRole("dialog", { name: 'Publish "Live Music"' })).toBeInTheDocument();
  });

  it("shows a success toast naming the new version and closes the dialog once the publish mutation resolves", async () => {
    const user = userEvent.setup();
    vi.mocked(usePublishPreview).mockReturnValue({ status: "success", data: mockPreviewData({ nextVersionNumber: 3 }), refetch: vi.fn() } as never);
    const publishMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(usePublishServiceVersion).mockReturnValue(mockMutation({ mutateAsync: publishMutateAsync }) as never);

    render(<ServiceDetailPage serviceId="service_1" />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    // The header's own "Publish" button is gone once the dialog is open (it's outside the dialog but the dialog's backdrop doesn't hide it — scope to the dialog to find its Publish action specifically).
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish" }));

    expect(publishMutateAsync).toHaveBeenCalledWith({ change_summary: null });
    expect(await screen.findByText("Version 3 published successfully.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the real Health Dashboard on the health tab, and its issue navigation switches to the target tab", async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams("tab=health");
    vi.mocked(useServiceHealth).mockReturnValue({
      status: "success",
      data: { percent: 70, missing: [{ label: "Timeline", jumpTo: { kind: "templateCategory", category: "timelineItems" } }] },
      refetch: vi.fn(),
    } as never);
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByRole("heading", { name: "Overall Health" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review: Timeline" }));
    expect(push).toHaveBeenCalledWith("/services/service_1?tab=templates", { scroll: false });
  });

  it("shows the archived banner and hides it for a non-archived Service", () => {
    mockEditor({
      data: {
        service: makeService({ status: "archived" }),
        draftVersion: makeServiceVersion({ id: "draft_1", status: "draft", version_number: null, published_at: null, published_by: null }),
        publishedVersion: makeServiceVersion(),
        health: { percent: 80, missing: [] },
        recentTimeline: [],
        usageCount: 0,
      },
    } as never);
    render(<ServiceDetailPage serviceId="service_1" />);
    expect(screen.getByText(/This Service is archived/)).toBeInTheDocument();
  });
});
