import type { MediaAsset } from "@/types/mediaAsset";
import type { MediaCollection, SmartCollectionRule } from "@/types/mediaCollection";

/**
 * v2.0 Checkpoint 25, Steps 3 & 14 — Smart Collection membership. Manual
 * Collections store membership directly (`asset_ids`); a Smart Collection's
 * membership is instead computed on read from `smart_rule` — deterministic,
 * no external AI, matching every other "AI Ready" flag in this checkpoint
 * that stays a plain boolean rather than a real inference call.
 */
function matchesSmartRule(asset: MediaAsset, rule: SmartCollectionRule): boolean {
  if (rule.requiredTags && rule.requiredTags.length > 0) {
    if (!rule.requiredTags.every((tag) => asset.tags.includes(tag))) return false;
  }
  if (rule.colorLabel !== undefined && rule.colorLabel !== null) {
    if (asset.color_label !== rule.colorLabel) return false;
  }
  if (rule.aiReadyOnly && !asset.ai_ready) return false;
  return true;
}

/** Resolves the effective member assets of a Collection — `asset_ids` directly for a manual/template Collection, or every matching asset for a smart one. Archived assets are never included regardless of kind. */
export function resolveCollectionAssets(collection: MediaCollection, allAssets: MediaAsset[]): MediaAsset[] {
  const activeAssets = allAssets.filter((a) => !a.archived_at);
  if (collection.kind === "smart" && collection.smart_rule) {
    return activeAssets.filter((a) => matchesSmartRule(a, collection.smart_rule as SmartCollectionRule));
  }
  const memberIds = new Set(collection.asset_ids);
  return activeAssets.filter((a) => memberIds.has(a.id));
}
