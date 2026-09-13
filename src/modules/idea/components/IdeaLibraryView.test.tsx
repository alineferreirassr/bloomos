import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/idea/ideaActions", () => ({
  listIdeaItemsAction: vi.fn(),
  createIdeaItemAction: vi.fn(),
  archiveIdeaItemAction: vi.fn(),
  unarchiveIdeaItemAction: vi.fn(),
}));

import { listIdeaItemsAction, createIdeaItemAction, archiveIdeaItemAction } from "@/modules/idea/ideaActions";
import { IdeaLibraryView } from "@/modules/idea/components/IdeaLibraryView";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { IdeaItem } from "@/types/ideaItem";

const writerSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["social.view", "social.create"],
  workspaceDisplayName: "Amoré Bloom",
};

const readOnlySnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = { ...writerSnapshot, permissions: ["social.view"] };

function item(overrides: Partial<IdeaItem> = {}): IdeaItem {
  return {
    id: "idea_1",
    workspace_id: "ws_1",
    title: "Behind the scenes at a spring wedding",
    description: "A short reel following setup to first dance.",
    status: "active",
    source_inspiration_id: null,
    content_format: "reel",
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    media_asset_id: null,
    priority: "high",
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

function renderView(snapshot: MemberSessionSnapshot = writerSnapshot) {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <IdeaLibraryView />
    </MemberSessionProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("IdeaLibraryView — loading / empty / populated / error", () => {
  it("shows a loading skeleton before the fetch resolves, with no ready-state content yet", () => {
    vi.mocked(listIdeaItemsAction).mockReturnValue(new Promise(() => {}));
    renderView();
    expect(screen.getByText("Ideas")).toBeInTheDocument();
    expect(screen.queryByText("No Ideas yet")).not.toBeInTheDocument();
  });

  it("shows an intentional empty state with a New Idea CTA when there are zero ideas and the caller can create", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    expect(await screen.findByText("No Ideas yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New Idea" }).length).toBeGreaterThan(0);
  });

  it("shows the empty state with no write CTA for a read-only viewer", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView(readOnlySnapshot);
    expect(await screen.findByText("No Ideas yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Idea" })).not.toBeInTheDocument();
  });

  it("renders cards for a populated library", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [item(), item({ id: "idea_2", title: "Studio tour walkthrough" })] });
    renderView();
    expect(await screen.findByText("Behind the scenes at a spring wedding")).toBeInTheDocument();
    expect(screen.getByText("Studio tour walkthrough")).toBeInTheDocument();
  });

  it("shows a controlled error state, never a raw exception, with a working retry", async () => {
    vi.mocked(listIdeaItemsAction)
      .mockResolvedValueOnce({ success: false, error: "Could not load Ideas." })
      .mockResolvedValueOnce({ success: true, data: [item()] });
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("We couldn't load your Ideas library.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Behind the scenes at a spring wedding")).toBeInTheDocument();
  });
});

describe("IdeaLibraryView — permissions", () => {
  it("shows the New Idea action in the page header for a member with social.create", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(writerSnapshot);
    await screen.findByText("Behind the scenes at a spring wedding");
    expect(screen.getByRole("button", { name: "New Idea" })).toBeInTheDocument();
  });

  it("hides the New Idea action for a read-only member", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(readOnlySnapshot);
    await screen.findByText("Behind the scenes at a spring wedding");
    expect(screen.queryByRole("button", { name: "New Idea" })).not.toBeInTheDocument();
  });

  it("still renders the library for a read-only member — reading is protected by social.view, not hidden entirely", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(readOnlySnapshot);
    expect(await screen.findByText("Behind the scenes at a spring wedding")).toBeInTheDocument();
  });
});

describe("IdeaLibraryView — search and filters", () => {
  it("calls the backend list action with the search term, never filtering an already-loaded list client-side", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listIdeaItemsAction).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText("Search Ideas"), "wedding");
    await waitFor(() => expect(listIdeaItemsAction).toHaveBeenCalledWith(expect.objectContaining({ search: "wedding" })), { timeout: 2000 });
  });

  it("defaults to Active and can switch to Archived and All", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listIdeaItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "active" })));

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "archived");
    await waitFor(() => expect(listIdeaItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "archived" })), { timeout: 2000 });

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "all");
    await waitFor(() => expect(listIdeaItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "all" })), { timeout: 2000 });
  });

  it("never passes a workspace id from the browser — the action derives it from the session itself", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    await waitFor(() => expect(listIdeaItemsAction).toHaveBeenCalled());
    const call = vi.mocked(listIdeaItemsAction).mock.calls[0][0] as Record<string, unknown> | undefined;
    expect(call).not.toHaveProperty("workspaceId");
    expect(call).not.toHaveProperty("workspace_id");
  });

  it("exposes no tag filter — tag persistence remains deferred", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    await screen.findByText("No Ideas yet");
    expect(screen.queryByLabelText(/tag/i)).not.toBeInTheDocument();
  });
});

describe("IdeaLibraryView — Add flow refreshes the library", () => {
  it("reloads the list after a successful create", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createIdeaItemAction).mockResolvedValue({
      success: true,
      data: item({ id: "idea_new", title: "Fresh idea", description: "A brand new concept." }),
    });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("No Ideas yet");
    const initialCalls = vi.mocked(listIdeaItemsAction).mock.calls.length;

    await user.click(screen.getAllByRole("button", { name: "New Idea" })[0]);
    const dialog = screen.getByRole("dialog", { name: "New Idea" });
    await user.type(screen.getByLabelText("Title"), "Fresh idea");
    await user.type(screen.getByLabelText("Description"), "A brand new concept.");
    await user.click(screen.getByRole("button", { name: "Create Idea" }));
    void dialog;

    await waitFor(() => expect(vi.mocked(listIdeaItemsAction).mock.calls.length).toBeGreaterThan(initialCalls));
  });
});

describe("IdeaLibraryView — card open and archive", () => {
  it("opens the detail dialog when a card is clicked, and archiving refreshes the library", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [item()] });
    vi.mocked(archiveIdeaItemAction).mockResolvedValue({ success: true, data: item({ archived_at: "2026-09-21T00:00:00Z", status: "archived" }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("Behind the scenes at a spring wedding");
    const callsBeforeOpen = vi.mocked(listIdeaItemsAction).mock.calls.length;

    await user.click(screen.getByRole("button", { name: /Behind the scenes at a spring wedding/ }));
    expect(screen.getByRole("dialog", { name: "Behind the scenes at a spring wedding" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveIdeaItemAction).toHaveBeenCalledWith("idea_1");
    await waitFor(() => expect(vi.mocked(listIdeaItemsAction).mock.calls.length).toBeGreaterThan(callsBeforeOpen));
  });

  it("has no Edit entry point from the card or detail dialog in this checkpoint", async () => {
    vi.mocked(listIdeaItemsAction).mockResolvedValue({ success: true, data: [item()] });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("Behind the scenes at a spring wedding");
    await user.click(screen.getByRole("button", { name: /Behind the scenes at a spring wedding/ }));
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
