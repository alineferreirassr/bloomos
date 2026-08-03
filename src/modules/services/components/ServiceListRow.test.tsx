import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceListRow } from "@/modules/services/components/ServiceListRow";
import { makeServiceCatalogRow } from "@/modules/services/testUtils";

function renderRow(ui: React.ReactElement) {
  return render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );
}

describe("ServiceListRow", () => {
  it("renders name, category, status, health, price, usage, version and updated date as table cells", () => {
    renderRow(<ServiceListRow row={makeServiceCatalogRow()} actions={[]} />);

    expect(screen.getByText("Live Music")).toBeInTheDocument();
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("$500.00")).toBeInTheDocument();
    expect(screen.getByText("3 Events")).toBeInTheDocument();
    expect(screen.getByText("Published v1")).toBeInTheDocument();
  });

  it("renders a selection checkbox only when selectable", () => {
    const { rerender } = renderRow(<ServiceListRow row={makeServiceCatalogRow()} actions={[]} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <ServiceListRow row={makeServiceCatalogRow()} actions={[]} selectable onToggleSelect={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByRole("checkbox", { name: "Select Live Music" })).toBeInTheDocument();
  });

  it("fires the ActionMenu actions supplied by the parent", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderRow(<ServiceListRow row={makeServiceCatalogRow()} actions={[{ label: "View", onSelect }]} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
