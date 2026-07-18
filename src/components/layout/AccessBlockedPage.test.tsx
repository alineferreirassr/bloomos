import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const pushMock = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/auth/actions", () => ({
  signOut: vi.fn(),
}));

import { AccessBlockedPage } from "@/components/layout/AccessBlockedPage";
import { signOut } from "@/lib/auth/actions";

describe("AccessBlockedPage", () => {
  it("renders the given title and message", () => {
    render(<AccessBlockedPage title="Account inactive" message="Contact a Workspace owner." />);

    expect(screen.getByText("Account inactive")).toBeInTheDocument();
    expect(screen.getByText("Contact a Workspace owner.")).toBeInTheDocument();
  });

  it("navigates to /sign-in after a successful sign-out that didn't already redirect (mock mode)", async () => {
    vi.mocked(signOut).mockResolvedValue({ success: true });
    render(<AccessBlockedPage title="Account inactive" message="…" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/sign-in"));
  });

  it("shows the error and does not navigate when sign-out fails", async () => {
    vi.mocked(signOut).mockResolvedValue({ success: false, error: "Could not reach the server." });
    render(<AccessBlockedPage title="Account inactive" message="…" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server."));
    expect(pushMock).not.toHaveBeenCalled();
  });
});
