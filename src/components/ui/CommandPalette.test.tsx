import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { registerCommand, resetCommandRegistry } from "@/core/commandPalette/registry";
import { searchAction } from "@/modules/search/searchActions";

// `searchAction` is a "use server" export — importing the real module here would
// pull in `resolveMemberSessionSnapshot()`'s server-only Supabase chain, which
// `server-only` guards against outside a real Next.js Server Action boundary.
// Mocked the same way every other client-View test in this codebase mocks its
// own `*Actions.ts` module (see e.g. `CalendarDashboardView.test.tsx`).
vi.mock("@/modules/search/searchActions", () => ({
  searchAction: vi.fn(),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    resetCommandRegistry();
  });

  it("is closed by default", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on mod+k and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the empty state when no commands are registered", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByText("No commands yet.")).toBeInTheDocument();
  });

  it("lists a registered command and runs it on click, then closes", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    registerCommand({ id: "new-lead", label: "New Lead", group: "Leads", run });

    render(<CommandPalette />);
    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByRole("button", { name: /New Lead/ }));

    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters commands as the user types", async () => {
    const user = userEvent.setup();
    registerCommand({ id: "new-lead", label: "New Lead", group: "Leads", run: vi.fn() });
    registerCommand({ id: "new-event", label: "New Event", group: "Events", run: vi.fn() });

    render(<CommandPalette />);
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByLabelText("Search or run a command"), "lead");

    expect(screen.getByRole("button", { name: /New Lead/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Event/ })).not.toBeInTheDocument();
  });

  it("skips search entirely with no workspaceId", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByLabelText("Search or run a command"), "anything");

    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("calls the permission-aware searchAction (not a second, unfiltered search path) once a workspaceId is given", async () => {
    vi.mocked(searchAction).mockResolvedValue({
      success: true,
      data: [{ entityType: "client", entityId: "client_1", title: "Naomi Whitfield", route: "/clients/client_1" }],
    });

    const user = userEvent.setup();
    render(<CommandPalette workspaceId="ws_1" />);
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByLabelText("Search or run a command"), "naomi");

    expect(await screen.findByRole("link", { name: /Naomi Whitfield/ })).toBeInTheDocument();
    expect(searchAction).toHaveBeenCalledWith("naomi");
  });

  it("shows a link to view all results in Global Search once a query is typed", async () => {
    vi.mocked(searchAction).mockResolvedValue({ success: true, data: [] });

    const user = userEvent.setup();
    render(<CommandPalette workspaceId="ws_1" />);
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByLabelText("Search or run a command"), "naomi");

    expect(await screen.findByRole("link", { name: /View all results in Global Search/ })).toHaveAttribute("href", "/search/results?q=naomi");
  });
});
