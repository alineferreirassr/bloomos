import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ServicesLoadingSkeleton,
  ServicesCatalogEmptyState,
  ServicesCatalogErrorState,
  HealthDashboardEmptyState,
  HealthDashboardErrorState,
  RequirementsEmptyState,
  TemplateCategoryEmptyState,
  ServiceEditorErrorState,
} from "@/modules/services/components/ServicesStates";

describe("Services loading/empty/error state presets", () => {
  it("ServicesLoadingSkeleton renders the requested number of rows with busy/live semantics", () => {
    const { container } = render(<ServicesLoadingSkeleton rows={4} />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(container.firstChild).toHaveAttribute("aria-live", "polite");
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("ServicesCatalogEmptyState/ErrorState show Services-specific copy via the generic primitives", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ServicesCatalogEmptyState />);
    expect(screen.getByText("No Services yet")).toBeInTheDocument();

    render(<ServicesCatalogErrorState onRetry={onRetry} />);
    expect(screen.getByText(/couldn't load your Services catalog/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("HealthDashboardEmptyState/ErrorState render distinct copy", () => {
    render(<HealthDashboardEmptyState />);
    expect(screen.getByText("No Services to check")).toBeInTheDocument();

    render(<HealthDashboardErrorState />);
    expect(screen.getByText(/couldn't load the Health Dashboard/i)).toBeInTheDocument();
  });

  it("RequirementsEmptyState renders", () => {
    render(<RequirementsEmptyState />);
    expect(screen.getByText("No requirements yet")).toBeInTheDocument();
  });

  it("TemplateCategoryEmptyState interpolates the category label", () => {
    render(<TemplateCategoryEmptyState categoryLabel="checklist items" />);
    expect(screen.getByText("No checklist items yet")).toBeInTheDocument();
  });

  it("ServiceEditorErrorState renders", () => {
    render(<ServiceEditorErrorState />);
    expect(screen.getByText(/couldn't load this Service/i)).toBeInTheDocument();
  });
});
