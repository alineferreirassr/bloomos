/**
 * v2.0 Checkpoint 25, Step 9 — Approval Workflow. Every `MediaAsset` starts
 * `"pending"` (never auto-approved) and moves through this closed set via
 * `modules/assets/approvalActions.ts`, which also records the Approval
 * History as real Comments (see `docs/approval-engine.md`) — this enum only
 * names the current state, not the history of how it got there.
 */
export const MEDIA_ASSET_STATUSES = ["pending", "approved", "rejected", "needs_revision"] as const;
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];

export const MEDIA_ASSET_STATUS_LABELS: Record<MediaAssetStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  needs_revision: "Needs Revision",
};
