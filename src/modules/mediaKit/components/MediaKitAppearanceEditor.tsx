"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { MediaKitAssetPreview } from "@/modules/mediaKit/components/MediaKitAssetPreview";
import { listMediaAssetsForWorkspace } from "@/lib/data";
import { updateMediaKitAppearanceAction } from "@/modules/mediaKit/updateMediaKitAppearanceAction";
import type { MediaKit, MediaKitAppearance } from "@/types/mediaKit";
import type { MediaAsset } from "@/types/mediaAsset";

function toAppearance(raw: Record<string, unknown>): MediaKitAppearance {
  const heroId = raw.hero_media_asset_id;
  return { hero_media_asset_id: typeof heroId === "string" ? heroId : null };
}

interface MediaKitAppearanceEditorProps {
  mediaKit: MediaKit;
  onChanged: () => void;
}

/**
 * MEDIAKIT-05 — the minimum useful Appearance editor: one curated hero
 * image, chosen from existing approved Media Assets. Never a theme/CSS
 * editor — `media_kits.appearance` stays a forward-compatible JSONB bag,
 * but only `hero_media_asset_id` is read or written here.
 */
export function MediaKitAppearanceEditor({ mediaKit, onChanged }: MediaKitAppearanceEditorProps) {
  const [heroOptions, setHeroOptions] = useState<MediaAsset[]>([]);
  const [value, setValue] = useState<MediaKitAppearance>(() => toAppearance(mediaKit.appearance));
  const [syncedAppearance, setSyncedAppearance] = useState(mediaKit.appearance);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Adjusting state during render (React's own recommended pattern for
  // deriving state from a changed prop) rather than in an effect — this
  // keeps the form in sync after `onChanged()` refetches a new `mediaKit`
  // without an extra render pass.
  if (syncedAppearance !== mediaKit.appearance) {
    setSyncedAppearance(mediaKit.appearance);
    setValue(toAppearance(mediaKit.appearance));
  }

  useEffect(() => {
    let cancelled = false;
    listMediaAssetsForWorkspace(mediaKit.workspace_id).then((assets) => {
      if (!cancelled) setHeroOptions(assets.filter((asset) => asset.status === "approved"));
    });
    return () => {
      cancelled = true;
    };
  }, [mediaKit.workspace_id]);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const result = await updateMediaKitAppearanceAction(value);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSaved(true);
    onChanged();
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-serif text-[17px] font-semibold text-text">Appearance</h3>
        <p className="mt-1 text-xs text-text-muted">A single curated hero image for your public Media Kit&apos;s opening moment.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-xs text-success">Saved.</p> : null}

      <div>
        <p className="mb-[5px] text-xs text-text/70">Hero Image</p>
        <div className="flex flex-wrap items-center gap-3">
          <MediaKitAssetPreview mediaAssetId={value.hero_media_asset_id} title="Hero" className="aspect-video w-48" />
          <Select
            aria-label="Hero Image"
            value={value.hero_media_asset_id ?? ""}
            onChange={(event) => {
              setValue({ hero_media_asset_id: event.target.value || null });
              setSaved(false);
            }}
            className="max-w-xs"
          >
            <option value="">No hero image — an elegant image-empty composition will be used instead</option>
            {heroOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.original_filename}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Button type="button" variant="primary" onClick={handleSave} disabled={submitting}>
        {submitting ? "Saving…" : "Save"}
      </Button>
    </Card>
  );
}
