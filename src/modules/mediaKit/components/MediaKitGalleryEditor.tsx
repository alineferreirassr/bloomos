"use client";

import { MediaKitGalleryPicker } from "@/modules/mediaKit/components/MediaKitGalleryPicker";

interface MediaKitGalleryEditorProps {
  workspaceId: string;
  onChanged: () => void;
}

/** MEDIAKIT-04 — the top-level Gallery section (`portfolio_item_id: null`). Each Portfolio item's own image set is curated inline within the Portfolio editor instead, via the same `MediaKitGalleryPicker`. */
export function MediaKitGalleryEditor({ workspaceId, onChanged }: MediaKitGalleryEditorProps) {
  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-sm text-text-muted">Curate the images that tell your story visually — chosen from your existing Media Assets.</p>
      <MediaKitGalleryPicker workspaceId={workspaceId} portfolioItemId={null} onChanged={onChanged} />
    </div>
  );
}
