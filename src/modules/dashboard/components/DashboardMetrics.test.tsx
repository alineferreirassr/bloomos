import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getDashboardMetrics: vi.fn(),
  getWorkspaceInvitations: vi.fn(),
}));

import { DashboardMetrics } from "@/modules/dashboard/components/DashboardMetrics";
import { getDashboardMetrics } from "@/lib/data";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const metrics = [
  { label: "Leads", value: "3", href: "/leads" },
  { label: "Total Invoiced", value: "$1,000", href: "/finance" },
  { label: "Total Documents", value: "5", href: "/documents" },
];

function snapshotWithPermissions(permissions: string[]): MemberSessionSnapshot {
  return {
    kind: "active",
    user: { id: "user_1", email: "owner@amorebloom.com" },
    profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
    workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
    membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: permissions as never,
    workspaceDisplayName: "Amoré Bloom",
  };
}

describe("DashboardMetrics", () => {
  it("renders every metric card for a member with every underlying *.view permission", async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue(metrics);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["leads.view", "finance.view", "documents.view"])}>
        <DashboardMetrics />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("Leads")).toBeInTheDocument());
    expect(screen.getByText("Total Invoiced")).toBeInTheDocument();
    expect(screen.getByText("Total Documents")).toBeInTheDocument();
  });

  it("hides the Finance card for a member without finance.view, without hiding unrelated cards", async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue(metrics);

    render(
      <MemberSessionProvider snapshot={snapshotWithPermissions(["leads.view", "documents.view"])}>
        <DashboardMetrics />
      </MemberSessionProvider>,
    );

    await waitFor(() => expect(screen.getByText("Leads")).toBeInTheDocument());
    expect(screen.queryByText("Total Invoiced")).not.toBeInTheDocument();
    expect(screen.getByText("Total Documents")).toBeInTheDocument();
  });
});
