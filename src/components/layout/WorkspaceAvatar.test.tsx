import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceAvatar } from "@/components/layout/WorkspaceAvatar";

describe("WorkspaceAvatar", () => {
  it("renders the Amoré Bloom logo image, not the AB fallback, while the image is loading/loaded", () => {
    render(<WorkspaceAvatar />);

    const img = screen.getByRole("img", { name: "Amoré Bloom" });
    expect(img).toHaveAttribute("src", expect.stringContaining("amore-bloom-app-logo.png"));
    expect(screen.queryByText("AB")).not.toBeInTheDocument();
  });

  it("falls back to the 'AB' initials if the logo image fails to load", () => {
    render(<WorkspaceAvatar />);

    const img = screen.getByRole("img", { name: "Amoré Bloom" });
    fireEvent.error(img);

    expect(screen.getByText("AB")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Amoré Bloom" })).not.toBeInTheDocument();
  });
});
