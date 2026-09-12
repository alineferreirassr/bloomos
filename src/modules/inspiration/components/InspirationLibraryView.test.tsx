import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(),
}));
vi.mock("@/modules/inspiration/inspirationActions", () => ({
  listInspirationItemsAction: vi.fn(),
  createInspirationItemAction: vi.fn(),
  archiveInspirationItemAction: vi.fn(),
  unarchiveInspirationItemAction: vi.fn(),
}));

import {
  listInspirationItemsAction,
  createInspirationItemAction,
  archiveInspirationItemAction,
} from "@/modules/inspiration/inspirationActions";
import { InspirationLibraryView } from "@/modules/inspiration/components/InspirationLibraryView";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { InspirationItem } from "@/types/inspirationItem";

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

function item(overrides: Partial<InspirationItem> = {}): InspirationItem {
  return {
    id: "insp_1",
    workspace_id: "ws_1",
    title: "Behind the Scenes at a Wedding",
    source_type: "instagram",
    source_url: "https://instagram.com/reel/abc",
    normalized_source_url: "https://instagram.com/reel/abc",
    creator_name: "Jane Doe",
    creator_handle: "janedoe",
    platform_content_id: null,
    content_format: "reel",
    hook: "Open on the veil catching the wind.",
    cta: null,
    why_it_works: null,
    notes: null,
    duration_seconds: null,
    published_at: null,
    media_asset_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

function renderView(snapshot: MemberSessionSnapshot = writerSnapshot) {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <InspirationLibraryView />
    </MemberSessionProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("InspirationLibraryView — loading / empty / populated / error", () => {
  it("shows a loading skeleton before the fetch resolves, with no ready-state content yet", () => {
    vi.mocked(listInspirationItemsAction).mockReturnValue(new Promise(() => {}));
    renderView();
    expect(screen.getByText("Inspiration")).toBeInTheDocument();
    expect(screen.queryByText("No Inspiration saved yet")).not.toBeInTheDocument();
  });

  it("shows an intentional empty state with an Add CTA when there are zero references and the caller can create", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    expect(await screen.findByText("No Inspiration saved yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add Inspiration" }).length).toBeGreaterThan(0);
  });

  it("shows the empty state with no write CTA for a read-only viewer", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView(readOnlySnapshot);
    expect(await screen.findByText("No Inspiration saved yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Inspiration" })).not.toBeInTheDocument();
  });

  it("renders cards for a populated library", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [item(), item({ id: "insp_2", title: "Studio Tour" })] });
    renderView();
    expect(await screen.findByText("Behind the Scenes at a Wedding")).toBeInTheDocument();
    expect(screen.getByText("Studio Tour")).toBeInTheDocument();
  });

  it("shows a controlled error state, never a raw exception, with a working retry", async () => {
    vi.mocked(listInspirationItemsAction)
      .mockResolvedValueOnce({ success: false, error: "Could not load Inspiration items." })
      .mockResolvedValueOnce({ success: true, data: [item()] });
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("We couldn't load your Inspiration library.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Behind the Scenes at a Wedding")).toBeInTheDocument();
  });
});

describe("InspirationLibraryView — permissions", () => {
  it("shows the Add Inspiration action in the page header for a member with social.create", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(writerSnapshot);
    await screen.findByText("Behind the Scenes at a Wedding");
    expect(screen.getByRole("button", { name: "Add Inspiration" })).toBeInTheDocument();
  });

  it("hides the Add Inspiration action for a read-only member", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(readOnlySnapshot);
    await screen.findByText("Behind the Scenes at a Wedding");
    expect(screen.queryByRole("button", { name: "Add Inspiration" })).not.toBeInTheDocument();
  });
});

describe("InspirationLibraryView — search and filters", () => {
  it("calls the backend list action with the search term, never filtering an already-loaded list client-side", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText("Search Inspiration"), "wedding");
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledWith(expect.objectContaining({ search: "wedding" })), { timeout: 2000 });
  });

  it("calls the backend with the selected source filter", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText("Filter by source"), "tiktok");
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledWith(expect.objectContaining({ sourceType: "tiktok" })), { timeout: 2000 });
  });

  it("calls the backend with the selected content format filter", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText("Filter by content format"), "carousel");
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledWith(expect.objectContaining({ contentFormat: "carousel" })), { timeout: 2000 });
  });

  it("defaults to Active and can switch to Archived and All", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "active" })));

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "archived");
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "archived" })), { timeout: 2000 });

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "all");
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "all" })), { timeout: 2000 });
  });

  it("never passes a workspace id from the browser — the action derives it from the session itself", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    await waitFor(() => expect(listInspirationItemsAction).toHaveBeenCalled());
    const call = vi.mocked(listInspirationItemsAction).mock.calls[0][0] as Record<string, unknown> | undefined;
    expect(call).not.toHaveProperty("workspaceId");
    expect(call).not.toHaveProperty("workspace_id");
  });

  it("exposes no tag filter — tag persistence remains deferred", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    await screen.findByText("No Inspiration saved yet");
    expect(screen.queryByLabelText(/tag/i)).not.toBeInTheDocument();
  });
});

describe("InspirationLibraryView — Add flow refreshes the library", () => {
  it("reloads the list after a successful create", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createInspirationItemAction).mockResolvedValue({ success: true, data: item({ id: "insp_new", title: "Fresh idea" }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("No Inspiration saved yet");
    const initialCalls = vi.mocked(listInspirationItemsAction).mock.calls.length;

    await user.click(screen.getAllByRole("button", { name: "Add Inspiration" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Add Inspiration" });
    await user.type(within(dialog).getByLabelText("Title"), "Fresh idea");
    await user.click(within(dialog).getByRole("button", { name: "Add Inspiration" }));

    await waitFor(() => expect(vi.mocked(listInspirationItemsAction).mock.calls.length).toBeGreaterThan(initialCalls));
  });
});

describe("InspirationLibraryView — card open and archive", () => {
  it("opens the detail dialog when a card is clicked, and archiving refreshes the library", async () => {
    vi.mocked(listInspirationItemsAction).mockResolvedValue({ success: true, data: [item()] });
    vi.mocked(archiveInspirationItemAction).mockResolvedValue({ success: true, data: item({ archived_at: "2026-09-05T00:00:00Z" }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("Behind the Scenes at a Wedding");
    const callsBeforeOpen = vi.mocked(listInspirationItemsAction).mock.calls.length;

    await user.click(screen.getByRole("button", { name: /Behind the Scenes at a Wedding/ }));
    expect(screen.getByRole("dialog", { name: "Behind the Scenes at a Wedding" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveInspirationItemAction).toHaveBeenCalledWith("insp_1");
    await waitFor(() => expect(vi.mocked(listInspirationItemsAction).mock.calls.length).toBeGreaterThan(callsBeforeOpen));
  });
});
