import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrendWindowPicker } from "@/modules/analytics/components/TrendWindowPicker";

describe("TrendWindowPicker", () => {
  it("Step 5: offers exactly Today/7 Days/30 Days/90 Days/Year, as a real, keyboard-native <select>", () => {
    render(<TrendWindowPicker value="30d" onChange={vi.fn()} />);
    const select = screen.getByLabelText("Trend window");
    expect(Array.from(select.querySelectorAll("option")).map((o) => o.textContent)).toEqual(["Today", "7 Days", "30 Days", "90 Days", "Year"]);
  });

  it("calls onChange with the newly selected window key", () => {
    const onChange = vi.fn();
    render(<TrendWindowPicker value="30d" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Trend window"), { target: { value: "year" } });
    expect(onChange).toHaveBeenCalledWith("year");
  });
});
