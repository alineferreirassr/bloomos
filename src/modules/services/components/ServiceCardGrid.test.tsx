import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceCardGrid } from "@/modules/services/components/ServiceCardGrid";
import { makeServiceCatalogRow } from "@/modules/services/testUtils";

describe("ServiceCardGrid", () => {
  it("renders one card per row", () => {
    const rows = [makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s1", name: "Live Music" } }), makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s2", name: "Photo Booth" } })];
    render(<ServiceCardGrid rows={rows} selectedIds={new Set()} onToggleSelect={vi.fn()} actionsFor={() => []} />);

    expect(screen.getByText("Live Music")).toBeInTheDocument();
    expect(screen.getByText("Photo Booth")).toBeInTheDocument();
  });

  it("marks selected rows and forwards onToggleSelect with the right id", async () => {
    const user = userEvent.setup();
    const onToggleSelect = vi.fn();
    const rows = [makeServiceCatalogRow({ service: { ...makeServiceCatalogRow().service, id: "s1", name: "Live Music" } })];
    render(<ServiceCardGrid rows={rows} selectable selectedIds={new Set(["s1"])} onToggleSelect={onToggleSelect} actionsFor={() => []} />);

    const checkbox = screen.getByRole("checkbox", { name: "Select Live Music" });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(onToggleSelect).toHaveBeenCalledWith("s1");
  });

  it("computes actions per row via actionsFor", () => {
    const rows = [makeServiceCatalogRow()];
    const actionsFor = vi.fn().mockReturnValue([{ label: "View", onSelect: vi.fn() }]);
    render(<ServiceCardGrid rows={rows} selectedIds={new Set()} onToggleSelect={vi.fn()} actionsFor={actionsFor} />);
    expect(actionsFor).toHaveBeenCalledWith(rows[0]);
  });
});
