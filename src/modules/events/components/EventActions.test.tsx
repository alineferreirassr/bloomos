import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventActions } from "@/modules/events/components/EventActions";
import { makeEvent } from "@/modules/events/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/data", () => ({
  archiveEvent: vi.fn(),
  restoreEvent: vi.fn(),
  cancelEvent: vi.fn(),
  completeEvent: vi.fn(),
  updateEventStatus: vi.fn(),
  updateEventLifecycleStage: vi.fn(),
  updateEventPriority: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.create", "events.update", "events.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderEventActions(props: Parameters<typeof EventActions>[0], permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <EventActions {...props} />
    </MemberSessionProvider>,
  );
}

describe("EventActions — working event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Edit, Complete, Cancel, Archive, and the three transition selects", () => {
    renderEventActions({ event: makeEvent({ status: "confirmed" }), onChanged: vi.fn() });

    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete event/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel event/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/event status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/event lifecycle stage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/event priority/i)).toBeInTheDocument();
  });

  it("only offers allowed next statuses in the Status select", () => {
    renderEventActions({ event: makeEvent({ status: "draft" }), onChanged: vi.fn() });

    const select = screen.getByLabelText(/event status/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);
    expect(options).not.toContain("completed");
    expect(options).not.toContain("cancelled");
    expect(options).not.toContain("archived");
    expect(options).toContain("inquiry");
  });

  it("changes priority and calls updateEventPriority", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateEventPriority).mockResolvedValue({
      success: true,
      data: makeEvent({ priority: "urgent" }),
    });
    const onChanged = vi.fn();

    renderEventActions({ event: makeEvent({ id: "event_1", priority: "normal" }), onChanged: onChanged });

    await user.selectOptions(screen.getByLabelText(/event priority/i), "urgent");

    await waitFor(() => expect(dataLayer.updateEventPriority).toHaveBeenCalledWith("event_1", "urgent"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("changes status and calls updateEventStatus", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateEventStatus).mockResolvedValue({
      success: true,
      data: makeEvent({ status: "planning" }),
    });
    const onChanged = vi.fn();

    renderEventActions({ event: makeEvent({ id: "event_1", status: "draft" }), onChanged: onChanged });

    await user.selectOptions(screen.getByLabelText(/event status/i), "planning");

    await waitFor(() => expect(dataLayer.updateEventStatus).toHaveBeenCalledWith("event_1", "planning"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("changes lifecycle stage and calls updateEventLifecycleStage", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateEventLifecycleStage).mockResolvedValue({
      success: true,
      data: makeEvent({ lifecycle_stage: "planning" }),
    });
    const onChanged = vi.fn();

    renderEventActions({ event: makeEvent({ id: "event_1", lifecycle_stage: "intake" }), onChanged });

    await user.selectOptions(screen.getByLabelText(/event lifecycle stage/i), "planning");

    await waitFor(() =>
      expect(dataLayer.updateEventLifecycleStage).toHaveBeenCalledWith("event_1", "planning"),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("archives after confirming in the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveEvent).mockResolvedValue({
      success: true,
      data: makeEvent({ status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();

    renderEventActions({ event: makeEvent({ id: "event_1" }), onChanged: onChanged });
    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive event/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveEvent).toHaveBeenCalledWith("event_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("cancels after confirming in the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.cancelEvent).mockResolvedValue({
      success: true,
      data: makeEvent({ status: "cancelled", cancelled_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();

    renderEventActions({ event: makeEvent({ id: "event_1" }), onChanged: onChanged });
    await user.click(screen.getByRole("button", { name: /cancel event/i }));
    const dialog = screen.getByRole("dialog", { name: /cancel event/i });
    await user.click(within(dialog).getByRole("button", { name: /^cancel event$/i }));

    await waitFor(() => expect(dataLayer.cancelEvent).toHaveBeenCalledWith("event_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("completes after confirming in the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.completeEvent).mockResolvedValue({
      success: true,
      data: makeEvent({ status: "completed", completed_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();

    renderEventActions({ event: makeEvent({ id: "event_1" }), onChanged: onChanged });
    await user.click(screen.getByRole("button", { name: /complete event/i }));
    const dialog = screen.getByRole("dialog", { name: /complete event/i });
    await user.click(within(dialog).getByRole("button", { name: /^complete event$/i }));

    await waitFor(() => expect(dataLayer.completeEvent).toHaveBeenCalledWith("event_1"));
    expect(onChanged).toHaveBeenCalled();
  });
});

describe("EventActions — archived event", () => {
  it("shows only Restore", () => {
    renderEventActions({
      event: makeEvent({ status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }),
      onChanged: vi.fn(),
    });

    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/event status/i)).not.toBeInTheDocument();
  });

  it("restores directly without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.restoreEvent).mockResolvedValue({
      success: true,
      data: makeEvent({ status: "planning", archived_at: null }),
    });
    const onChanged = vi.fn();

    renderEventActions({
      event: makeEvent({ id: "event_1", status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }),
      onChanged,
    });
    await user.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(dataLayer.restoreEvent).toHaveBeenCalledWith("event_1"));
    expect(onChanged).toHaveBeenCalled();
  });
});

describe("EventActions — terminal, non-archived event (completed/cancelled)", () => {
  it("hides Edit, Complete, Cancel, and the transition selects for a completed event, but keeps Archive", () => {
    renderEventActions({ event: makeEvent({ status: "completed" }), onChanged: vi.fn() });

    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel event/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/event status/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
  });

  it("hides the same controls for a cancelled event", () => {
    renderEventActions({ event: makeEvent({ status: "cancelled" }), onChanged: vi.fn() });

    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/event lifecycle stage/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
  });
});

describe("EventActions — permission gating", () => {
  it("hides Edit/Complete/Cancel/status selects for a member without events.update, while keeping Archive", () => {
    renderEventActions({ event: makeEvent({ status: "confirmed" }), onChanged: vi.fn() }, ["events.view", "events.archive"]);

    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /complete event/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/event status/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
  });

  it("hides Archive for a member without events.archive, while keeping Edit", () => {
    renderEventActions({ event: makeEvent({ status: "confirmed" }), onChanged: vi.fn() }, ["events.view", "events.update"]);

    expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
  });
});
