"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/forms/FormField";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { MediaKitAssetPreview } from "@/modules/mediaKit/components/MediaKitAssetPreview";
import { MediaKitGalleryPicker } from "@/modules/mediaKit/components/MediaKitGalleryPicker";
import { listMediaAssetsForWorkspace } from "@/lib/data";
import { getMediaKitPortfolioItemsData } from "@/modules/mediaKit/getMediaKitPortfolioItemsData";
import { createMediaKitPortfolioItemAction } from "@/modules/mediaKit/createMediaKitPortfolioItemAction";
import { updateMediaKitPortfolioItemAction } from "@/modules/mediaKit/updateMediaKitPortfolioItemAction";
import { archiveMediaKitPortfolioItemAction } from "@/modules/mediaKit/archiveMediaKitPortfolioItemAction";
import { reorderMediaKitPortfolioItemsAction } from "@/modules/mediaKit/reorderMediaKitPortfolioItemsAction";
import { getMediaKitEventOptionsData, type MediaKitEventOption } from "@/modules/mediaKit/getMediaKitEventOptionsData";
import type { MediaKitPortfolioItem, MediaKitPortfolioItemInput } from "@/types/mediaKit";
import type { MediaAsset } from "@/types/mediaAsset";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: MediaKitPortfolioItem[] };

const EMPTY_FORM: MediaKitPortfolioItemInput = {
  event_id: null,
  title: "",
  category: null,
  location_label: null,
  event_year: null,
  short_description: null,
  cover_media_asset_id: null,
  is_featured: false,
  is_included: true,
};

function toFormValues(item: MediaKitPortfolioItem): MediaKitPortfolioItemInput {
  return {
    event_id: item.event_id,
    title: item.title,
    category: item.category,
    location_label: item.location_label,
    event_year: item.event_year,
    short_description: item.short_description,
    cover_media_asset_id: item.cover_media_asset_id,
    is_featured: item.is_featured,
    is_included: item.is_included,
  };
}

interface PortfolioItemFormProps {
  initial: MediaKitPortfolioItemInput;
  events: MediaKitEventOption[];
  coverOptions: MediaAsset[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: MediaKitPortfolioItemInput) => void;
  onCancel: () => void;
  idPrefix: string;
}

function PortfolioItemForm({ initial, events, coverOptions, submitting, error, onSubmit, onCancel, idPrefix }: PortfolioItemFormProps) {
  const [values, setValues] = useState<MediaKitPortfolioItemInput>(initial);
  const [yearText, setYearText] = useState(initial.event_year ? String(initial.event_year) : "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const trimmedYear = yearText.trim();
        onSubmit({ ...values, event_year: trimmedYear ? Number(trimmedYear) : null });
      }}
      className="space-y-4"
    >
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <FormField label="Title" htmlFor={`${idPrefix}_title`} required>
        <Input id={`${idPrefix}_title`} value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Category" htmlFor={`${idPrefix}_category`}>
          <Input id={`${idPrefix}_category`} value={values.category ?? ""} onChange={(event) => setValues({ ...values, category: event.target.value })} />
        </FormField>
        <FormField label="Location" htmlFor={`${idPrefix}_location`}>
          <Input id={`${idPrefix}_location`} value={values.location_label ?? ""} onChange={(event) => setValues({ ...values, location_label: event.target.value })} />
        </FormField>
        <FormField label="Year" htmlFor={`${idPrefix}_year`}>
          <Input id={`${idPrefix}_year`} type="number" inputMode="numeric" value={yearText} onChange={(event) => setYearText(event.target.value)} />
        </FormField>
      </div>

      <FormField label="Description" htmlFor={`${idPrefix}_description`} hint="A short, editorial description — not required.">
        <Textarea id={`${idPrefix}_description`} rows={3} value={values.short_description ?? ""} onChange={(event) => setValues({ ...values, short_description: event.target.value })} />
      </FormField>

      <FormField label="Linked Event" htmlFor={`${idPrefix}_event`} hint="Optional. Every field above stays editorial — nothing is auto-filled from the linked Event.">
        <Select id={`${idPrefix}_event`} value={values.event_id ?? ""} onChange={(event) => setValues({ ...values, event_id: event.target.value || null })}>
          <option value="">No linked Event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
              {event.eventDate ? ` — ${new Date(event.eventDate).toLocaleDateString()}` : ""}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <p className="mb-[5px] text-xs text-text/70">Cover Image</p>
        <div className="flex flex-wrap items-center gap-2">
          <MediaKitAssetPreview mediaAssetId={values.cover_media_asset_id} title="Cover" className="aspect-square w-20" />
          <Select
            aria-label="Cover Image"
            value={values.cover_media_asset_id ?? ""}
            onChange={(event) => setValues({ ...values, cover_media_asset_id: event.target.value || null })}
            className="max-w-xs"
          >
            <option value="">No cover image</option>
            {coverOptions.map((asset) => (
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

interface MediaKitPortfolioEditorProps {
  workspaceId: string;
  /** Re-runs the Manager's own real Overview read path so the Portfolio readiness badge reflects real, current curation state. */
  onChanged: () => void;
}

/**
 * MEDIAKIT-04 — a visual curator over `media_kit_portfolio_items`, never a
 * second Events system: `event_id` is an optional convenience link only,
 * every editorial field is always explicit. Supports portfolio pieces with
 * no Event at all (styled shoots, editorial work, older projects).
 */
export function MediaKitPortfolioEditor({ workspaceId, onChanged }: MediaKitPortfolioEditorProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [events, setEvents] = useState<MediaKitEventOption[]>([]);
  const [coverOptions, setCoverOptions] = useState<MediaAsset[]>([]);
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
    getMediaKitPortfolioItemsData()
      .then((result) => setState(result.success ? { status: "ready", items: result.data } : { status: "error" }))
      .catch(() => setState({ status: "error" }));
  };

  useEffect(() => {
    let cancelled = false;
    getMediaKitPortfolioItemsData()
      .then((result) => {
        if (cancelled) return;
        setState(result.success ? { status: "ready", items: result.data } : { status: "error" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    getMediaKitEventOptionsData().then((result) => {
      if (!cancelled && result.success) setEvents(result.data);
    });
    listMediaAssetsForWorkspace(workspaceId).then((assets) => {
      if (!cancelled) setCoverOptions(assets.filter((asset) => asset.status === "approved"));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleCreate(values: MediaKitPortfolioItemInput) {
    setCreateSubmitting(true);
    setCreateError(null);
    const result = await createMediaKitPortfolioItemAction(values);
    setCreateSubmitting(false);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    setCreating(false);
    load();
    onChanged();
  }

  async function handleUpdate(itemId: string, values: MediaKitPortfolioItemInput) {
    setEditSubmitting(true);
    setEditError(null);
    const result = await updateMediaKitPortfolioItemAction(itemId, values);
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
    const result = await archiveMediaKitPortfolioItemAction(itemId);
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId, message: result.error });
      return;
    }
    if (editingItemId === itemId) setEditingItemId(null);
    load();
    onChanged();
  }

  async function handleToggleIncluded(item: MediaKitPortfolioItem) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitPortfolioItemAction(item.id, { ...toFormValues(item), is_included: !item.is_included });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
    onChanged();
  }

  async function handleToggleFeatured(item: MediaKitPortfolioItem) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitPortfolioItemAction(item.id, { ...toFormValues(item), is_featured: !item.is_featured });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
  }

  async function moveItem(items: MediaKitPortfolioItem[], itemId: string, direction: "up" | "down") {
    setReorderError(null);
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const result = await reorderMediaKitPortfolioItemsAction(reordered.map((row) => row.id));
    if (!result.success) {
      setReorderError(result.error);
      return;
    }
    load();
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Portfolio couldn't be loaded." onRetry={load} />;
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
          title="No portfolio items yet"
          description="Showcase your favorite work — from a real Event or a standalone editorial piece."
          action={
            <Button type="button" variant="primary" onClick={() => setCreating(true)}>
              Add Portfolio Item
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
                      <MediaKitAssetPreview mediaAssetId={item.cover_media_asset_id} title={item.title} className="w-full sm:w-32" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-[16px] font-semibold text-text">{item.title}</h3>
                          {item.is_featured ? <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">Featured</span> : null}
                          {!item.is_included ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-text-muted uppercase">Excluded</span> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-text-muted">{[item.category, item.location_label, item.event_year].filter(Boolean).join(" · ")}</p>
                        {item.short_description ? <p className="mt-1 text-xs text-text-muted">{item.short_description}</p> : null}

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
                              Edit presentation
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
                      <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                        <PortfolioItemForm
                          idPrefix={`portfolio_${item.id}`}
                          initial={toFormValues(item)}
                          events={events}
                          coverOptions={coverOptions}
                          submitting={editSubmitting}
                          error={editError}
                          onSubmit={(values) => handleUpdate(item.id, values)}
                          onCancel={() => {
                            setEditingItemId(null);
                            setEditError(null);
                          }}
                        />
                        <div>
                          <p className="mb-1.5 text-[11px] tracking-[0.1em] text-text-muted uppercase">This item&apos;s own image gallery</p>
                          <MediaKitGalleryPicker workspaceId={workspaceId} portfolioItemId={item.id} onChanged={onChanged} />
                        </div>
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>

          {!creating ? (
            <Button type="button" variant="secondary" onClick={() => setCreating(true)}>
              Add Portfolio Item
            </Button>
          ) : null}
        </>
      )}

      {creating ? (
        <Card>
          <h3 className="mb-3 font-serif text-[16px] font-semibold text-text">New Portfolio Item</h3>
          <PortfolioItemForm
            idPrefix="portfolio_new"
            initial={EMPTY_FORM}
            events={events}
            coverOptions={coverOptions}
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
