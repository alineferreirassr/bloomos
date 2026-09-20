"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
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
import { listMediaAssetsForWorkspace } from "@/lib/data";
import { getMediaKitTestimonialsData } from "@/modules/mediaKit/getMediaKitTestimonialsData";
import { createMediaKitTestimonialAction } from "@/modules/mediaKit/createMediaKitTestimonialAction";
import { updateMediaKitTestimonialAction } from "@/modules/mediaKit/updateMediaKitTestimonialAction";
import { setMediaKitTestimonialApprovedAction } from "@/modules/mediaKit/setMediaKitTestimonialApprovedAction";
import { archiveMediaKitTestimonialAction } from "@/modules/mediaKit/archiveMediaKitTestimonialAction";
import { reorderMediaKitTestimonialsAction } from "@/modules/mediaKit/reorderMediaKitTestimonialsAction";
import { getMediaKitClientOptionsData, type MediaKitClientOption } from "@/modules/mediaKit/getMediaKitClientOptionsData";
import type { MediaKitTestimonial, MediaKitTestimonialInput } from "@/types/mediaKit";
import type { MediaAsset } from "@/types/mediaAsset";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: MediaKitTestimonial[] };

const EMPTY_FORM: MediaKitTestimonialInput = {
  client_id: null,
  quote: "",
  author_name: "",
  author_role: null,
  photo_media_asset_id: null,
  is_featured: false,
  is_included: true,
};

function toFormValues(item: MediaKitTestimonial): MediaKitTestimonialInput {
  return {
    client_id: item.client_id,
    quote: item.quote,
    author_name: item.author_name,
    author_role: item.author_role,
    photo_media_asset_id: item.photo_media_asset_id,
    is_featured: item.is_featured,
    is_included: item.is_included,
  };
}

interface TestimonialFormProps {
  initial: MediaKitTestimonialInput;
  clients: MediaKitClientOption[];
  photoOptions: MediaAsset[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: MediaKitTestimonialInput) => void;
  onCancel: () => void;
  idPrefix: string;
}

function TestimonialForm({ initial, clients, photoOptions, submitting, error, onSubmit, onCancel, idPrefix }: TestimonialFormProps) {
  const [values, setValues] = useState<MediaKitTestimonialInput>(initial);

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

      <FormField label="Quote" htmlFor={`${idPrefix}_quote`} required>
        <Textarea id={`${idPrefix}_quote`} rows={4} value={values.quote} onChange={(event) => setValues({ ...values, quote: event.target.value })} required />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Author Name" htmlFor={`${idPrefix}_author`} required>
          <Input id={`${idPrefix}_author`} value={values.author_name} onChange={(event) => setValues({ ...values, author_name: event.target.value })} required />
        </FormField>
        <FormField label="Author Role" htmlFor={`${idPrefix}_role`} hint="e.g. Bride, Groom — optional.">
          <Input id={`${idPrefix}_role`} value={values.author_role ?? ""} onChange={(event) => setValues({ ...values, author_role: event.target.value })} />
        </FormField>
      </div>

      <FormField label="Linked Client" htmlFor={`${idPrefix}_client`} hint="Optional — never shown publicly, staff-only reference.">
        <Select id={`${idPrefix}_client`} value={values.client_id ?? ""} onChange={(event) => setValues({ ...values, client_id: event.target.value || null })}>
          <option value="">No linked Client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <p className="mb-[5px] text-xs text-text/70">Photo</p>
        <div className="flex flex-wrap items-center gap-2">
          <MediaKitAssetPreview mediaAssetId={values.photo_media_asset_id} title="Photo" className="aspect-square w-20" />
          <Select
            aria-label="Photo"
            value={values.photo_media_asset_id ?? ""}
            onChange={(event) => setValues({ ...values, photo_media_asset_id: event.target.value || null })}
            className="max-w-xs"
          >
            <option value="">No photo</option>
            {photoOptions.map((asset) => (
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
      <p className="text-xs text-text-muted">A testimonial must also be approved (below) before it can appear publicly.</p>

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

interface MediaKitTestimonialsEditorProps {
  workspaceId: string;
  onChanged: () => void;
}

/**
 * MEDIAKIT-05 — a visual curator over `media_kit_testimonials`. CRITICAL:
 * `is_approved` is a second, independent gate from `is_included` — both
 * must be true for a testimonial to ever reach the public snapshot. A new
 * testimonial always starts unapproved (the schema default); approval is a
 * distinct, deliberate action, never bundled into the general edit-save.
 */
export function MediaKitTestimonialsEditor({ workspaceId, onChanged }: MediaKitTestimonialsEditorProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [clients, setClients] = useState<MediaKitClientOption[]>([]);
  const [photoOptions, setPhotoOptions] = useState<MediaAsset[]>([]);
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
    getMediaKitTestimonialsData()
      .then((result) => setState(result.success ? { status: "ready", items: result.data } : { status: "error" }))
      .catch(() => setState({ status: "error" }));
  };

  useEffect(() => {
    let cancelled = false;
    getMediaKitTestimonialsData()
      .then((result) => {
        if (cancelled) return;
        setState(result.success ? { status: "ready", items: result.data } : { status: "error" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    getMediaKitClientOptionsData().then((result) => {
      if (!cancelled && result.success) setClients(result.data);
    });
    listMediaAssetsForWorkspace(workspaceId).then((assets) => {
      if (!cancelled) setPhotoOptions(assets.filter((asset) => asset.status === "approved"));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleCreate(values: MediaKitTestimonialInput) {
    setCreateSubmitting(true);
    setCreateError(null);
    const result = await createMediaKitTestimonialAction(values);
    setCreateSubmitting(false);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    setCreating(false);
    load();
    onChanged();
  }

  async function handleUpdate(itemId: string, values: MediaKitTestimonialInput) {
    setEditSubmitting(true);
    setEditError(null);
    const result = await updateMediaKitTestimonialAction(itemId, values);
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
    const result = await archiveMediaKitTestimonialAction(itemId);
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId, message: result.error });
      return;
    }
    if (editingItemId === itemId) setEditingItemId(null);
    load();
    onChanged();
  }

  async function handleToggleIncluded(item: MediaKitTestimonial) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitTestimonialAction(item.id, { ...toFormValues(item), is_included: !item.is_included });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
    onChanged();
  }

  async function handleToggleFeatured(item: MediaKitTestimonial) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitTestimonialAction(item.id, { ...toFormValues(item), is_featured: !item.is_featured });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
  }

  async function handleToggleApproved(item: MediaKitTestimonial) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await setMediaKitTestimonialApprovedAction(item.id, !item.is_approved);
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
    onChanged();
  }

  async function moveItem(items: MediaKitTestimonial[], itemId: string, direction: "up" | "down") {
    setReorderError(null);
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const result = await reorderMediaKitTestimonialsAction(reordered.map((row) => row.id));
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
    return <ErrorState message="Testimonials couldn't be loaded." onRetry={load} />;
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
          title="No testimonials yet"
          description="Share the words your clients have used to describe working with you."
          action={
            <Button type="button" variant="primary" onClick={() => setCreating(true)}>
              Add Testimonial
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
                      <MediaKitAssetPreview mediaAssetId={item.photo_media_asset_id} title={item.author_name} className="w-full sm:w-24" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-[16px] font-semibold text-text">{item.author_name}</h3>
                          {item.author_role ? <span className="text-xs text-text-muted">{item.author_role}</span> : null}
                          {item.is_approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Pending Approval</Badge>}
                          {item.is_featured ? <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">Featured</span> : null}
                          {!item.is_included ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-text-muted uppercase">Excluded</span> : null}
                        </div>
                        <p className="mt-1 text-xs text-text-muted italic">&ldquo;{item.quote}&rdquo;</p>

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
                          <Button type="button" variant={item.is_approved ? "secondary" : "primary"} size="sm" disabled={isPending} onClick={() => handleToggleApproved(item)}>
                            {item.is_approved ? "Revoke approval" : "Approve"}
                          </Button>
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
                        <TestimonialForm
                          idPrefix={`testimonial_${item.id}`}
                          initial={toFormValues(item)}
                          clients={clients}
                          photoOptions={photoOptions}
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
              Add Testimonial
            </Button>
          ) : null}
        </>
      )}

      {creating ? (
        <Card>
          <h3 className="mb-3 font-serif text-[16px] font-semibold text-text">New Testimonial</h3>
          <TestimonialForm
            idPrefix="testimonial_new"
            initial={EMPTY_FORM}
            clients={clients}
            photoOptions={photoOptions}
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
