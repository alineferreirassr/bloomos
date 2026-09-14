import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/script/scriptActions", () => ({
  listScriptItemsAction: vi.fn(),
  createScriptItemAction: vi.fn(),
  archiveScriptItemAction: vi.fn(),
  unarchiveScriptItemAction: vi.fn(),
  updateScriptItemAction: vi.fn(),
  createScriptVersionAction: vi.fn(),
  listScriptVersionsAction: vi.fn(),
  listScriptBlocksAction: vi.fn(),
  createScriptBlockAction: vi.fn(),
  updateScriptBlockAction: vi.fn(),
  removeScriptBlockAction: vi.fn(),
}));
vi.mock("@/modules/idea/ideaActions", () => ({
  getIdeaItemAction: vi.fn(),
  listIdeaItemsAction: vi.fn(),
}));

import { listScriptItemsAction, createScriptItemAction, archiveScriptItemAction, listScriptVersionsAction } from "@/modules/script/scriptActions";
import { ScriptLibraryView } from "@/modules/script/components/ScriptLibraryView";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { ScriptItem } from "@/types/scriptItem";

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

function item(overrides: Partial<ScriptItem> = {}): ScriptItem {
  return {
    id: "script_1",
    workspace_id: "ws_1",
    title: "Spring wedding behind-the-scenes",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-22T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

function renderView(snapshot: MemberSessionSnapshot = writerSnapshot) {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <ScriptLibraryView />
    </MemberSessionProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ScriptLibraryView — loading / empty / populated / error", () => {
  it("shows a loading skeleton before the fetch resolves, with no ready-state content yet", () => {
    vi.mocked(listScriptItemsAction).mockReturnValue(new Promise(() => {}));
    renderView();
    expect(screen.getByText("Scripts")).toBeInTheDocument();
    expect(screen.queryByText("No Scripts yet")).not.toBeInTheDocument();
  });

  it("shows an intentional empty state with a New Script CTA when there are zero Scripts and the caller can create", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    expect(await screen.findByText("No Scripts yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New Script" }).length).toBeGreaterThan(0);
  });

  it("shows the empty state with no write CTA for a read-only viewer", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView(readOnlySnapshot);
    expect(await screen.findByText("No Scripts yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Script" })).not.toBeInTheDocument();
  });

  it("renders cards for a populated library", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [item(), item({ id: "script_2", title: "Studio tour walkthrough" })] });
    renderView();
    expect(await screen.findByText("Spring wedding behind-the-scenes")).toBeInTheDocument();
    expect(screen.getByText("Studio tour walkthrough")).toBeInTheDocument();
  });

  it("shows a controlled error state, never a raw exception, with a working retry", async () => {
    vi.mocked(listScriptItemsAction)
      .mockResolvedValueOnce({ success: false, error: "Could not load Scripts." })
      .mockResolvedValueOnce({ success: true, data: [item()] });
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("We couldn't load your Scripts library.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Spring wedding behind-the-scenes")).toBeInTheDocument();
  });
});

describe("ScriptLibraryView — permissions", () => {
  it("shows the New Script action for a member with social.create", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(writerSnapshot);
    await screen.findByText("Spring wedding behind-the-scenes");
    expect(screen.getByRole("button", { name: "New Script" })).toBeInTheDocument();
  });

  it("hides the New Script action for a read-only member", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(readOnlySnapshot);
    await screen.findByText("Spring wedding behind-the-scenes");
    expect(screen.queryByRole("button", { name: "New Script" })).not.toBeInTheDocument();
  });

  it("still renders the library for a read-only member — reading is protected by social.view, not hidden entirely", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(readOnlySnapshot);
    expect(await screen.findByText("Spring wedding behind-the-scenes")).toBeInTheDocument();
  });
});

describe("ScriptLibraryView — search and filters", () => {
  it("calls the backend list action with the search term, never filtering an already-loaded list client-side", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText("Search Scripts"), "wedding");
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalledWith(expect.objectContaining({ search: "wedding" })), { timeout: 2000 });
  });

  it("defaults to Active and can switch to Archived and All", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "active" })));

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "archived");
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "archived" })), { timeout: 2000 });

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "all");
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "all" })), { timeout: 2000 });
  });

  it("never passes a workspace id from the browser — the action derives it from the session itself", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalled());
    const call = vi.mocked(listScriptItemsAction).mock.calls[0][0] as Record<string, unknown> | undefined;
    expect(call).not.toHaveProperty("workspaceId");
    expect(call).not.toHaveProperty("workspace_id");
  });
});

describe("ScriptLibraryView — Add flow refreshes the library", () => {
  it("reloads the list after a successful create", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createScriptItemAction).mockResolvedValue({ success: true, data: item({ id: "script_new", title: "Fresh script" }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("No Scripts yet");
    const initialCalls = vi.mocked(listScriptItemsAction).mock.calls.length;

    await user.click(screen.getAllByRole("button", { name: "New Script" })[0]);
    await user.type(screen.getByLabelText("Title"), "Fresh script");
    await user.click(screen.getByRole("button", { name: "Create Script" }));

    await waitFor(() => expect(vi.mocked(listScriptItemsAction).mock.calls.length).toBeGreaterThan(initialCalls));
  });
});

describe("ScriptLibraryView — card open and archive", () => {
  it("opens the detail dialog when a card is clicked, and archiving refreshes the library", async () => {
    vi.mocked(listScriptItemsAction).mockResolvedValue({ success: true, data: [item()] });
    vi.mocked(listScriptVersionsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(archiveScriptItemAction).mockResolvedValue({ success: true, data: item({ archived_at: "2026-09-23T00:00:00Z", status: "archived" }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("Spring wedding behind-the-scenes");
    const callsBeforeOpen = vi.mocked(listScriptItemsAction).mock.calls.length;

    await user.click(screen.getByRole("button", { name: /Spring wedding behind-the-scenes/ }));
    expect(await screen.findByRole("dialog", { name: "Spring wedding behind-the-scenes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveScriptItemAction).toHaveBeenCalledWith("script_1");
    await waitFor(() => expect(vi.mocked(listScriptItemsAction).mock.calls.length).toBeGreaterThan(callsBeforeOpen));
  });
});

describe("SOCIAL-08D hardening — out-of-order response protection", () => {
  it("never lets an older, slower request overwrite a newer request's result", async () => {
    type ListResult = Awaited<ReturnType<typeof listScriptItemsAction>>;
    let resolveFirst!: (value: ListResult) => void;
    let resolveSecond!: (value: ListResult) => void;
    const firstRequest = new Promise<ListResult>((resolve) => {
      resolveFirst = resolve;
    });
    const secondRequest = new Promise<ListResult>((resolve) => {
      resolveSecond = resolve;
    });

    vi.mocked(listScriptItemsAction)
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest);
    const user = userEvent.setup();
    renderView();
    await screen.findByText("No Scripts yet");
    expect(listScriptItemsAction).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText("Search Scripts"), "x");
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalledTimes(2), { timeout: 2000 });

    await user.clear(screen.getByLabelText("Search Scripts"));
    await user.type(screen.getByLabelText("Search Scripts"), "y");
    await waitFor(() => expect(listScriptItemsAction).toHaveBeenCalledTimes(3), { timeout: 2000 });

    resolveSecond({ success: true, data: [item({ id: "script_2", title: "Second, newer result" })] });
    await screen.findByText("Second, newer result");

    resolveFirst({ success: true, data: [item({ id: "script_1", title: "First, stale result" })] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText("First, stale result")).not.toBeInTheDocument();
    expect(screen.getByText("Second, newer result")).toBeInTheDocument();
  });
});
