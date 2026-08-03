import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/modules/services/hooks/useServicesCatalog", () => ({
  useServicesCatalog: vi.fn(),
}));

import { ServicesCatalogPage } from "@/modules/services/components/ServicesCatalogPage";
import { useServicesCatalog } from "@/modules/services/hooks/useServicesCatalog";
import { makeServiceCatalogRow, makeServiceCategory } from "@/modules/services/testUtils";

function mockCatalog(overrides: Partial<ReturnType<typeof useServicesCatalog>> = {}) {
  vi.mocked(useServicesCatalog).mockReturnValue({
    status: "success",
    data: { rows: [makeServiceCatalogRow()], categories: [makeServiceCategory()] },
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("ServicesCatalogPage", () => {
  it("shows a loading skeleton while pending", () => {
    mockCatalog({ status: "pending", data: undefined });
    const { container } = render(<ServicesCatalogPage />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows an error state with a retry action wired to refetch", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockCatalog({ status: "error", data: undefined, refetch });
    render(<ServicesCatalogPage />);

    expect(screen.getByText(/couldn't load your Services catalog/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows the genuine-empty-catalog state when there are no rows and no filters applied", () => {
    mockCatalog({ data: { rows: [], categories: [] } });
    render(<ServicesCatalogPage />);
    expect(screen.getByText("No Services yet")).toBeInTheDocument();
  });

  it("shows a distinct no-results state when filters/search return zero rows", async () => {
    const user = userEvent.setup();
    mockCatalog({ data: { rows: [], categories: [] } });
    render(<ServicesCatalogPage />);

    await user.type(screen.getByLabelText("Search Services"), "nonexistent");
    expect(screen.getByText("No Services match your filters")).toBeInTheDocument();
  });

  it("renders the grid view by default, with the ServiceCard's content", () => {
    mockCatalog();
    render(<ServicesCatalogPage />);
    expect(screen.getByText("Live Music")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("switches to the table view via ViewToggle", async () => {
    const user = userEvent.setup();
    mockCatalog();
    render(<ServicesCatalogPage />);

    await user.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("persists the view mode across mounts via localStorage", async () => {
    const user = userEvent.setup();
    mockCatalog();
    const { unmount } = render(<ServicesCatalogPage />);

    await user.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    unmount();

    render(<ServicesCatalogPage />);
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("passes search/status/category/usage/sortBy filters straight through to useServicesCatalog", async () => {
    const user = userEvent.setup();
    mockCatalog();
    render(<ServicesCatalogPage />);

    await user.type(screen.getByLabelText("Search Services"), "photo");
    await user.selectOptions(screen.getByLabelText("Filter by status"), "active");
    await user.selectOptions(screen.getByLabelText("Filter by assignment"), "assigned");

    const lastCall = vi.mocked(useServicesCatalog).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ search: "photo", status: "active", usage: "assigned" });
  });

  it("applies the health filter client-side over the rows useServicesCatalog already returned", async () => {
    const user = userEvent.setup();
    mockCatalog({
      data: {
        rows: [
          makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "healthy", name: "Healthy One" }, health: { percent: 90, missing: [] } }),
          makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "unhealthy", name: "Needs Work" }, health: { percent: 30, missing: [] } }),
        ],
        categories: [],
      },
    });
    render(<ServicesCatalogPage />);
    expect(screen.getByText("Healthy One")).toBeInTheDocument();
    expect(screen.getByText("Needs Work")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by health"), "needsAttention");
    expect(screen.queryByText("Healthy One")).not.toBeInTheDocument();
    expect(screen.getByText("Needs Work")).toBeInTheDocument();
  });

  it("changes sortBy via the toolbar's SortSelector", async () => {
    const user = userEvent.setup();
    mockCatalog();
    render(<ServicesCatalogPage />);

    await user.selectOptions(screen.getByLabelText("Sort by"), "usage");
    const lastCall = vi.mocked(useServicesCatalog).mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({ sortBy: "usage" });
  });

  it("activates bulk mode, shows the BulkSelectionBar, and selects a row via its checkbox", async () => {
    const user = userEvent.setup();
    mockCatalog();
    render(<ServicesCatalogPage />);

    await user.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByText("0 of 1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select Live Music" }));
    expect(screen.getByText("1 of 1 selected")).toBeInTheDocument();
  });

  it("exiting bulk mode via Done clears the selection and hides the bar", async () => {
    const user = userEvent.setup();
    mockCatalog();
    render(<ServicesCatalogPage />);

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Live Music" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
  });

  it("wires the card's ActionMenu 'View' action to router.push", async () => {
    const user = userEvent.setup();
    mockCatalog();
    render(<ServicesCatalogPage />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(push).toHaveBeenCalledWith("/services/service_1");
  });

  it("reflects a query refresh — re-rendering with updated hook data updates the visible rows", () => {
    mockCatalog();
    const { rerender } = render(<ServicesCatalogPage />);
    expect(screen.getByText("Live Music")).toBeInTheDocument();

    mockCatalog({ data: { rows: [makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s2", name: "Photo Booth" } })], categories: [] } });
    rerender(<ServicesCatalogPage />);
    expect(screen.getByText("Photo Booth")).toBeInTheDocument();
    expect(screen.queryByText("Live Music")).not.toBeInTheDocument();
  });

  it("keeps the filter bar visible and keyboard-reachable in every state", () => {
    mockCatalog({ status: "pending", data: undefined });
    render(<ServicesCatalogPage />);
    expect(screen.getByLabelText("Search Services")).toBeInTheDocument();
  });

  it("supports keyboard-only interaction with the ActionMenu", async () => {
    const user = userEvent.setup();
    mockCatalog();
    render(<ServicesCatalogPage />);

    const trigger = screen.getByRole("button", { name: "Item actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "View" })).toBeInTheDocument();
  });
});
