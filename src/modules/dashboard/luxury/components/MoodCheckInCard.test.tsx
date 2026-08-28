import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/dashboard/wellnessActions", () => ({
  getMyWellnessCheckInAction: vi.fn(),
  setMyMoodAction: vi.fn(),
}));

import { getMyWellnessCheckInAction, setMyMoodAction } from "@/modules/dashboard/wellnessActions";
import { MoodCheckInCard } from "@/modules/dashboard/luxury/components/MoodCheckInCard";

afterEach(() => {
  vi.clearAllMocks();
});

describe("MoodCheckInCard — successful paths", () => {
  it("loads the existing mood and marks it selected", async () => {
    vi.mocked(getMyWellnessCheckInAction).mockResolvedValue({
      id: "checkin_1",
      workspace_id: "ws_1",
      member_id: "user_1",
      checkin_date: "2026-08-27",
      mood: "calm",
      created_at: "2026-08-27T00:00:00Z",
      updated_at: "2026-08-27T00:00:00Z",
    });

    render(<MoodCheckInCard />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Calm/ })).toHaveAttribute("aria-pressed", "true"));
  });

  it("selecting a mood calls the action and keeps the selection", async () => {
    vi.mocked(getMyWellnessCheckInAction).mockResolvedValue(null);
    vi.mocked(setMyMoodAction).mockResolvedValue({
      success: true,
      data: { id: "checkin_1", workspace_id: "ws_1", member_id: "user_1", checkin_date: "2026-08-27", mood: "happy", created_at: "x", updated_at: "x" },
    });

    const user = userEvent.setup();
    render(<MoodCheckInCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Happy/ })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: /Happy/ }));
    await waitFor(() => expect(setMyMoodAction).toHaveBeenCalledWith(expect.any(String), "happy"));
    expect(screen.getByRole("button", { name: /Happy/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("MoodCheckInCard — failure recovery (the confirmed blocking gap this checkpoint fixes)", () => {
  it("a rejected initial read clears loading, shows a recoverable error, and never leaves controls permanently disabled", async () => {
    vi.mocked(getMyWellnessCheckInAction).mockRejectedValueOnce(new Error("network error"));

    render(<MoodCheckInCard />);

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.queryByRole("group", { name: "Select your mood" })).not.toBeInTheDocument();

    vi.mocked(getMyWellnessCheckInAction).mockResolvedValueOnce(null);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("group", { name: "Select your mood" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Great/ })).not.toBeDisabled();
  });

  it("a failed write rolls back the optimistic selection and surfaces a recoverable error", async () => {
    vi.mocked(getMyWellnessCheckInAction).mockResolvedValue(null);
    vi.mocked(setMyMoodAction).mockResolvedValue({ success: false, error: "Something went wrong." });

    const user = userEvent.setup();
    render(<MoodCheckInCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Tired/ })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: /Tired/ }));

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Tired/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("a genuinely REJECTED write (not a resolved {success:false}) also rolls back the optimistic selection, never leaks the raw thrown error, and a subsequent retry can succeed", async () => {
    vi.mocked(getMyWellnessCheckInAction).mockResolvedValue(null);
    vi.mocked(setMyMoodAction)
      .mockRejectedValueOnce(new Error("internal-postgres-write-failure"))
      .mockResolvedValueOnce({
        success: true,
        data: { id: "checkin_1", workspace_id: "ws_1", member_id: "user_1", checkin_date: "2026-08-27", mood: "stressed", created_at: "x", updated_at: "x" },
      });

    const user = userEvent.setup();
    render(<MoodCheckInCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Stressed/ })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: /Stressed/ }));

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Stressed/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/internal-postgres-write-failure/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stressed/ })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Stressed/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Stressed/ })).toHaveAttribute("aria-pressed", "true"));
  });

  it("an older, now-superseded rejected write does not roll back a newer selection (stale-rollback guard)", async () => {
    vi.mocked(getMyWellnessCheckInAction).mockResolvedValue(null);
    let rejectFirst!: (reason: unknown) => void;
    const firstCall = new Promise<never>((_, reject) => {
      rejectFirst = reject;
    });
    vi.mocked(setMyMoodAction).mockReturnValueOnce(firstCall as never).mockResolvedValueOnce({
      success: true,
      data: { id: "checkin_1", workspace_id: "ws_1", member_id: "user_1", checkin_date: "2026-08-27", mood: "happy", created_at: "x", updated_at: "x" },
    });

    const user = userEvent.setup();
    render(<MoodCheckInCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Great/ })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: /Great/ }));
    await user.click(screen.getByRole("button", { name: /Happy/ }));
    expect(screen.getByRole("button", { name: /Happy/ })).toHaveAttribute("aria-pressed", "true");

    rejectFirst(new Error("stale request failed"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByRole("button", { name: /Happy/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Something went wrong. Please try again.")).not.toBeInTheDocument();
  });
});
