import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamOperationsView } from "@/modules/operations/components/TeamOperationsView";
import { makeEvent } from "@/modules/events/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const snapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "jordan@amorebloom.com" },
  profile: { full_name: "Jordan Ellis", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "team.view"],
  workspaceDisplayName: "Amoré Bloom",
};

vi.mock("@/lib/data", () => ({
  getEvents: vi.fn(),
  getChecklistByEventId: vi.fn(),
  getTimelineByEventId: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function renderView() {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <TeamOperationsView />
    </MemberSessionProvider>,
  );
}

describe("TeamOperationsView", () => {
  it("shows only events assigned to the signed-in member by full name", async () => {
    vi.mocked(dataLayer.getEvents).mockResolvedValue([
      makeEvent({ id: "event_1", title: "My Event", assigned_owner: "Jordan Ellis", status: "confirmed" }),
      makeEvent({ id: "event_2", title: "Someone Else's Event", assigned_owner: "Casey Rivera", status: "confirmed" }),
    ]);
    vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByEventId).mockResolvedValue([]);

    renderView();

    expect(await screen.findByText("Team Operations")).toBeInTheDocument();
    expect(screen.queryByText("Someone Else's Event")).not.toBeInTheDocument();
  });

  it("shows an error state and allows retry", async () => {
    vi.mocked(dataLayer.getEvents).mockRejectedValue(new Error("boom"));

    renderView();

    expect(await screen.findByText(/could not load your team operations view/i)).toBeInTheDocument();
  });
});
