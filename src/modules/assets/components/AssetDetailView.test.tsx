import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  setMediaAssetStatus: vi.fn(),
  getMediaAssetDownloadUrl: vi.fn(),
  setMediaAssetTags: vi.fn(),
  updateMediaAssetMetadata: vi.fn(),
  getEventById: vi.fn().mockRejectedValue(new Error("no related event")),
  getClientById: vi.fn().mockRejectedValue(new Error("no related client")),
}));
vi.mock("@/modules/knowledgeGraph/knowledgeGraphActions", () => ({
  getNodeRelationshipsAction: vi.fn().mockResolvedValue({ success: false, error: "not needed for this test" }),
}));
// Both pull in their own separate dependency chains unrelated to the
// Approval Workflow card this test exercises — stubbed to isolate exactly
// the interaction under test, matching this file's own established
// "detail view composes independent panels" structure.
vi.mock("@/modules/assets/components/AssetIntelligencePanel", () => ({
  AssetIntelligencePanel: () => null,
}));
vi.mock("@/modules/assets/components/AssetThumbnail", () => ({
  AssetThumbnail: () => null,
}));

import { AssetDetailView } from "@/modules/assets/components/AssetDetailView";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import * as dataLayer from "@/lib/data";
import type { MediaAsset } from "@/types/mediaAsset";

const managerSnapshot: Extract<MemberSessionSnapshot, { kind: "active" }> = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["assets.view", "assets.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function baseAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "media_1",
    workspace_id: "ws_amore_bloom",
    owner_type: "workspace",
    owner_id: "ws_amore_bloom",
    original_filename: "post.jpg",
    stored_filename: "post.jpg",
    storage_bucket: "media-assets",
    storage_path: "ws_amore_bloom/workspace/ws_amore_bloom/media_1/v1/post.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1024,
    checksum: "sha256:abc",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: "user_1",
    created_at: "2026-09-17T00:00:00Z",
    updated_at: "2026-09-17T00:00:00Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
    ...overrides,
  };
}

function renderDetail(asset: MediaAsset) {
  return render(
    <MemberSessionProvider snapshot={managerSnapshot}>
      <AssetDetailView asset={asset} />
    </MemberSessionProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

// SOCIAL-03-FIX-B, Phase 9/14 — before this fix, an unexpected rejection
// from setMediaAssetStatus (as the Supabase path used to do unconditionally
// via notMigrated()) left `busy` stuck true forever: no try/catch/finally
// existed, so setBusy(false) was never reached and every Approval Workflow
// button stayed disabled permanently, with a silent unhandled rejection.
describe("AssetDetailView — Approval Workflow error handling", () => {
  it("clears busy and shows a controlled error when the status update rejects unexpectedly, without leaving buttons stuck", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.setMediaAssetStatus).mockRejectedValueOnce(new Error("Digital Asset Management's Approval fields have not been migrated to Supabase yet"));
    renderDetail(baseAsset());

    const approveButton = screen.getByRole("button", { name: "Approve" });
    await user.click(approveButton);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not update/i));
    expect(approveButton).not.toBeDisabled();

    const rejectButton = screen.getByRole("button", { name: "Reject" });
    expect(rejectButton).not.toBeDisabled();
  });

  it("still approves successfully and clears busy on the ordinary success path", async () => {
    const user = userEvent.setup();
    const approved = baseAsset({ status: "approved", approved_by: "Amoré Bloom Owner", approved_at: "2026-09-17T00:00:00Z" });
    vi.mocked(dataLayer.setMediaAssetStatus).mockResolvedValueOnce({ success: true, data: approved });
    renderDetail(baseAsset());

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the server's own error message and clears busy when the action returns a controlled failure", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.setMediaAssetStatus).mockResolvedValueOnce({ success: false, error: "Media asset not found." });
    renderDetail(baseAsset());

    const approveButton = screen.getByRole("button", { name: "Approve" });
    await user.click(approveButton);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Media asset not found."));
    expect(approveButton).not.toBeDisabled();
  });
});
