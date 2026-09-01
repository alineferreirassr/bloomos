import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentActions } from "@/modules/documents/components/DocumentActions";
import { makeDocument } from "@/modules/documents/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.view", "documents.create", "documents.update", "documents.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderDocumentActions(props: Parameters<typeof DocumentActions>[0], permissions = fullPermissionSnapshot.permissions) {
  return render(
    <MemberSessionProvider snapshot={{ ...fullPermissionSnapshot, permissions }}>
      <DocumentActions {...props} />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/modules/documents/documentActions", () => ({
  activateDocumentAction: vi.fn(),
  archiveDocumentAction: vi.fn(),
  expireDocumentAction: vi.fn(),
  restoreDocumentAction: vi.fn(),
  softDeleteDocumentAction: vi.fn(),
  updateDocumentVisibilityAction: vi.fn(),
  moveDocumentToFolderAction: vi.fn(),
  createDocumentVersionAction: vi.fn(),
}));

vi.mock("@/lib/data", () => ({
  getDocumentFolders: vi.fn(),
}));

import * as documentActions from "@/modules/documents/documentActions";
import * as dataLayer from "@/lib/data";

describe("DocumentActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLayer.getDocumentFolders).mockResolvedValue([]);
  });

  it("shows Activate for a draft document, but not Expire", () => {
    renderDocumentActions({ document: makeDocument({ status: "draft" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /^activate$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^expire$/i })).not.toBeInTheDocument();
  });

  it("shows Expire and Archive for an active document, but not Activate", () => {
    renderDocumentActions({ document: makeDocument({ status: "active" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /^expire$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^activate$/i })).not.toBeInTheDocument();
  });

  it("shows only Restore for an archived document", () => {
    renderDocumentActions({ document: makeDocument({ status: "archived" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit metadata/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /soft delete/i })).not.toBeInTheDocument();
  });

  it("shows only Restore for a soft-deleted document", () => {
    renderDocumentActions({ document: makeDocument({ status: "deleted" }), onChanged: vi.fn() });
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument();
  });

  it("activates directly, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.activateDocumentAction).mockResolvedValue({ success: true, data: makeDocument({ status: "active" }) });
    const onChanged = vi.fn();
    renderDocumentActions({ document: makeDocument({ id: "document_1", status: "draft" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^activate$/i }));

    await waitFor(() => expect(documentActions.activateDocumentAction).toHaveBeenCalledWith("document_1"));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("archives through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.archiveDocumentAction).mockResolvedValue({ success: true, data: makeDocument({ status: "archived" }) });
    const onChanged = vi.fn();
    renderDocumentActions({ document: makeDocument({ id: "document_1", status: "active" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive document/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(documentActions.archiveDocumentAction).toHaveBeenCalledWith("document_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("soft-deletes through a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.softDeleteDocumentAction).mockResolvedValue({ success: true, data: makeDocument({ status: "deleted" }) });
    const onChanged = vi.fn();
    renderDocumentActions({ document: makeDocument({ id: "document_1", status: "active" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /soft delete/i }));
    const dialog = screen.getByRole("dialog", { name: /soft delete document/i });
    await user.click(within(dialog).getByRole("button", { name: /soft delete/i }));

    await waitFor(() => expect(documentActions.softDeleteDocumentAction).toHaveBeenCalledWith("document_1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("changes visibility through the Change Visibility modal", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.updateDocumentVisibilityAction).mockResolvedValue({
      success: true,
      data: makeDocument({ visibility: "client" }),
    });
    const onChanged = vi.fn();
    renderDocumentActions({ document: makeDocument({ id: "document_1", visibility: "internal" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /change visibility/i }));
    const dialog = screen.getByRole("dialog", { name: /change visibility/i });
    await user.selectOptions(within(dialog).getByLabelText(/visibility/i), "client");
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(documentActions.updateDocumentVisibilityAction).toHaveBeenCalledWith("document_1", "client"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("surfaces an error and does not call onChanged when a quick action fails", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.archiveDocumentAction).mockResolvedValue({ success: false, error: "This document is already archived." });
    const onChanged = vi.fn();
    renderDocumentActions({ document: makeDocument({ id: "document_1", status: "active" }), onChanged: onChanged });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog", { name: /archive document/i });
    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));

    expect(await screen.findByText(/this document is already archived/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("creates a new version through the Add New Version modal and navigates to it", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.createDocumentVersionAction).mockResolvedValue({
      success: true,
      data: makeDocument({ id: "document_2", version: 2 }),
    });
    renderDocumentActions({ document: makeDocument({ id: "document_1", status: "active", version: 1 }), onChanged: vi.fn() });

    await user.click(screen.getByRole("button", { name: /add new version/i }));
    const dialog = screen.getByRole("dialog", { name: /add new version/i });
    await user.type(within(dialog).getByLabelText(/mediaasset id/i), "media_1");
    await user.click(within(dialog).getByRole("button", { name: /add version/i }));

    await waitFor(() =>
      expect(documentActions.createDocumentVersionAction).toHaveBeenCalledWith(
        expect.objectContaining({ document_id: "document_1", media_asset_id: "media_1" }),
      ),
    );
  });

  it("creates a metadata-only new version when the MediaAsset id field is left blank", async () => {
    const user = userEvent.setup();
    vi.mocked(documentActions.createDocumentVersionAction).mockResolvedValue({
      success: true,
      data: makeDocument({ id: "document_2", version: 2 }),
    });
    renderDocumentActions({ document: makeDocument({ id: "document_1", status: "active", version: 1 }), onChanged: vi.fn() });

    await user.click(screen.getByRole("button", { name: /add new version/i }));
    const dialog = screen.getByRole("dialog", { name: /add new version/i });
    await user.click(within(dialog).getByRole("button", { name: /add version/i }));

    await waitFor(() =>
      expect(documentActions.createDocumentVersionAction).toHaveBeenCalledWith(
        expect.objectContaining({ document_id: "document_1", media_asset_id: null }),
      ),
    );
  });
});
