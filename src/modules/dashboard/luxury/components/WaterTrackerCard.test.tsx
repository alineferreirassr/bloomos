import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/dashboard/wellnessActions", () => ({
  getMyWaterLogAction: vi.fn(),
  addWaterGlassAction: vi.fn(),
  removeWaterGlassAction: vi.fn(),
}));

import { getMyWaterLogAction, addWaterGlassAction, removeWaterGlassAction } from "@/modules/dashboard/wellnessActions";
import { WaterTrackerCard } from "@/modules/dashboard/luxury/components/WaterTrackerCard";

afterEach(() => {
  vi.clearAllMocks();
});

const WATER_LOG = { id: "water_1", workspace_id: "ws_1", member_id: "user_1", log_date: "2026-08-27", glasses: 3, created_at: "x", updated_at: "x" };

describe("WaterTrackerCard — successful paths", () => {
  it("loads the existing glass count", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue(WATER_LOG);
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());
  });

  it("adding a glass calls the action and increments the visible count", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue(null);
    vi.mocked(addWaterGlassAction).mockResolvedValue({ success: true, data: { ...WATER_LOG, glasses: 1 } });

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add a glass" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "Add a glass" }));
    await waitFor(() => expect(screen.getByText("1 of 8 glasses")).toBeInTheDocument());
    expect(addWaterGlassAction).toHaveBeenCalledWith(expect.any(String));
  });

  it("removing a glass calls the action and decrements the visible count", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue(WATER_LOG);
    vi.mocked(removeWaterGlassAction).mockResolvedValue({ success: true, data: { ...WATER_LOG, glasses: 2 } });

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove a glass" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    await waitFor(() => expect(screen.getByText("2 of 8 glasses")).toBeInTheDocument());
  });
});

describe("WaterTrackerCard — failure recovery (the confirmed blocking gap this checkpoint fixes)", () => {
  it("a rejected initial read clears loading, shows a recoverable error, and never leaves controls permanently disabled", async () => {
    vi.mocked(getMyWaterLogAction).mockRejectedValueOnce(new Error("network error"));

    render(<WaterTrackerCard />);

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add a glass" })).not.toBeInTheDocument();

    vi.mocked(getMyWaterLogAction).mockResolvedValueOnce(WATER_LOG);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add a glass" })).not.toBeDisabled();
  });

  it("a failed add-glass write rolls back the optimistic increment and surfaces a recoverable error", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue(WATER_LOG);
    vi.mocked(addWaterGlassAction).mockResolvedValue({ success: false, error: "Something went wrong." });

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Add a glass" }));

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument();
  });

  it("a failed remove-glass write rolls back the optimistic decrement", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue(WATER_LOG);
    vi.mocked(removeWaterGlassAction).mockResolvedValue({ success: false, error: "Something went wrong." });

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Remove a glass" }));

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument();
  });

  it("a genuinely REJECTED add-glass write (not a resolved {success:false}) rolls back the optimistic increment, never leaks the raw thrown error, and a subsequent retry can succeed", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue(WATER_LOG);
    vi.mocked(addWaterGlassAction)
      .mockRejectedValueOnce(new Error("supabase-private-error"))
      .mockResolvedValueOnce({ success: true, data: { ...WATER_LOG, glasses: 4 } });

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Add a glass" }));

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument();
    expect(screen.queryByText(/supabase-private-error/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a glass" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add a glass" }));
    await waitFor(() => expect(screen.getByText("4 of 8 glasses")).toBeInTheDocument());
  });

  it("a genuinely REJECTED remove-glass write rolls back the optimistic decrement, never leaks the raw thrown error, and a subsequent retry can succeed", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue(WATER_LOG);
    vi.mocked(removeWaterGlassAction)
      .mockRejectedValueOnce(new Error("supabase-private-error"))
      .mockResolvedValueOnce({ success: true, data: { ...WATER_LOG, glasses: 2 } });

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Remove a glass" }));

    await waitFor(() => expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument());
    expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument();
    expect(screen.queryByText(/supabase-private-error/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove a glass" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    await waitFor(() => expect(screen.getByText("2 of 8 glasses")).toBeInTheDocument());
  });
});

/**
 * These three tests exist specifically to close a genuine, mathematically-proven
 * defect found in an earlier version of this component's rollback logic: a scalar
 * `Math.max(0, g-1)` optimistic step followed by an unconditional `g+1` rollback on
 * failure loses information at the zero boundary once the clamp actually fires,
 * producing a permanently-wrong displayed count under ordinary (not contrived)
 * click sequences. The current implementation tracks confirmed state plus a ledger
 * of still-pending write deltas, clamping only at final display — these tests
 * construct exactly the settlement orderings that broke the old scalar-rollback
 * design and assert the mathematically correct final count.
 */
describe("WaterTrackerCard — overlapping-write ledger correctness (closes a proven zero-boundary rollback defect)", () => {
  it("Remove -> Add -> Remove, settling as: the second Remove succeeds, then the Add fails, then the first Remove fails, ends at the mathematically correct count (the exact previously-broken counterexample)", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue({ ...WATER_LOG, glasses: 1 });

    let resolveRemoveA!: (value: { success: boolean }) => void;
    let resolveAddB!: (value: { success: boolean }) => void;
    let resolveRemoveC!: (value: { success: boolean }) => void;
    const removeA = new Promise<{ success: boolean }>((resolve) => {
      resolveRemoveA = resolve;
    });
    const addB = new Promise<{ success: boolean }>((resolve) => {
      resolveAddB = resolve;
    });
    const removeC = new Promise<{ success: boolean }>((resolve) => {
      resolveRemoveC = resolve;
    });
    vi.mocked(removeWaterGlassAction).mockReturnValueOnce(removeA as never).mockReturnValueOnce(removeC as never);
    vi.mocked(addWaterGlassAction).mockReturnValueOnce(addB as never);

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("1 of 8 glasses")).toBeInTheDocument());

    // Remove A: 1 -> 0 optimistically. Remove is now disabled at 0, but Add never is.
    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove a glass" })).toBeDisabled();

    // Add B: 0 -> 1 optimistically. This re-enables Remove.
    await user.click(screen.getByRole("button", { name: "Add a glass" }));
    expect(screen.getByText("1 of 8 glasses")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove a glass" })).not.toBeDisabled();

    // Remove C: 1 -> 0 optimistically. All three writes (A, B, C) are now in flight.
    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument();

    // Settlement order that broke the old scalar-rollback implementation: the
    // later-dispatched Remove (C) succeeds first, then the Add (B) fails, then
    // the first Remove (A) fails. Verified against a standalone reconstruction
    // of the old scalar-rollback logic: this exact sequence produced a wrong
    // final value of 1 there, versus the mathematically correct 0 proven below.
    resolveRemoveC({ success: true });
    await waitFor(() => expect(removeWaterGlassAction).toHaveBeenCalledTimes(2));
    resolveAddB({ success: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveRemoveA({ success: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Only C (the second remove) actually succeeded: correct final = 1 (start) - 0 (A failed) - 0 (B failed) - 1 (C succeeded) = 0.
    // The old scalar-rollback implementation produced 1 here (a permanently wrong, one-glass-too-many count).
    await waitFor(() => expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument());
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  it("two overlapping Removes that BOTH fail restore exactly the original confirmed count, regardless of settlement order", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue({ ...WATER_LOG, glasses: 2 });

    let resolveRemoveA!: (value: { success: boolean }) => void;
    let resolveRemoveB!: (value: { success: boolean }) => void;
    const removeA = new Promise<{ success: boolean }>((resolve) => {
      resolveRemoveA = resolve;
    });
    const removeB = new Promise<{ success: boolean }>((resolve) => {
      resolveRemoveB = resolve;
    });
    vi.mocked(removeWaterGlassAction).mockReturnValueOnce(removeA as never).mockReturnValueOnce(removeB as never);

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("2 of 8 glasses")).toBeInTheDocument());

    // Both removes are dispatched while count is still >0 at each click, so both are genuinely reachable via ordinary clicks.
    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    expect(screen.getByText("1 of 8 glasses")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument();

    // Settle out of dispatch order: the second (later-dispatched) request fails first.
    resolveRemoveB({ success: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveRemoveA({ success: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Neither succeeded: correct final = 2 (unchanged). The old implementation could
    // over-credit a phantom glass here once the intermediate clamp had fired.
    await waitFor(() => expect(screen.getByText("2 of 8 glasses")).toBeInTheDocument());
  });

  it("an Add and a Remove dispatched together settle correctly regardless of settlement order (order-independence)", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue({ ...WATER_LOG, glasses: 3 });

    let resolveAdd!: (value: { success: boolean }) => void;
    let resolveRemove!: (value: { success: boolean }) => void;
    const add = new Promise<{ success: boolean }>((resolve) => {
      resolveAdd = resolve;
    });
    const remove = new Promise<{ success: boolean }>((resolve) => {
      resolveRemove = resolve;
    });
    vi.mocked(addWaterGlassAction).mockReturnValueOnce(add as never);
    vi.mocked(removeWaterGlassAction).mockReturnValueOnce(remove as never);

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Add a glass" }));
    expect(screen.getByText("4 of 8 glasses")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument();

    // Settle the Remove (dispatched second) before the Add (dispatched first) — settlement order differs from dispatch order.
    resolveRemove({ success: true });
    await waitFor(() => expect(removeWaterGlassAction).toHaveBeenCalledTimes(1));
    resolveAdd({ success: true });

    // Both succeeded: correct final = 3 (start) + 1 (add) - 1 (remove) = 3, independent of which settled first.
    await waitFor(() => expect(screen.getByText("3 of 8 glasses")).toBeInTheDocument());
    expect(screen.queryByText("Something went wrong. Please try again.")).not.toBeInTheDocument();
  });

  it("Add + Remove from zero, both succeeding with the Remove settling first, ends at the mathematically correct count (closes a second, exhaustively-proven ledger defect: clamping the internal success-merge, not just the display, loses information)", async () => {
    vi.mocked(getMyWaterLogAction).mockResolvedValue({ ...WATER_LOG, glasses: 0 });

    let resolveAdd!: (value: { success: boolean }) => void;
    let resolveRemove!: (value: { success: boolean }) => void;
    const add = new Promise<{ success: boolean }>((resolve) => {
      resolveAdd = resolve;
    });
    const remove = new Promise<{ success: boolean }>((resolve) => {
      resolveRemove = resolve;
    });
    vi.mocked(addWaterGlassAction).mockReturnValueOnce(add as never);
    vi.mocked(removeWaterGlassAction).mockReturnValueOnce(remove as never);

    const user = userEvent.setup();
    render(<WaterTrackerCard />);
    await waitFor(() => expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument());

    // Add A: 0 -> 1 optimistically. This is what makes Remove clickable next.
    await user.click(screen.getByRole("button", { name: "Add a glass" }));
    expect(screen.getByText("1 of 8 glasses")).toBeInTheDocument();
    // Remove B: 1 -> 0 optimistically. Both A and B are now in flight.
    await user.click(screen.getByRole("button", { name: "Remove a glass" }));
    expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument();

    // Settle Remove B (success) BEFORE Add A. A previous implementation clamped
    // the internal merge here (Math.max(0, 0-1) = 0), silently discarding the
    // fact that A — still pending, about to succeed — should bring the true
    // value back to exactly 0. The intermediate display right after this
    // settlement must already be mathematically correct, not just the final one.
    resolveRemove({ success: true });
    await waitFor(() => expect(removeWaterGlassAction).toHaveBeenCalledTimes(1));
    expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument();

    resolveAdd({ success: true });

    // Both succeeded: correct final = 0 (start) + 1 (add) - 1 (remove) = 0, regardless of settlement order.
    await waitFor(() => expect(screen.getByText("0 of 8 glasses")).toBeInTheDocument());
    expect(screen.queryByText("Something went wrong. Please try again.")).not.toBeInTheDocument();
  });
});
