import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortSelector } from "@/modules/services/components/SortSelector";

describe("SortSelector", () => {
  it("reflects the current sort value", () => {
    render(<SortSelector value="health" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Sort by")).toHaveValue("health");
  });

  it("calls onChange with the selected key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SortSelector value="name" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Sort by"), "usage");
    expect(onChange).toHaveBeenCalledWith("usage");
  });

  it("offers exactly the four real sort dimensions", () => {
    render(<SortSelector value="name" onChange={vi.fn()} />);
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Sort: Name", "Sort: Health", "Sort: Usage", "Sort: Last updated"]);
  });
});
