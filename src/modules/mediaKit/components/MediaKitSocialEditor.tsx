"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { updateMediaKitSocialLinksAction } from "@/modules/mediaKit/updateMediaKitSocialLinksAction";
import type { MediaKit, MediaKitSocialLink } from "@/types/mediaKit";

interface MediaKitSocialEditorProps {
  mediaKit: MediaKit;
  onChanged: () => void;
}

/**
 * MEDIAKIT-05 — the founder's curated public link list, built directly over
 * `media_kits.social_links`. No follower counts, no engagement stats, no
 * platform integration/tokens — just the display-safe {platform,
 * handle_or_url, is_visible} the schema already supports.
 */
export function MediaKitSocialEditor({ mediaKit, onChanged }: MediaKitSocialEditorProps) {
  const [links, setLinks] = useState<MediaKitSocialLink[]>(mediaKit.social_links);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateLink(index: number, patch: Partial<MediaKitSocialLink>) {
    setSaved(false);
    setLinks((current) => current.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  function removeLink(index: number) {
    setSaved(false);
    setLinks((current) => current.filter((_, i) => i !== index));
  }

  function addLink() {
    setSaved(false);
    setLinks((current) => [...current, { platform: "", handle_or_url: "", is_visible: true }]);
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const result = await updateMediaKitSocialLinksAction(links);
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
        <h3 className="font-serif text-[17px] font-semibold text-text">Social</h3>
        <p className="mt-1 text-xs text-text-muted">The channels you want visitors to find you on.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? <p className="text-xs text-success">Saved.</p> : null}

      {links.length === 0 ? (
        <EmptyState title="No social links yet" description="Add a channel — Instagram, TikTok, Pinterest, or your own site." />
      ) : (
        <ul className="space-y-3">
          {links.map((link, index) => (
            <li key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                aria-label="Platform"
                placeholder="Platform (e.g. Instagram)"
                value={link.platform}
                onChange={(event) => updateLink(index, { platform: event.target.value })}
                className="sm:w-40"
              />
              <Input
                aria-label="Handle or URL"
                placeholder="Handle or URL"
                value={link.handle_or_url}
                onChange={(event) => updateLink(index, { handle_or_url: event.target.value })}
                className="flex-1"
              />
              <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-text-muted">
                <Checkbox checked={link.is_visible} onChange={(event) => updateLink(index, { is_visible: event.target.checked })} />
                Visible
              </label>
              <button
                type="button"
                onClick={() => removeLink(index)}
                className="text-xs text-danger hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={addLink}>
          Add Link
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
