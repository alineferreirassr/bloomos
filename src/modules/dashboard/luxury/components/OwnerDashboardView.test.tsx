import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
}));
// ProfileMenu (signOut Server Action) and OwnerAIBriefCard
// (generateDailyOperationsBrief Server Action, itself pulling in a deep AI
// Skills/Memory import graph) both transitively reach server-only-gated
// modules (@/lib/supabase/server, next/headers) several layers down. Neither
// is part of what this test verifies — the greeting/time-of-day/first-name
// behavior lives entirely in the header above them — so they're stubbed out
// here rather than chased through every transitive import.
vi.mock("@/modules/dashboard/luxury/components/ProfileMenu", () => ({
  ProfileMenu: () => null,
}));
vi.mock("@/modules/dashboard/luxury/components/OwnerAIBriefCard", () => ({
  OwnerAIBriefCard: () => null,
}));

import { OwnerDashboardView } from "@/modules/dashboard/luxury/components/OwnerDashboardView";
import type { OwnerDashboardData } from "@/modules/dashboard/luxury/getOwnerDashboardData";
import type { LuxuryBranding } from "@/modules/dashboard/luxury/components/LuxuryDashboardShell";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const branding: LuxuryBranding = { logoUrl: null, brandName: "Amoré Bloom", tagline: "", inspirationalMessage: "" };

// LuxurySidebar (rendered inside LuxuryDashboardShell) reads useMemberSession()
// to filter nav items — same MemberSessionProvider wrapping precedent as
// MobileNav.test.tsx.
const ownerSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Aline Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: [],
  workspaceDisplayName: "Amoré Bloom",
};

function data(overrides: Partial<OwnerDashboardData> = {}): OwnerDashboardData {
  return {
    welcome: { greeting: "Good evening, there", subtitle: "Here's what's happening across Amoré Bloom today." },
    firstName: "there",
    metrics: [],
    upcomingEvents: [],
    weekAgenda: [],
    priorities: [],
    revenueSeries: [],
    recentMessages: [],
    teamActivity: [],
    notificationCount: 0,
    messageCount: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OwnerDashboardView", () => {
  it("corrects the server-guessed greeting to the visitor's own local time of day + real first name once mounted", () => {
    // The server (Vercel/Node clock) guessed "evening" and had no name — the
    // exact bug this test guards against. The browser's own clock says 9am.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0));

    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <OwnerDashboardView data={data({ welcome: { greeting: "Good evening, there", subtitle: "x" }, firstName: "Aline" })} branding={branding} profileName="Aline Ferreira" profileRoleLabel="Owner" profileAvatarUrl={null} />
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Good morning, Aline")).toBeInTheDocument();
    expect(screen.queryByText("Good evening, there")).not.toBeInTheDocument();
  });

  it("falls back to 'there' when no profile name is available, without hardcoding a name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 15, 0));

    render(
      <MemberSessionProvider snapshot={ownerSnapshot}>
        <OwnerDashboardView data={data({ firstName: "there" })} branding={branding} profileName="there" profileRoleLabel="Owner" profileAvatarUrl={null} />
      </MemberSessionProvider>,
    );

    expect(screen.getByText("Good afternoon, there")).toBeInTheDocument();
  });
});
