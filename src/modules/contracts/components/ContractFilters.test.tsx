import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ContractFilters,
  DEFAULT_CONTRACT_FILTERS,
  type ContractFiltersValue,
} from "@/modules/contracts/components/ContractFilters";

const baseValue: ContractFiltersValue = DEFAULT_CONTRACT_FILTERS;

describe("ContractFilters", () => {
  it("calls onChange with updated search text", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContractFilters value={baseValue} onChange={onChange} />);

    await user.type(screen.getByLabelText(/search contracts/i), "m");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, search: "m" });
  });

  it("calls onChange when selecting a status", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContractFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "signed");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, status: "signed" });
  });

  it("calls onChange when selecting a signature status", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContractFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by signature status/i), "partially_signed");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, signatureStatus: "partially_signed" });
  });

  it("calls onChange when selecting a template category", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContractFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/filter by template category/i), "rental_agreement");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, templateCategory: "rental_agreement" });
  });

  it("calls onChange with the selected effective-date range", () => {
    const onChange = vi.fn();
    render(<ContractFilters value={baseValue} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/effective date from/i), { target: { value: "2026-06-01" } });

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, effectiveDateFrom: "2026-06-01" });
  });

  it("calls onChange when toggling the archived checkbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContractFilters value={baseValue} onChange={onChange} />);

    await user.click(screen.getByLabelText(/show archived contracts/i));

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, includeArchived: true });
  });

  it("calls onChange with both sort field and direction when changing sort", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ContractFilters value={baseValue} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/^sort by$/i), "value:desc");

    expect(onChange).toHaveBeenCalledWith({ ...baseValue, sortField: "value", sortDirection: "desc" });
  });
});
