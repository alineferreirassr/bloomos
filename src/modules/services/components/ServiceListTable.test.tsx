import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceListTable } from "@/modules/services/components/ServiceListTable";
import { makeServiceCatalogRow } from "@/modules/services/testUtils";

describe("ServiceListTable", () => {
  it("renders one row per Service using real semantic table markup", () => {
    const rows = [
      makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s1", name: "Live Music" } }),
      makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s2", name: "Photo Booth" } }),
    ];
    render(
      <ServiceListTable
        rows={rows}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        allSelected={false}
        someSelected={false}
        sortBy="name"
        onSortByChange={vi.fn()}
        actionsFor={() => []}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /Live Music/ })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /Photo Booth/ })).toBeInTheDocument();
  });

  it("reflects the active sort column via aria-sort, and calls onSortByChange when a sortable header is clicked", async () => {
    const user = userEvent.setup();
    const onSortByChange = vi.fn();
    render(
      <ServiceListTable
        rows={[makeServiceCatalogRow()]}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        allSelected={false}
        someSelected={false}
        sortBy="name"
        onSortByChange={onSortByChange}
        actionsFor={() => []}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /name/i })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: /health/i })).toHaveAttribute("aria-sort", "none");

    await user.click(screen.getByRole("button", { name: /health/i }));
    expect(onSortByChange).toHaveBeenCalledWith("health");
  });

  it("shows no selection checkboxes when not selectable", () => {
    render(
      <ServiceListTable
        rows={[makeServiceCatalogRow()]}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        allSelected={false}
        someSelected={false}
        sortBy="name"
        onSortByChange={vi.fn()}
        actionsFor={() => []}
      />,
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows a header 'select all' checkbox when selectable, reflecting indeterminate/all-selected state", () => {
    const { rerender } = render(
      <ServiceListTable
        rows={[makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s1" } }), makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s2" } })]}
        selectable
        selectedIds={new Set(["s1"])}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        allSelected={false}
        someSelected
        sortBy="name"
        onSortByChange={vi.fn()}
        actionsFor={() => []}
      />,
    );
    const selectAll = screen.getByRole("checkbox", { name: "Select all Services" }) as HTMLInputElement;
    expect(selectAll.indeterminate).toBe(true);

    rerender(
      <ServiceListTable
        rows={[makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s1" } })]}
        selectable
        selectedIds={new Set(["s1"])}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
        allSelected
        someSelected
        sortBy="name"
        onSortByChange={vi.fn()}
        actionsFor={() => []}
      />,
    );
    expect((screen.getByRole("checkbox", { name: "Select all Services" }) as HTMLInputElement).checked).toBe(true);
  });

  it("calls onToggleSelectAll when the header checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggleSelectAll = vi.fn();
    render(
      <ServiceListTable
        rows={[makeServiceCatalogRow()]}
        selectable
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={onToggleSelectAll}
        allSelected={false}
        someSelected={false}
        sortBy="name"
        onSortByChange={vi.fn()}
        actionsFor={() => []}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: "Select all Services" }));
    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);
  });
});
