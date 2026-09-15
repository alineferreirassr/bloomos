import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadFilters, type LeadFiltersValue } from "@/modules/leads/components/LeadFilters";

function baseValue(overrides: Partial<LeadFiltersValue> = {}): LeadFiltersValue {
  return { search: "", status: "all", source: "all", eventType: "all", includeArchived: false, unassignedOnly: false, ...overrides };
}

describe("LeadFilters — SOCIAL-13F Unassigned filter", () => {
  it("renders an 'Unassigned only' checkbox reflecting the current value", () => {
    render(<LeadFilters value={baseValue({ unassignedOnly: true })} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/unassigned only/i)).toBeChecked();
  });

  it("calls onChange with unassignedOnly toggled on, preserving every other filter value untouched", async () => {
    const onChange = vi.fn();
    const value = baseValue({ search: "sofia", status: "qualified" });
    render(<LeadFilters value={value} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(/unassigned only/i));

    expect(onChange).toHaveBeenCalledWith({ ...value, unassignedOnly: true });
  });
});
