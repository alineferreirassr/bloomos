import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForbiddenState } from "@/components/layout/ForbiddenState";

describe("ForbiddenState", () => {
  it("renders a clear, non-technical forbidden message", () => {
    render(<ForbiddenState />);

    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.getByText(/doesn't include the permission this page requires/)).toBeInTheDocument();
  });
});
