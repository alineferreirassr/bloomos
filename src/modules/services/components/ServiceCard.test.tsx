import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceCard } from "@/modules/services/components/ServiceCard";
import { makeServiceCatalogRow } from "@/modules/services/testUtils";

describe("ServiceCard", () => {
  it("renders name, category, status, health, price, usage, version and updated date", () => {
    const row = makeServiceCatalogRow();
    render(<ServiceCard row={row} actions={[]} />);

    expect(screen.getByText("Live Music")).toBeInTheDocument();
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("3 Events")).toBeInTheDocument();
    expect(screen.getByText("Published v1")).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it("shows 'Uncategorized' when categoryName is null", () => {
    render(<ServiceCard row={makeServiceCatalogRow({ categoryName: null })} actions={[]} />);
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });

  it("shows a Draft version badge and unavailable price when never published", () => {
    render(<ServiceCard row={makeServiceCatalogRow({ publishedVersion: null })} actions={[]} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the ActionMenu with the actions supplied by the parent", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ServiceCard row={makeServiceCatalogRow()} actions={[{ label: "View", onSelect }]} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders a selection checkbox only when selectable, and calls onToggleSelect with the service id", async () => {
    const user = userEvent.setup();
    const onToggleSelect = vi.fn();
    const { rerender } = render(<ServiceCard row={makeServiceCatalogRow()} actions={[]} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    rerender(<ServiceCard row={makeServiceCatalogRow()} actions={[]} selectable onToggleSelect={onToggleSelect} />);
    await user.click(screen.getByRole("checkbox", { name: "Select Live Music" }));
    expect(onToggleSelect).toHaveBeenCalledWith("service_1");
  });

  it("indicates the selected state visually", () => {
    const { container, rerender } = render(<ServiceCard row={makeServiceCatalogRow()} actions={[]} selectable selected={false} />);
    expect(container.querySelector(".border-accent")).not.toBeInTheDocument();

    rerender(<ServiceCard row={makeServiceCatalogRow()} actions={[]} selectable selected />);
    expect(container.querySelector(".border-accent")).toBeInTheDocument();
  });
});
