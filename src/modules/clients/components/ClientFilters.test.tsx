import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientFilters, type ClientFiltersValue } from "@/modules/clients/components/ClientFilters";

const baseValue: ClientFiltersValue = {
  search: "",
  status: "all",
  source: "all",
  tag: "",
  vipOnly: false,
  includeArchived: false,
};

describe("ClientFilters", () => {
  it("calls onChange with updated search text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClientFilters value={baseValue} onChange={onChange} />);

    await user.type(screen.getByLabelText(/search clients/i), "n");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, search: "n" });
  });

  it("calls onChange when toggling VIP only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClientFilters value={baseValue} onChange={onChange} />);

    await user.click(screen.getByLabelText(/vip only/i));

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, vipOnly: true });
  });

  it("calls onChange when toggling the archived checkbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClientFilters value={baseValue} onChange={onChange} />);

    await user.click(screen.getByLabelText(/show archived clients/i));

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, includeArchived: true });
  });

  it("calls onChange when selecting a status", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClientFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "active");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, status: "active" });
  });

  it("calls onChange with the typed tag", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ClientFilters value={baseValue} onChange={onChange} />);

    await user.type(screen.getByLabelText(/filter by tag/i), "v");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, tag: "v" });
  });
});
