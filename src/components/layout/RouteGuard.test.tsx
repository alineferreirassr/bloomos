import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Full replacement (no `importActual`) — the real module transitively imports
// `@/lib/supabase/server`, which is hard-gated by the `server-only` package
// and throws outside an actual Next.js server render. `toMemberAccessState`
// is trivial enough to reimplement inline rather than pull in that chain.
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
  toMemberAccessState: (snapshot: { kind: string; permissions?: string[] }) =>
    snapshot.kind === "active" ? { kind: "active", permissions: snapshot.permissions } : { kind: snapshot.kind },
}));

import { RouteGuard } from "@/components/layout/RouteGuard";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const ownerSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.view", "team.view", "finance.view"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
});

async function renderGuard(routePath: string, snapshot: MemberSessionSnapshot) {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(snapshot);
  const element = await RouteGuard({ routePath, children: <div>Protected content</div> });
  render(element);
}

describe("RouteGuard", () => {
  it("renders the wrapped content when the member holds the route's required permission", async () => {
    await renderGuard("/finance", ownerSnapshot);

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("renders ForbiddenState instead of the wrapped content when the member lacks the permission", async () => {
    await renderGuard("/finance", { ...ownerSnapshot, permissions: ["workspace.view"] });

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText("You don't have access to this page")).toBeInTheDocument();
  });

  it("renders the wrapped content for a route with no listed requirement", async () => {
    await renderGuard("/some-unlisted-route", { ...ownerSnapshot, permissions: [] });

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
