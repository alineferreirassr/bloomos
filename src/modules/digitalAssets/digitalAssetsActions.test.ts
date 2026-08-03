import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  toggleAssetFavoriteAction,
  listFavoriteAssetIdsAction,
  commentOnAssetAction,
  listAssetCommentsAction,
  reviewAssetAction,
  listAssetReviewsAction,
  shareAssetAction,
  listAssetSharesAction,
  createAssetVersionAction,
  getAssetVersionHistoryAction,
  evaluateAssetAction,
  evaluatePlatformAction,
  createAssetFolderAction,
  archiveAssetFolderAction,
  digitalAssetsRecommendationsForExecutiveDecisions,
  downloadAssetAction,
  setAssetVisibilityAction,
  recordAssetViewAction,
} from "@/modules/digitalAssets/digitalAssetsActions";
import { uploadMediaAsset, resetAllMockData } from "@/lib/data";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetMediaFoldersStore } from "@/lib/data/mock/mediaFoldersStore";
import { resetMediaCollectionsStore } from "@/lib/data/mock/mediaCollectionsStore";
import { resetAssetVersionsStore } from "@/lib/data/mock/assetVersionsStore";
import { resetAssetFavoritesStore } from "@/lib/data/mock/assetFavoritesStore";
import { resetAssetReviewsStore } from "@/lib/data/mock/assetReviewsStore";
import { resetAssetSharesStore } from "@/lib/data/mock/assetSharesStore";
import { resetAssetDownloadsStore } from "@/lib/data/mock/assetDownloadsStore";
import { resetAssetViewsStore } from "@/lib/data/mock/assetViewsStore";
import { resetAssetVisibilityStore } from "@/lib/data/mock/assetVisibilityStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["assets.view", "assets.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const crossTenantSession: MemberSessionSnapshot = {
  ...session,
  workspace: { id: "ws_other_tenant", name: "Other Workspace" },
  membership: { id: "member_other_ws", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

function resetAll(): void {
  resetAllMockData();
  resetMediaAssetsStore();
  resetMediaFoldersStore();
  resetMediaCollectionsStore();
  resetAssetVersionsStore();
  resetAssetFavoritesStore();
  resetAssetReviewsStore();
  resetAssetSharesStore();
  resetAssetDownloadsStore();
  resetAssetViewsStore();
  resetAssetVisibilityStore();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

async function seedAsset(): Promise<string> {
  const file = new Blob(["hello world"], { type: "text/plain" });
  const result = await uploadMediaAsset({ ownerType: "workspace", ownerId: CURRENT_WORKSPACE_ID, file, originalFilename: "notes.txt" });
  if (!result.success) throw new Error("seed upload failed");
  return result.data.id;
}

describe("createAssetFolderAction / archiveAssetFolderAction", () => {
  it("creates a folder and blocks archiving it while it still holds an asset", async () => {
    const folderResult = await createAssetFolderAction({ name: "Brand Kit" });
    expect(folderResult.success).toBe(true);
    if (!folderResult.success) return;

    const assetId = await seedAsset();
    const { setMediaAssetFolder } = await import("@/lib/data");
    await setMediaAssetFolder(assetId, folderResult.data.id);

    const archiveResult = await archiveAssetFolderAction(folderResult.data.id);
    expect(archiveResult.success).toBe(false);
  });

  it("allows archiving an empty folder", async () => {
    const folderResult = await createAssetFolderAction({ name: "Empty" });
    if (!folderResult.success) throw new Error("setup failed");
    const archiveResult = await archiveAssetFolderAction(folderResult.data.id);
    expect(archiveResult.success).toBe(true);
  });
});

describe("toggleAssetFavoriteAction", () => {
  it("favorites then unfavorites an asset", async () => {
    const assetId = await seedAsset();
    const first = await toggleAssetFavoriteAction(assetId);
    expect(first).toEqual({ success: true, data: { favorited: true } });

    const list = await listFavoriteAssetIdsAction();
    expect(list.success && list.data).toEqual([assetId]);

    const second = await toggleAssetFavoriteAction(assetId);
    expect(second).toEqual({ success: true, data: { favorited: false } });
  });
});

describe("comments", () => {
  it("posts a comment and reads it back", async () => {
    const assetId = await seedAsset();
    const result = await commentOnAssetAction(assetId, { body: "Looks great!" });
    expect(result.success).toBe(true);

    const list = await listAssetCommentsAction(assetId);
    expect(list.success && list.data).toHaveLength(1);
    expect(list.success && list.data[0].body).toBe("Looks great!");
  });
});

describe("reviewAssetAction", () => {
  it("records a review decision and updates the real asset status", async () => {
    const assetId = await seedAsset();
    const result = await reviewAssetAction(assetId, "approved");
    expect(result.success && result.data.status).toBe("approved");

    const reviews = await listAssetReviewsAction(assetId);
    expect(reviews.success && reviews.data).toHaveLength(1);
    expect(reviews.success && reviews.data[0].decision).toBe("approved");
  });
});

describe("shareAssetAction", () => {
  it("records a share event without granting real external access", async () => {
    const assetId = await seedAsset();
    const result = await shareAssetAction(assetId, "team", ["member_2"], "For review");
    expect(result.success).toBe(true);

    const shares = await listAssetSharesAction(assetId);
    expect(shares.success && shares.data).toHaveLength(1);
  });
});

describe("createAssetVersionAction", () => {
  it("captures the outgoing version before replacing", async () => {
    const assetId = await seedAsset();
    const newFile = new Blob(["updated content"], { type: "text/plain" });
    const result = await createAssetVersionAction(assetId, { file: newFile, originalFilename: "notes.txt" });
    expect(result.success && result.data.version).toBe(2);

    const history = await getAssetVersionHistoryAction(assetId);
    expect(history.success && history.data.map((v) => v.version)).toEqual([2, 1]);
  });
});

describe("evaluateAssetAction", () => {
  it("returns a full evaluation bundle for a real asset", async () => {
    const assetId = await seedAsset();
    const result = await evaluateAssetAction(assetId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.asset.id).toBe(assetId);
    expect(result.data.health).toBeDefined();
    expect(result.data.usage).toBeDefined();
    expect(result.data.permission.checks.length).toBeGreaterThan(0);
  });

  it("fails for an unknown asset id", async () => {
    const result = await evaluateAssetAction("does_not_exist");
    expect(result.success).toBe(false);
  });
});

describe("evaluatePlatformAction", () => {
  it("aggregates health and analytics across the workspace", async () => {
    await seedAsset();
    const result = await evaluatePlatformAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.analytics.totalAssets).toBe(1);
    expect(result.data.health.assetsEvaluated).toBe(1);
  });
});

describe("cross-tenant workspace isolation (v2 Checkpoint 45 security fix)", () => {
  it("rejects a cross-tenant download attempt", async () => {
    const assetId = await seedAsset();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await downloadAssetAction(assetId);
    expect(result.success).toBe(false);
  });

  it("rejects a cross-tenant visibility change", async () => {
    const assetId = await seedAsset();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await setAssetVisibilityAction(assetId, "client");
    expect(result.success).toBe(false);
  });

  it("rejects a cross-tenant review decision", async () => {
    const assetId = await seedAsset();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await reviewAssetAction(assetId, "approved");
    expect(result.success).toBe(false);
  });

  it("rejects a cross-tenant view recording", async () => {
    const assetId = await seedAsset();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await recordAssetViewAction(assetId);
    expect(result.success).toBe(false);
  });
});

describe("digitalAssetsRecommendationsForExecutiveDecisions", () => {
  it("returns [] when there is no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const recs = await digitalAssetsRecommendationsForExecutiveDecisions();
    expect(recs).toEqual([]);
  });

  it("surfaces a recommendation for a freshly uploaded, unfiled, untagged asset", async () => {
    await seedAsset();
    const recs = await digitalAssetsRecommendationsForExecutiveDecisions();
    expect(recs.some((r) => r.ruleId === "dam_unused_asset")).toBe(true);
  });
});
