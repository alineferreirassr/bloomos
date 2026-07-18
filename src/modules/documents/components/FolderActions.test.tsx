import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderActions } from "@/modules/documents/components/FolderActions";
import { makeDocumentFolder } from "@/modules/documents/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.view", "documents.create", "documents.update", "documents.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderFolderActions(props: Parameters<typeof FolderActions>[0]) {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <FolderActions {...props} />
    </MemberSessionProvider>,
  );
}

vi.mock("@/lib/data", () => ({
  archiveDocumentFolder: vi.fn(),
  restoreDocumentFolder: vi.fn(),
  createDocumentFolder: vi.fn(),
  updateDocumentFolder: vi.fn(),
  getDocumentFolders: vi.fn(),
  applyDefaultFolderTemplate: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("FolderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLayer.getDocumentFolders).mockResolvedValue([]);
  });

  it("shows Add Subfolder, Rename, Move, Apply Default Template, and Archive for an active folder", () => {
    renderFolderActions({ folder: makeDocumentFolder(), childCount: 0, onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /add subfolder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^rename$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^move$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply default template/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
  });

  it("shows only Restore for an archived folder", () => {
    renderFolderActions({
      folder: makeDocumentFolder({ archived_at: "2026-01-01T00:00:00.000Z" }),
      childCount: 0,
      onChanged: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^rename$/i })).not.toBeInTheDocument();
  });

  it("archives directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.archiveDocumentFolder).mockResolvedValue({
      success: true,
      data: makeDocumentFolder({ archived_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();
    renderFolderActions({ folder: makeDocumentFolder({ id: "docfolder_1" }), childCount: 0, onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.archiveDocumentFolder).toHaveBeenCalledWith("docfolder_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("restores directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.restoreDocumentFolder).mockResolvedValue({ success: true, data: makeDocumentFolder() });
    const onChanged = vi.fn();
    renderFolderActions({
      folder: makeDocumentFolder({ id: "docfolder_1", archived_at: "2026-01-01T00:00:00.000Z" }),
      childCount: 0,
      onChanged,
    });

    await user.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(dataLayer.restoreDocumentFolder).toHaveBeenCalledWith("docfolder_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("renames through the Rename modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.updateDocumentFolder).mockResolvedValue({ success: true, data: makeDocumentFolder({ name: "Renamed" }) });
    const onChanged = vi.fn();
    renderFolderActions({ folder: makeDocumentFolder({ id: "docfolder_1", name: "Old Name" }), childCount: 0, onChanged });

    await user.click(screen.getByRole("button", { name: /^rename$/i }));
    const dialog = await screen.findByRole("dialog", { name: /rename folder/i });
    const nameField = within(dialog).getByLabelText(/^name \*/i);
    await user.clear(nameField);
    await user.type(nameField, "Renamed");
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(dataLayer.updateDocumentFolder).toHaveBeenCalledWith(
        "docfolder_1",
        expect.objectContaining({ name: "Renamed" }),
      ),
    );
    expect(onChanged).toHaveBeenCalled();
  });
});
