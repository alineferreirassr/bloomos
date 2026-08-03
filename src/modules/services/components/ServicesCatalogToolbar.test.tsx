import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServicesCatalogToolbar } from "@/modules/services/components/ServicesCatalogToolbar";

describe("ServicesCatalogToolbar", () => {
  it("shows the result count with correct singular/plural phrasing", () => {
    const { rerender } = render(
      <ServicesCatalogToolbar
        resultCount={1}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortBy="name"
        onSortByChange={vi.fn()}
        bulkModeActive={false}
        onToggleBulkMode={vi.fn()}
      />,
    );
    expect(screen.getByText("1 Service")).toBeInTheDocument();

    rerender(
      <ServicesCatalogToolbar
        resultCount={4}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortBy="name"
        onSortByChange={vi.fn()}
        bulkModeActive={false}
        onToggleBulkMode={vi.fn()}
      />,
    );
    expect(screen.getByText("4 Services")).toBeInTheDocument();
  });

  it("forwards view mode and sort changes", async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();
    const onSortByChange = vi.fn();
    render(
      <ServicesCatalogToolbar
        resultCount={3}
        viewMode="grid"
        onViewModeChange={onViewModeChange}
        sortBy="name"
        onSortByChange={onSortByChange}
        bulkModeActive={false}
        onToggleBulkMode={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "List view" }));
    expect(onViewModeChange).toHaveBeenCalledWith("list");

    await user.selectOptions(screen.getByLabelText("Sort by"), "usage");
    expect(onSortByChange).toHaveBeenCalledWith("usage");
  });

  it("toggles bulk mode and reflects the pressed state", async () => {
    const user = userEvent.setup();
    const onToggleBulkMode = vi.fn();
    const { rerender } = render(
      <ServicesCatalogToolbar
        resultCount={3}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortBy="name"
        onSortByChange={vi.fn()}
        bulkModeActive={false}
        onToggleBulkMode={onToggleBulkMode}
      />,
    );

    const selectButton = screen.getByRole("button", { name: "Select" });
    expect(selectButton).toHaveAttribute("aria-pressed", "false");
    await user.click(selectButton);
    expect(onToggleBulkMode).toHaveBeenCalledTimes(1);

    rerender(
      <ServicesCatalogToolbar
        resultCount={3}
        viewMode="grid"
        onViewModeChange={vi.fn()}
        sortBy="name"
        onSortByChange={vi.fn()}
        bulkModeActive
        onToggleBulkMode={onToggleBulkMode}
      />,
    );
    expect(screen.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  });
});
