import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "@/components/ui/Checkbox";

describe("Checkbox", () => {
  it("renders a native checkbox input with correct checked semantics", () => {
    render(<Checkbox aria-label="Select row" checked readOnly />);
    const checkbox = screen.getByRole("checkbox", { name: "Select row" });
    expect(checkbox).toBeInstanceOf(HTMLInputElement);
    expect(checkbox).toBeChecked();
  });

  it("toggles via keyboard (Space) when focused, in uncontrolled mode", async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Select row" defaultChecked={false} />);
    const checkbox = screen.getByRole("checkbox", { name: "Select row" });

    checkbox.focus();
    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
  });

  it("supports controlled usage via checked/onChange", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [checked, setChecked] = useState(false);
      return <Checkbox aria-label="Select row" checked={checked} onChange={(e) => setChecked(e.target.checked)} />;
    }
    render(<Controlled />);

    const checkbox = screen.getByRole("checkbox", { name: "Select row" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("sets the native indeterminate DOM property, not just a visual style", () => {
    const { rerender } = render(<Checkbox aria-label="Select all" checked={false} indeterminate readOnly />);
    const checkbox = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);

    rerender(<Checkbox aria-label="Select all" checked={false} indeterminate={false} readOnly />);
    expect(checkbox.indeterminate).toBe(false);
  });

  it("respects disabled — cannot be focused or toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox aria-label="Select row" disabled onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Select row" });
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("forwards a ref to the underlying input element", () => {
    let node: HTMLInputElement | null = null;
    render(
      <Checkbox
        aria-label="Select row"
        ref={(el) => {
          node = el;
        }}
      />,
    );
    expect(node).toBeInstanceOf(HTMLInputElement);
  });
});
