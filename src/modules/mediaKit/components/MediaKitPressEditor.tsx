"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MediaKitAssetPreview } from "@/modules/mediaKit/components/MediaKitAssetPreview";
import { listMediaAssetsForWorkspace } from "@/lib/data";
import { getMediaKitPressFeaturesData } from "@/modules/mediaKit/getMediaKitPressFeaturesData";
import { createMediaKitPressFeatureAction } from "@/modules/mediaKit/createMediaKitPressFeatureAction";
import { updateMediaKitPressFeatureAction } from "@/modules/mediaKit/updateMediaKitPressFeatureAction";
import { archiveMediaKitPressFeatureAction } from "@/modules/mediaKit/archiveMediaKitPressFeatureAction";
import { reorderMediaKitPressFeaturesAction } from "@/modules/mediaKit/reorderMediaKitPressFeaturesAction";
import type { MediaKitPressFeature, MediaKitPressFeatureInput } from "@/types/mediaKit";
import type { MediaAsset } from "@/types/mediaAsset";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: MediaKitPressFeature[] };

const EMPTY_FORM: MediaKitPressFeatureInput = {
  publication_name: "",
  feature_title: null,
  url: null,
  logo_media_asset_id: null,
  featured_on: null,
  is_featured: false,
  is_included: true,
};

function toFormValues(item: MediaKitPressFeature): MediaKitPressFeatureInput {
  return {
    publication_name: item.publication_name,
    feature_title: item.feature_title,
    url: item.url,
    logo_media_asset_id: item.logo_media_asset_id,
    featured_on: item.featured_on,
    is_featured: item.is_featured,
    is_included: item.is_included,
  };
}

interface PressFeatureFormProps {
  initial: MediaKitPressFeatureInput;
  logoOptions: MediaAsset[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: MediaKitPressFeatureInput) => void;
  onCancel: () => void;
  idPrefix: string;
}

function PressFeatureForm({ initial, logoOptions, submitting, error, onSubmit, onCancel, idPrefix }: PressFeatureFormProps) {
  const [values, setValues] = useState<MediaKitPressFeatureInput>(initial);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className="space-y-4"
    >
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Publication" htmlFor={`${idPrefix}_publication`} required>
          <Input id={`${idPrefix}_publication`} value={values.publication_name} onChange={(event) => setValues({ ...values, publication_name: event.target.value })} required />
        </FormField>
        <FormField label="Date Featured" htmlFor={`${idPrefix}_date`} hint="Optional.">
          <Input id={`${idPrefix}_date`} type="date" value={values.featured_on ?? ""} onChange={(event) => setValues({ ...values, featured_on: event.target.value })} />
        </FormField>
      </div>

      <FormField label="Feature Title" htmlFor={`${idPrefix}_title`} hint="Optional — the article or feature's own headline.">
        <Input id={`${idPrefix}_title`} value={values.feature_title ?? ""} onChange={(event) => setValues({ ...values, feature_title: event.target.value })} />
      </FormField>

      <FormField label="URL" htmlFor={`${idPrefix}_url`} hint="Optional — link to the live feature.">
        <Input id={`${idPrefix}_url`} type="url" value={values.url ?? ""} onChange={(event) => setValues({ ...values, url: event.target.value })} placeholder="https://" />
      </FormField>

      <div>
        <p className="mb-[5px] text-xs text-text/70">Logo</p>
        <div className="flex flex-wrap items-center gap-2">
          <MediaKitAssetPreview mediaAssetId={values.logo_media_asset_id} title="Logo" className="aspect-square w-20" />
          <Select
            aria-label="Logo"
            value={values.logo_media_asset_id ?? ""}
            onChange={(event) => setValues({ ...values, logo_media_asset_id: event.target.value || null })}
            className="max-w-xs"
          >
            <option value="">No logo</option>
            {logoOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.original_filename}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-text">
          <Checkbox checked={values.is_included} onChange={(event) => setValues({ ...values, is_included: event.target.checked })} />
          Included on the public Media Kit
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <Checkbox checked={values.is_featured} onChange={(event) => setValues({ ...values, is_featured: event.target.checked })} />
          Featured
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface MediaKitPressEditorProps {
  workspaceId: string;
  onChanged: () => void;
}

/** MEDIAKIT-05 — a visual curator over `media_kit_press_features`. Never fabricates a logo or a publication that wasn't actually persisted. */
export function MediaKitPressEditor({ workspaceId, onChanged }: MediaKitPressEditorProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [logoOptions, setLogoOptions] = useState<MediaAsset[]>([]);
  const [creating, setCreating] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<{ itemId: string; message: string } | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const load = () => {
    setState({ status: "loading" });
    getMediaKitPressFeaturesData()
      .then((result) => setState(result.success ? { status: "ready", items: result.data } : { status: "error" }))
      .catch(() => setState({ status: "error" }));
  };

  useEffect(() => {
    let cancelled = false;
    getMediaKitPressFeaturesData()
      .then((result) => {
        if (cancelled) return;
        setState(result.success ? { status: "ready", items: result.data } : { status: "error" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    listMediaAssetsForWorkspace(workspaceId).then((assets) => {
      if (!cancelled) setLogoOptions(assets.filter((asset) => asset.status === "approved"));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleCreate(values: MediaKitPressFeatureInput) {
    setCreateSubmitting(true);
    setCreateError(null);
    const result = await createMediaKitPressFeatureAction(values);
    setCreateSubmitting(false);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    setCreating(false);
    load();
    onChanged();
  }

  async function handleUpdate(itemId: string, values: MediaKitPressFeatureInput) {
    setEditSubmitting(true);
    setEditError(null);
    const result = await updateMediaKitPressFeatureAction(itemId, values);
    setEditSubmitting(false);
    if (!result.success) {
      setEditError(result.error);
      return;
    }
    setEditingItemId(null);
    load();
    onChanged();
  }

  async function handleArchive(itemId: string) {
    setItemError(null);
    setPendingItemId(itemId);
    const result = await archiveMediaKitPressFeatureAction(itemId);
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId, message: result.error });
      return;
    }
    if (editingItemId === itemId) setEditingItemId(null);
    load();
    onChanged();
  }

  async function handleToggleIncluded(item: MediaKitPressFeature) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitPressFeatureAction(item.id, { ...toFormValues(item), is_included: !item.is_included });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
    onChanged();
  }

  async function handleToggleFeatured(item: MediaKitPressFeature) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitPressFeatureAction(item.id, { ...toFormValues(item), is_featured: !item.is_featured });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
  }

  async function moveItem(items: MediaKitPressFeature[], itemId: string, direction: "up" | "down") {
    setReorderError(null);
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const result = await reorderMediaKitPressFeaturesAction(reordered.map((row) => row.id));
    if (!result.success) {
      setReorderError(result.error);
      return;
    }
    load();
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Press couldn't be loaded." onRetry={load} />;
  }

  const { items } = state;
  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      {reorderError ? (
        <p role="alert" className="text-xs text-danger">
          {reorderError}
        </p>
      ) : null}

      {sortedItems.length === 0 && !creating ? (
        <EmptyState
          title="No press features yet"
          description="Highlight where Amoré Bloom has been featured."
          action={
            <Button type="button" variant="primary" onClick={() => setCreating(true)}>
              Add Press Feature
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {sortedItems.map((item, index) => {
              const isPending = pendingItemId === item.id;
              const isEditing = editingItemId === item.id;
              return (
                <li key={item.id}>
                  <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      <MediaKitAssetPreview mediaAssetId={item.logo_media_asset_id} title={item.publication_name} className="w-full sm:w-24" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-[16px] font-semibold text-text">{item.publication_name}</h3>
                          {item.is_featured ? <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">Featured</span> : null}
                          {!item.is_included ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-text-muted uppercase">Excluded</span> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {[item.feature_title, item.featured_on ? new Date(item.featured_on).toLocaleDateString() : null].filter(Boolean).join(" · ")}
                        </p>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-xs text-accent hover:underline">
                            {item.url}
                          </a>
                        ) : null}

                        {itemError?.itemId === item.id ? (
                          <p role="alert" className="mt-2 text-xs text-danger">
                            {itemError.message}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              aria-label="Move up"
                              disabled={index === 0 || isPending}
                              onClick={() => moveItem(sortedItems, item.id, "up")}
                              className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              aria-label="Move down"
                              disabled={index === sortedItems.length - 1 || isPending}
                              onClick={() => moveItem(sortedItems, item.id, "down")}
                              className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                            >
                              ▼
                            </button>
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Checkbox checked={item.is_included} disabled={isPending} onChange={() => handleToggleIncluded(item)} />
                            Included
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Checkbox checked={item.is_featured} disabled={isPending} onChange={() => handleToggleFeatured(item)} />
                            Featured
                          </label>
                          {!isEditing ? (
                            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingItemId(item.id)}>
                              Edit
                            </Button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleArchive(item.id)}
                            disabled={isPending}
                            className="text-xs text-danger hover:underline disabled:pointer-events-none disabled:opacity-45"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 border-t border-border/60 pt-4">
                        <PressFeatureForm
                          idPrefix={`press_${item.id}`}
                          initial={toFormValues(item)}
                          logoOptions={logoOptions}
                          submitting={editSubmitting}
                          error={editError}
                          onSubmit={(values) => handleUpdate(item.id, values)}
                          onCancel={() => {
                            setEditingItemId(null);
                            setEditError(null);
                          }}
                        />
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>

          {!creating ? (
            <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
              Add Press Feature
            </Button>
          ) : null}
        </>
      )}

      {creating ? (
        <Card>
          <h3 className="mb-3 font-serif text-[16px] font-semibold text-text">New Press Feature</h3>
          <PressFeatureForm
            idPrefix="press_new"
            initial={EMPTY_FORM}
            logoOptions={logoOptions}
            submitting={createSubmitting}
            error={createError}
            onSubmit={handleCreate}
            onCancel={() => {
              setCreating(false);
              setCreateError(null);
            }}
          />
        </Card>
      ) : null}
    </div>
  );
}
