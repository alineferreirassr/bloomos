import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceHealthSummaryCard } from "@/modules/services/components/ServiceHealthSummaryCard";
import type { ServiceHealthSummary } from "@/lib/queries/services/types";

describe("ServiceHealthSummaryCard", () => {
  it("renders the percentage and the top missing items from an already-computed ServiceHealthSummary", () => {
    const health: ServiceHealthSummary = {
      percent: 55,
      missing: [
        { label: "Checklist", jumpTo: { kind: "templateCategory", category: "checklistItems" } },
        { label: "Timeline", jumpTo: { kind: "templateCategory", category: "timelineItems" } },
      ],
    };
    render(<ServiceHealthSummaryCard health={health} />);

    // Appears twice — the card's own header percentage, and ProgressBar's own visible text — both are expected.
    expect(screen.getAllByText("55%")).toHaveLength(2);
    expect(screen.getByText("Checklist")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
  });

  it("shows a fully-set-up message instead of an empty list when nothing is missing", () => {
    render(<ServiceHealthSummaryCard health={{ percent: 100, missing: [] }} />);
    expect(screen.getByText(/fully set up/i)).toBeInTheDocument();
  });

  it("truncates missing items to maxMissingItems", () => {
    const health: ServiceHealthSummary = {
      percent: 20,
      missing: Array.from({ length: 5 }, (_, i) => ({
        label: `Missing ${i}`,
        jumpTo: { kind: "templateCategory" as const, category: "checklistItems" as const },
      })),
    };
    render(<ServiceHealthSummaryCard health={health} maxMissingItems={2} />);
    expect(screen.getByText("Missing 0")).toBeInTheDocument();
    expect(screen.getByText("Missing 1")).toBeInTheDocument();
    expect(screen.queryByText("Missing 2")).not.toBeInTheDocument();
  });

  it("forwards the navigation callback contract to the missing items, without owning any route logic itself", async () => {
    const user = userEvent.setup();
    const onMissingItemSelect = vi.fn();
    const health: ServiceHealthSummary = {
      percent: 55,
      missing: [{ label: "Checklist", jumpTo: { kind: "templateCategory", category: "checklistItems" } }],
    };
    render(<ServiceHealthSummaryCard health={health} onMissingItemSelect={onMissingItemSelect} />);

    await user.click(screen.getByRole("button", { name: /checklist/i }));
    expect(onMissingItemSelect).toHaveBeenCalledWith(health.missing[0]);
  });
});
