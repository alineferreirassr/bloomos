import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateBuilderSidebar } from "@/modules/services/components/TemplateBuilderSidebar";
import { ALL_TEMPLATE_CATEGORY_ADAPTERS } from "@/modules/services/templateCategoryAdapters";
import type { TemplateBuilderData } from "@/lib/queries/services/types";

function makeData(overrides: Partial<TemplateBuilderData> = {}): TemplateBuilderData {
  return {
    serviceVersionId: "draft_1",
    isEditable: true,
    groups: [
      {
        groupName: "Day-of operations",
        categories: [
          { key: "checklistItems", rows: [{ id: "c1" }], count: 1, expectation: "expected" },
          { key: "timelineItems", rows: [], count: 0, expectation: "expected" },
        ],
      },
      {
        groupName: "What the client sees",
        categories: [{ key: "includedItems", rows: [], count: 0, expectation: "optional" }],
      },
    ],
    ...overrides,
  } as TemplateBuilderData;
}

describe("TemplateBuilderSidebar", () => {
  it("shows the fraction of required categories complete", () => {
    render(<TemplateBuilderSidebar data={makeData()} adapters={ALL_TEMPLATE_CATEGORY_ADAPTERS} onNavigateToCategory={vi.fn()} />);
    expect(screen.getByText("1 of 2 required categories complete")).toBeInTheDocument();
  });

  it("lists missing required categories with working navigation", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<TemplateBuilderSidebar data={makeData()} adapters={ALL_TEMPLATE_CATEGORY_ADAPTERS} onNavigateToCategory={onNavigate} />);
    expect(screen.getByText("Missing categories")).toBeInTheDocument();
    const missingButtons = screen.getAllByRole("button", { name: "Timeline Items" });
    await user.click(missingButtons[0]);
    expect(onNavigate).toHaveBeenCalledWith("timelineItems");
  });

  it("omits the missing-categories card once every required category has at least one item", () => {
    render(
      <TemplateBuilderSidebar
        data={makeData({
          groups: [{ groupName: "Day-of operations", categories: [{ key: "checklistItems", rows: [{ id: "c1" }], count: 1, expectation: "expected" }] }],
        })}
        adapters={ALL_TEMPLATE_CATEGORY_ADAPTERS}
        onNavigateToCategory={vi.fn()}
      />,
    );
    expect(screen.queryByText("Missing categories")).not.toBeInTheDocument();
    expect(screen.getByText("All required template categories have at least one item.")).toBeInTheDocument();
  });

  it("renders every category in Quick navigation with its count", () => {
    render(<TemplateBuilderSidebar data={makeData()} adapters={ALL_TEMPLATE_CATEGORY_ADAPTERS} onNavigateToCategory={vi.fn()} />);
    expect(screen.getByText("Quick navigation")).toBeInTheDocument();
    expect(screen.getByText("Included Items")).toBeInTheDocument();
  });
});
