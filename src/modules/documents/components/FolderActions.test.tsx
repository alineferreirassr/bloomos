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
  getDocumentFolders: vi.fn(),
}));

vi.mock("@/modules/documents/documentActions", () => ({
  archiveDocumentFolderAction: vi.fn(),
  restoreDocumentFolderAction: vi.fn(),
  createDocumentFolderAction: vi.fn(),
  updateDocumentFolderAction: vi.fn(),
  moveDocumentFolderAction: vi.fn(),
  applyDefaultFolderTemplateAction: vi.fn(),
}));

import * as dataLayer from "@/lib/data";
import * as documentActions from "@/modules/documents/documentActions";

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
    vi.mocked(documentActions.archiveDocumentFolderAction).mockResolvedValue({
      success: true,
      data: makeDocumentFolder({ archived_at: "2026-01-01T00:00:00.000Z" }),
    });
    const onChanged = vi.fn();
    renderFolderActions({ folder: makeDocumentFolder({ id: "docfolder_1" }), childCount: 0, onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(documentActions.archiveDocumentFolderAction).toHaveBeenCalledWith("docfolder_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("restores directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.restoreDocumentFolderAction).mockResolvedValue({ success: true, data: makeDocumentFolder() });
    const onChanged = vi.fn();
    renderFolderActions({
      folder: makeDocumentFolder({ id: "docfolder_1", archived_at: "2026-01-01T00:00:00.000Z" }),
      childCount: 0,
      onChanged,
    });

    await user.click(screen.getByRole("button", { name: /restore/i }));

    await waitFor(() => expect(documentActions.restoreDocumentFolderAction).toHaveBeenCalledWith("docfolder_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("renames through the Rename modal", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.updateDocumentFolderAction).mockResolvedValue({ success: true, data: makeDocumentFolder({ name: "Renamed" }) });
    const onChanged = vi.fn();
    renderFolderActions({ folder: makeDocumentFolder({ id: "docfolder_1", name: "Old Name" }), childCount: 0, onChanged });

    await user.click(screen.getByRole("button", { name: /^rename$/i }));
    const dialog = await screen.findByRole("dialog", { name: /rename folder/i });
    const nameField = within(dialog).getByLabelText(/^name \*/i);
    await user.clear(nameField);
    await user.type(nameField, "Renamed");
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(documentActions.updateDocumentFolderAction).toHaveBeenCalledWith(
        "docfolder_1",
        expect.objectContaining({ name: "Renamed" }),
      ),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("creates a subfolder through the Add Subfolder modal, using the protected action", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.createDocumentFolderAction).mockResolvedValue({ success: true, data: makeDocumentFolder({ name: "New Sub" }) });
    const onChanged = vi.fn();
    renderFolderActions({ folder: makeDocumentFolder({ id: "docfolder_1" }), childCount: 2, onChanged });

    await user.click(screen.getByRole("button", { name: /add subfolder/i }));
    const dialog = await screen.findByRole("dialog", { name: /add subfolder/i });
    const nameField = within(dialog).getByLabelText(/^name \*/i);
    await user.type(nameField, "New Sub");
    await user.click(within(dialog).getByRole("button", { name: /^create$/i }));

    await waitFor(() =>
      expect(documentActions.createDocumentFolderAction).toHaveBeenCalledWith(
        expect.objectContaining({ parent_folder_id: "docfolder_1", name: "New Sub" }),
      ),
    );
    expect(onChanged).toHaveBeenCalled();
  });
});
