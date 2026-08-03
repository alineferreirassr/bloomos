import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ServicesCatalogFilterBar,
  DEFAULT_SERVICES_CATALOG_FILTERS,
  hasActiveServicesCatalogFilters,
  type ServicesCatalogFilterBarValue,
} from "@/modules/services/components/ServicesCatalogFilterBar";
import type { ServiceCategory } from "@/types/serviceCategory";

const CATEGORIES: ServiceCategory[] = [
  { id: "cat_1", workspace_id: "ws", name: "Photography", description: null, display_order: 0, created_at: "", updated_at: "", archived_at: null },
];

/** A stateful harness — the real component is fully controlled, so exercising multi-keystroke typing needs a parent that actually re-renders with each onChange, not a static prop. */
function Harness({ onChange }: { onChange: (value: ServicesCatalogFilterBarValue) => void }) {
  const [value, setValue] = useState(DEFAULT_SERVICES_CATALOG_FILTERS);
  return (
    <ServicesCatalogFilterBar
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      categories={CATEGORIES}
    />
  );
}

describe("ServicesCatalogFilterBar", () => {
  it("updates search immediately on input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByLabelText("Search Services"), "photo");
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SERVICES_CATALOG_FILTERS, search: "photo" });
  });

  it("lists every real ServiceStatus in the status filter", () => {
    render(<ServicesCatalogFilterBar value={DEFAULT_SERVICES_CATALOG_FILTERS} onChange={vi.fn()} categories={CATEGORIES} />);
    const select = screen.getByLabelText("Filter by status");
    expect(select).toHaveTextContent("Draft");
    expect(select).toHaveTextContent("Active");
    expect(select).toHaveTextContent("Inactive");
    expect(select).toHaveTextContent("Archived");
  });

  it("populates the category filter from the supplied categories", () => {
    render(<ServicesCatalogFilterBar value={DEFAULT_SERVICES_CATALOG_FILTERS} onChange={vi.fn()} categories={CATEGORIES} />);
    expect(screen.getByLabelText("Filter by category")).toHaveTextContent("Photography");
  });

  it("changes health filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ServicesCatalogFilterBar value={DEFAULT_SERVICES_CATALOG_FILTERS} onChange={onChange} categories={CATEGORIES} />);

    await user.selectOptions(screen.getByLabelText("Filter by health"), "needsAttention");
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SERVICES_CATALOG_FILTERS, health: "needsAttention" });
  });

  it("changes assignment filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ServicesCatalogFilterBar value={DEFAULT_SERVICES_CATALOG_FILTERS} onChange={onChange} categories={CATEGORIES} />);

    await user.selectOptions(screen.getByLabelText("Filter by assignment"), "unassigned");
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SERVICES_CATALOG_FILTERS, usage: "unassigned" });
  });

  it("toggles the archived checkbox", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ServicesCatalogFilterBar value={DEFAULT_SERVICES_CATALOG_FILTERS} onChange={onChange} categories={CATEGORIES} />);

    await user.click(screen.getByLabelText("Show archived Services"));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SERVICES_CATALOG_FILTERS, includeArchived: true });
  });
});

describe("hasActiveServicesCatalogFilters", () => {
  it("is false for the untouched defaults", () => {
    expect(hasActiveServicesCatalogFilters(DEFAULT_SERVICES_CATALOG_FILTERS)).toBe(false);
  });

  it("is true once any single field diverges from default", () => {
    expect(hasActiveServicesCatalogFilters({ ...DEFAULT_SERVICES_CATALOG_FILTERS, search: "x" })).toBe(true);
    expect(hasActiveServicesCatalogFilters({ ...DEFAULT_SERVICES_CATALOG_FILTERS, status: "active" })).toBe(true);
    expect(hasActiveServicesCatalogFilters({ ...DEFAULT_SERVICES_CATALOG_FILTERS, health: "healthy" })).toBe(true);
    expect(hasActiveServicesCatalogFilters({ ...DEFAULT_SERVICES_CATALOG_FILTERS, includeArchived: true })).toBe(true);
  });
});
