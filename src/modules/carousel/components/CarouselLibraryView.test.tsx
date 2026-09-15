import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/carousel/carouselActions", () => ({
  listCarouselItemsAction: vi.fn(),
  createCarouselItemAction: vi.fn(),
  archiveCarouselItemAction: vi.fn(),
  unarchiveCarouselItemAction: vi.fn(),
  updateCarouselItemAction: vi.fn(),
  listCarouselSlidesAction: vi.fn(),
  createCarouselSlideAction: vi.fn(),
  updateCarouselSlideAction: vi.fn(),
  removeCarouselSlideAction: vi.fn(),
  listCarouselMediaAssetOptionsAction: vi.fn(),
}));
vi.mock("@/modules/idea/ideaActions", () => ({
  getIdeaItemAction: vi.fn(),
  listIdeaItemsAction: vi.fn(),
}));

import { listCarouselItemsAction, createCarouselItemAction, archiveCarouselItemAction, listCarouselSlidesAction } from "@/modules/carousel/carouselActions";
import { CarouselLibraryView } from "@/modules/carousel/components/CarouselLibraryView";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { CarouselItem } from "@/types/carouselItem";

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

function item(overrides: Partial<CarouselItem> = {}): CarouselItem {
  return {
    id: "carousel_1",
    workspace_id: "ws_1",
    title: "Autumn wedding carousel",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "user_1",
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

function renderView(snapshot: MemberSessionSnapshot = writerSnapshot) {
  return render(
    <MemberSessionProvider snapshot={snapshot}>
      <CarouselLibraryView />
    </MemberSessionProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("CarouselLibraryView — loading / empty / populated / error", () => {
  it("shows a loading skeleton before the fetch resolves, with no ready-state content yet", () => {
    vi.mocked(listCarouselItemsAction).mockReturnValue(new Promise(() => {}));
    renderView();
    expect(screen.getByText("Carousels")).toBeInTheDocument();
    expect(screen.queryByText("No Carousels yet")).not.toBeInTheDocument();
  });

  it("shows an intentional empty state with a New Carousel CTA when there are zero Carousels and the caller can create", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    expect(await screen.findByText("No Carousels yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New Carousel" }).length).toBeGreaterThan(0);
  });

  it("shows the empty state with no write CTA for a read-only viewer", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView(readOnlySnapshot);
    expect(await screen.findByText("No Carousels yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Carousel" })).not.toBeInTheDocument();
  });

  it("renders cards for a populated library", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [item(), item({ id: "carousel_2", title: "Studio tour carousel" })] });
    renderView();
    expect(await screen.findByText("Autumn wedding carousel")).toBeInTheDocument();
    expect(screen.getByText("Studio tour carousel")).toBeInTheDocument();
  });

  it("shows a controlled error state, never a raw exception, with a working retry", async () => {
    vi.mocked(listCarouselItemsAction)
      .mockResolvedValueOnce({ success: false, error: "Could not load Carousels." })
      .mockResolvedValueOnce({ success: true, data: [item()] });
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("We couldn't load your Carousels library.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Autumn wedding carousel")).toBeInTheDocument();
  });
});

describe("CarouselLibraryView — permissions", () => {
  it("shows the New Carousel action for a member with social.create", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(writerSnapshot);
    await screen.findByText("Autumn wedding carousel");
    expect(screen.getByRole("button", { name: "New Carousel" })).toBeInTheDocument();
  });

  it("hides the New Carousel action for a read-only member", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(readOnlySnapshot);
    await screen.findByText("Autumn wedding carousel");
    expect(screen.queryByRole("button", { name: "New Carousel" })).not.toBeInTheDocument();
  });

  it("still renders the library for a read-only member — reading is protected by social.view, not hidden entirely", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [item()] });
    renderView(readOnlySnapshot);
    expect(await screen.findByText("Autumn wedding carousel")).toBeInTheDocument();
  });
});

describe("CarouselLibraryView — search and filters", () => {
  it("calls the backend list action with the search term, never filtering an already-loaded list client-side", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText("Search Carousels"), "wedding");
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalledWith(expect.objectContaining({ search: "wedding" })), { timeout: 2000 });
  });

  it("defaults to Active and can switch to Archived and All", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "active" })));

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "archived");
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "archived" })), { timeout: 2000 });

    await user.selectOptions(screen.getByLabelText("Filter by archive state"), "all");
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalledWith(expect.objectContaining({ archived: "all" })), { timeout: 2000 });
  });

  it("never passes a workspace id from the browser — the action derives it from the session itself", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [] });
    renderView();
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalled());
    const call = vi.mocked(listCarouselItemsAction).mock.calls[0][0] as Record<string, unknown> | undefined;
    expect(call).not.toHaveProperty("workspaceId");
    expect(call).not.toHaveProperty("workspace_id");
  });
});

describe("CarouselLibraryView — Add flow refreshes the library", () => {
  it("reloads the list after a successful create", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(createCarouselItemAction).mockResolvedValue({ success: true, data: item({ id: "carousel_new", title: "Fresh carousel" }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("No Carousels yet");
    const initialCalls = vi.mocked(listCarouselItemsAction).mock.calls.length;

    await user.click(screen.getAllByRole("button", { name: "New Carousel" })[0]);
    await user.type(screen.getByLabelText("Title"), "Fresh carousel");
    await user.click(screen.getByRole("button", { name: "Create Carousel" }));

    await waitFor(() => expect(vi.mocked(listCarouselItemsAction).mock.calls.length).toBeGreaterThan(initialCalls));
  });
});

describe("CarouselLibraryView — card open and archive", () => {
  it("opens the detail dialog when a card is clicked, and archiving refreshes the library", async () => {
    vi.mocked(listCarouselItemsAction).mockResolvedValue({ success: true, data: [item()] });
    vi.mocked(listCarouselSlidesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(archiveCarouselItemAction).mockResolvedValue({ success: true, data: item({ archived_at: "2026-09-24T00:00:00Z", status: "archived" }) });
    const user = userEvent.setup();
    renderView();

    await screen.findByText("Autumn wedding carousel");
    const callsBeforeOpen = vi.mocked(listCarouselItemsAction).mock.calls.length;

    await user.click(screen.getByRole("button", { name: /Autumn wedding carousel/ }));
    expect(await screen.findByRole("dialog", { name: "Autumn wedding carousel" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(archiveCarouselItemAction).toHaveBeenCalledWith("carousel_1");
    await waitFor(() => expect(vi.mocked(listCarouselItemsAction).mock.calls.length).toBeGreaterThan(callsBeforeOpen));
  });
});

describe("SOCIAL-10E hardening — out-of-order response protection", () => {
  it("never lets an older, slower request overwrite a newer request's result", async () => {
    type ListResult = Awaited<ReturnType<typeof listCarouselItemsAction>>;
    let resolveFirst!: (value: ListResult) => void;
    let resolveSecond!: (value: ListResult) => void;
    const firstRequest = new Promise<ListResult>((resolve) => {
      resolveFirst = resolve;
    });
    const secondRequest = new Promise<ListResult>((resolve) => {
      resolveSecond = resolve;
    });

    vi.mocked(listCarouselItemsAction)
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest);
    const user = userEvent.setup();
    renderView();
    await screen.findByText("No Carousels yet");
    expect(listCarouselItemsAction).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText("Search Carousels"), "x");
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalledTimes(2), { timeout: 2000 });

    await user.clear(screen.getByLabelText("Search Carousels"));
    await user.type(screen.getByLabelText("Search Carousels"), "y");
    await waitFor(() => expect(listCarouselItemsAction).toHaveBeenCalledTimes(3), { timeout: 2000 });

    resolveSecond({ success: true, data: [item({ id: "carousel_2", title: "Second, newer result" })] });
    await screen.findByText("Second, newer result");

    resolveFirst({ success: true, data: [item({ id: "carousel_1", title: "First, stale result" })] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText("First, stale result")).not.toBeInTheDocument();
    expect(screen.getByText("Second, newer result")).toBeInTheDocument();
  });
});
