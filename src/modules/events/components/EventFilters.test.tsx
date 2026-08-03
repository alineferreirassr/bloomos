import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventFilters, type EventFiltersValue } from "@/modules/events/components/EventFilters";

const baseValue: EventFiltersValue = {
  search: "",
  status: "all",
  lifecycleStage: "all",
  eventType: "all",
  priority: "all",
  dateFrom: "",
  dateTo: "",
  includeArchived: false,
  sortDirection: "asc",
};

describe("EventFilters", () => {
  it("calls onChange with updated search text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    await user.type(screen.getByLabelText(/search events/i), "m");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, search: "m" });
  });

  it("calls onChange when selecting a status", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "confirmed");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, status: "confirmed" });
  });

  it("calls onChange when selecting a lifecycle stage", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by lifecycle stage/i), "planning");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, lifecycleStage: "planning" });
  });

  it("calls onChange when selecting an event type", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by event type/i), "proposal");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, eventType: "proposal" });
  });

  it("calls onChange when selecting a priority", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by priority/i), "critical");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, priority: "critical" });
  });

  it("calls onChange with the selected date range", () => {
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/from date/i), { target: { value: "2026-08-01" } });

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, dateFrom: "2026-08-01" });
  });

  it("calls onChange when toggling the archived checkbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    await user.click(screen.getByLabelText(/show archived events/i));

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, includeArchived: true });
  });

  it("calls onChange when changing sort direction", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/sort by event date/i), "desc");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, sortDirection: "desc" });
  });
});
