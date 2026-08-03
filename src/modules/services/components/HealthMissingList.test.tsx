import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HealthMissingList } from "@/modules/services/components/HealthMissingList";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

const ITEMS: ServiceHealthMissingItem[] = [
  { label: "Set a base price", jumpTo: { kind: "draftVersionForm" } },
  { label: "Checklist", jumpTo: { kind: "templateCategory", category: "checklistItems" } },
];

describe("HealthMissingList / HealthMissingItem", () => {
  it("renders nothing for an empty list", () => {
    const { container } = render(<HealthMissingList items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each item as plain, non-interactive text when no onSelect is given (read-only context)", () => {
    render(<HealthMissingList items={ITEMS} />);
    expect(screen.getByText("Set a base price")).toBeInTheDocument();
    expect(screen.getByText("Checklist")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders each item as a real, keyboard-operable button when onSelect is given, and calls it with the exact item", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<HealthMissingList items={ITEMS} onSelect={onSelect} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);

    buttons[0].focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);

    await user.click(screen.getByRole("button", { name: /checklist/i }));
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
  });
});
