import type { MediaAsset } from "@/types/mediaAsset";
import { ASSET_PERMISSION_ACTIONS, type AssetPermission, type AssetPermissionAction, type AssetPermissionCheck, type AssetVisibility } from "@/types/digitalAssets";

/**
 * v2.0 Checkpoint 37, Step 9 — Permission Engine. Composes the real
 * `assets.view`/`assets.manage` permission (Checkpoint 25) rather than
 * adding a duplicate `digital_assets.*` pair — see `docs/digital-assets.md`
 * for why. Visibility is derived deterministically from the asset's own
 * real `owner_type` unless a member has explicitly overridden it (see
 * `lib/data/mock/assetVisibilityStore.ts`).
 */
export function deriveDefaultVisibility(asset: Pick<MediaAsset, "owner_type">): AssetVisibility {
  if (asset.owner_type === "client") return "client";
  if (asset.owner_type === "workspace") return "team";
  return "internal_only";
}

export function resolveAssetVisibility(asset: Pick<MediaAsset, "id" | "owner_type">, overrides: Record<string, AssetVisibility>): AssetVisibility {
  return overrides[asset.id] ?? deriveDefaultVisibility(asset);
}

export type AssetViewerContext = "team" | "client";

export interface AssetPermissionViewer {
  context: AssetViewerContext;
  /** The caller's own real `can("assets.manage")` result — never re-derived here. */
  canManage: boolean;
}

function checkAction(action: AssetPermissionAction, asset: MediaAsset, visibility: AssetVisibility, viewer: AssetPermissionViewer): AssetPermissionCheck {
  if (viewer.context === "team") {
    if ((action === "edit" || action === "delete" || action === "share") && !viewer.canManage) {
      return { action, allowed: false, reason: "Requires the Manage Assets permission." };
    }
    return { action, allowed: true, reason: null };
  }

  // viewer.context === "client" — always the narrower path; a client account never holds assets.manage.
  const clientVisible = visibility === "client" || visibility === "public_placeholder";
  if (!clientVisible) {
    return { action, allowed: false, reason: "This file hasn't been shared with clients." };
  }
  if (action === "edit" || action === "delete" || action === "share") {
    return { action, allowed: false, reason: "Only your planning team can manage files." };
  }
  if ((action === "preview" || action === "download" || action === "comment") && asset.status !== "approved") {
    return { action, allowed: false, reason: "This file is still awaiting approval." };
  }
  return { action, allowed: true, reason: null };
}

export function evaluateAssetPermission(asset: MediaAsset, visibility: AssetVisibility, viewer: AssetPermissionViewer): AssetPermission {
  return {
    assetId: asset.id,
    visibility,
    checks: ASSET_PERMISSION_ACTIONS.map((action) => checkAction(action, asset, visibility, viewer)),
  };
}
