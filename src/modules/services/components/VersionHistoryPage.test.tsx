import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/services/hooks/useVersionHistory", () => ({ useVersionHistory: vi.fn() }));
vi.mock("@/modules/services/hooks/useTemplateBuilder", () => ({ useTemplateBuilder: vi.fn() }));

import { VersionHistoryPage } from "@/modules/services/components/VersionHistoryPage";
import { useVersionHistory } from "@/modules/services/hooks/useVersionHistory";
import { useTemplateBuilder } from "@/modules/services/hooks/useTemplateBuilder";
import { makeService, makeServiceVersion } from "@/modules/services/testUtils";
import type { TemplateBuilderData } from "@/lib/queries/services/types";

function makeTemplateData(overrides: Partial<TemplateBuilderData> = {}): TemplateBuilderData {
  return {
    serviceVersionId: "v2",
    isEditable: false,
    groups: [
      { groupName: "Day-of operations", categories: [{ key: "checklistItems", rows: [{ id: "c1" }], count: 1, expectation: "expected" }] },
      { groupName: "What the client sees", categories: [{ key: "includedItems", rows: [], count: 0, expectation: "optional" }] },
    ],
    ...overrides,
  };
}

const draftVersion = makeServiceVersion({ id: "draft_1", status: "draft", version_number: null, name_snapshot: null, published_at: null, published_by: null, change_summary: null });
const v1 = makeServiceVersion({ id: "v1", version_number: 1, published_at: "2026-01-01T00:00:00.000Z", published_by: "Amoré Bloom Owner", change_summary: "Initial release." });
const v2 = makeServiceVersion({ id: "v2", version_number: 2, published_at: "2026-03-01T00:00:00.000Z", published_by: "Amoré Bloom Owner", change_summary: "Added a new add-on." });

const rows = [
  { version: v1, isCurrentDraft: false },
  { version: draftVersion, isCurrentDraft: true },
  { version: v2, isCurrentDraft: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTemplateBuilder).mockReturnValue({ status: "success", data: makeTemplateData(), refetch: vi.fn() } as never);
});

describe("VersionHistoryPage", () => {
  it("shows a loading state while pending", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "pending", data: undefined, refetch: vi.fn() } as never);
    const { container } = render(<VersionHistoryPage serviceId="service_1" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows an error state with retry wired to refetch", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    vi.mocked(useVersionHistory).mockReturnValue({ status: "error", data: undefined, error: new Error("boom"), refetch } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByText(/couldn't load Version History/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the empty state when there are no version rows", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService(), rows: [] }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByText("No versions yet")).toBeInTheDocument();
  });

  it("orders the timeline newest first: Draft, then published versions by descending version number", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    const listbox = screen.getByRole("listbox", { name: "Version history" });
    const labels = within(listbox)
      .getAllByRole("option")
      .map((option) => option.querySelector("span")?.textContent);
    expect(labels).toEqual(["Draft", "Version 2", "Version 1"]);
  });

  it("marks the draft row with the Currently editing badge", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByText("Currently editing")).toBeInTheDocument();
  });

  it("marks only the Service's current_published_version_id row as Latest published", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getAllByText("Latest published")).toHaveLength(1);
  });

  it("selects the newest row (Draft) by default and shows its summary/metadata", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByRole("heading", { name: "Draft" })).toBeInTheDocument();
    expect(screen.getByText("Version metadata")).toBeInTheDocument();
  });

  it("selecting a different version in the timeline updates the detail panel", async () => {
    const user = userEvent.setup();
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    await user.click(screen.getByRole("option", { name: /Version 1/ }));
    expect(screen.getByRole("heading", { name: "Version 1" })).toBeInTheDocument();
    expect(screen.getByText("Initial release.")).toBeInTheDocument();
  });

  it("shows the stored change_summary verbatim, never a computed diff", async () => {
    const user = userEvent.setup();
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    await user.click(screen.getByRole("option", { name: /Version 2/ }));
    expect(screen.getByText("Added a new add-on.")).toBeInTheDocument();
  });

  it("shows honest placeholder copy for the draft, which has no change summary yet", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByText(/hasn't been published yet/)).toBeInTheDocument();
  });

  it("keeps the version-comparison action disabled — it's a prepared extension point, not a built feature", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByRole("button", { name: "Compare versions" })).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the sidebar's current published version, draft status, and total published count", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByText("Actively being edited")).toBeInTheDocument();
    expect(screen.getByText("Total published versions")).toBeInTheDocument();
    const total = screen.getByText("Total published versions").nextElementSibling;
    expect(total).toHaveTextContent("2");
  });

  it("sidebar quick navigation selects a version, keeping it in sync with the timeline", async () => {
    const user = userEvent.setup();
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    const quickNavHeading = screen.getByText("Quick navigation");
    const quickNavCard = quickNavHeading.parentElement as HTMLElement;
    await user.click(within(quickNavCard).getByText("Version 1"));
    expect(screen.getByRole("heading", { name: "Version 1" })).toBeInTheDocument();
  });

  it("never renders an edit, publish, or archive action anywhere on the page", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Publish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Archive/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("announces the selected version to assistive tech via a polite status region", async () => {
    const user = userEvent.setup();
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    await user.click(screen.getByRole("option", { name: /Version 1/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Viewing Version 1.");
  });

  it("supports ArrowDown/ArrowUp keyboard navigation across the timeline, moving both focus and selection", async () => {
    const user = userEvent.setup();
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    const draftOption = screen.getByRole("option", { name: /Draft/ });
    draftOption.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("heading", { name: "Version 2" })).toBeInTheDocument();
    expect(document.activeElement).toHaveAccessibleName(/Version 2/);
  });

  it("exposes template completion as a real progressbar for the selected version's snapshot", () => {
    vi.mocked(useVersionHistory).mockReturnValue({ status: "success", data: { service: makeService({ current_published_version_id: "v2" }), rows }, refetch: vi.fn() } as never);
    render(<VersionHistoryPage serviceId="service_1" />);
    expect(screen.getByRole("progressbar", { name: "Template completion" })).toBeInTheDocument();
  });
});
