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
import { listMediaAssetsForWorkspace, getVendors } from "@/lib/data";
import { getMediaKitPartnersData } from "@/modules/mediaKit/getMediaKitPartnersData";
import { createMediaKitPartnerAction } from "@/modules/mediaKit/createMediaKitPartnerAction";
import { updateMediaKitPartnerAction } from "@/modules/mediaKit/updateMediaKitPartnerAction";
import { archiveMediaKitPartnerAction } from "@/modules/mediaKit/archiveMediaKitPartnerAction";
import { reorderMediaKitPartnersAction } from "@/modules/mediaKit/reorderMediaKitPartnersAction";
import { getMediaKitClientOptionsData, type MediaKitClientOption } from "@/modules/mediaKit/getMediaKitClientOptionsData";
import type { MediaKitPartner, MediaKitPartnerInput } from "@/types/mediaKit";
import type { MediaAsset } from "@/types/mediaAsset";
import type { Vendor } from "@/types/vendor";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; items: MediaKitPartner[] };

const EMPTY_FORM: MediaKitPartnerInput = {
  client_id: null,
  vendor_id: null,
  display_name: "",
  logo_media_asset_id: null,
  partner_type: null,
  is_featured: false,
  is_included: true,
};

function toFormValues(item: MediaKitPartner): MediaKitPartnerInput {
  return {
    client_id: item.client_id,
    vendor_id: item.vendor_id,
    display_name: item.display_name,
    logo_media_asset_id: item.logo_media_asset_id,
    partner_type: item.partner_type,
    is_featured: item.is_featured,
    is_included: item.is_included,
  };
}

interface PartnerFormProps {
  initial: MediaKitPartnerInput;
  clients: MediaKitClientOption[];
  vendors: Vendor[];
  logoOptions: MediaAsset[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: MediaKitPartnerInput) => void;
  onCancel: () => void;
  idPrefix: string;
}

function PartnerForm({ initial, clients, vendors, logoOptions, submitting, error, onSubmit, onCancel, idPrefix }: PartnerFormProps) {
  const [values, setValues] = useState<MediaKitPartnerInput>(initial);
  const linkKind = values.client_id ? "client" : values.vendor_id ? "vendor" : "none";

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

      <FormField label="Display Name" htmlFor={`${idPrefix}_name`} required hint="What the public sees — never auto-filled from a linked Client or Vendor.">
        <Input id={`${idPrefix}_name`} value={values.display_name} onChange={(event) => setValues({ ...values, display_name: event.target.value })} required />
      </FormField>

      <FormField label="Partner Type" htmlFor={`${idPrefix}_type`} hint="e.g. Venue, Florist, Planner — optional.">
        <Input id={`${idPrefix}_type`} value={values.partner_type ?? ""} onChange={(event) => setValues({ ...values, partner_type: event.target.value })} />
      </FormField>

      <FormField label="Link (optional)" htmlFor={`${idPrefix}_link`} hint="Purely editorial entries are fine — leave unlinked.">
        <Select
          id={`${idPrefix}_link`}
          value={linkKind === "client" ? `client:${values.client_id}` : linkKind === "vendor" ? `vendor:${values.vendor_id}` : ""}
          onChange={(event) => {
            const raw = event.target.value;
            if (!raw) {
              setValues({ ...values, client_id: null, vendor_id: null });
              return;
            }
            const [kind, id] = raw.split(":");
            setValues({ ...values, client_id: kind === "client" ? id : null, vendor_id: kind === "vendor" ? id : null });
          }}
        >
          <option value="">No linked record</option>
          <optgroup label="Clients">
            {clients.map((client) => (
              <option key={client.id} value={`client:${client.id}`}>
                {client.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Vendors">
            {vendors.map((vendor) => (
              <option key={vendor.id} value={`vendor:${vendor.id}`}>
                {vendor.display_name || vendor.company_name}
              </option>
            ))}
          </optgroup>
        </Select>
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

interface MediaKitPartnersEditorProps {
  workspaceId: string;
  onChanged: () => void;
}

/**
 * MEDIAKIT-05 — a visual curator over `media_kit_partners`. `getVendors()`
 * is called directly (not through a Server Action) because it resolves its
 * own session via the browser-only Supabase client — the same convention
 * `PurchaseForm.tsx` already uses; only the Client picker needs the
 * `getServerRepositoryContext()` Server Action route, since `getClients()`
 * exposes an explicit context overload and `getVendors()` doesn't.
 */
export function MediaKitPartnersEditor({ workspaceId, onChanged }: MediaKitPartnersEditorProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [clients, setClients] = useState<MediaKitClientOption[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
    getMediaKitPartnersData()
      .then((result) => setState(result.success ? { status: "ready", items: result.data } : { status: "error" }))
      .catch(() => setState({ status: "error" }));
  };

  useEffect(() => {
    let cancelled = false;
    getMediaKitPartnersData()
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
    getVendors({ includeArchived: false }).then((rows) => {
      if (!cancelled) setVendors(rows);
    });
    listMediaAssetsForWorkspace(workspaceId).then((assets) => {
      if (!cancelled) setLogoOptions(assets.filter((asset) => asset.status === "approved"));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleCreate(values: MediaKitPartnerInput) {
    setCreateSubmitting(true);
    setCreateError(null);
    const result = await createMediaKitPartnerAction(values);
    setCreateSubmitting(false);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    setCreating(false);
    load();
    onChanged();
  }

  async function handleUpdate(itemId: string, values: MediaKitPartnerInput) {
    setEditSubmitting(true);
    setEditError(null);
    const result = await updateMediaKitPartnerAction(itemId, values);
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
    const result = await archiveMediaKitPartnerAction(itemId);
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId, message: result.error });
      return;
    }
    if (editingItemId === itemId) setEditingItemId(null);
    load();
    onChanged();
  }

  async function handleToggleIncluded(item: MediaKitPartner) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitPartnerAction(item.id, { ...toFormValues(item), is_included: !item.is_included });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
    onChanged();
  }

  async function handleToggleFeatured(item: MediaKitPartner) {
    setItemError(null);
    setPendingItemId(item.id);
    const result = await updateMediaKitPartnerAction(item.id, { ...toFormValues(item), is_featured: !item.is_featured });
    setPendingItemId(null);
    if (!result.success) {
      setItemError({ itemId: item.id, message: result.error });
      return;
    }
    load();
  }

  async function moveItem(items: MediaKitPartner[], itemId: string, direction: "up" | "down") {
    setReorderError(null);
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((row) => row.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= sorted.length) return;

    const reordered = [...sorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const result = await reorderMediaKitPartnersAction(reordered.map((row) => row.id));
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
    return <ErrorState message="Partners couldn't be loaded." onRetry={load} />;
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
          title="No partners yet"
          description="Feature the brands, venues, and collaborators you're proud to work with."
          action={
            <Button type="button" variant="primary" onClick={() => setCreating(true)}>
              Add Partner
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
                      <MediaKitAssetPreview mediaAssetId={item.logo_media_asset_id} title={item.display_name} className="w-full sm:w-24" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-[16px] font-semibold text-text">{item.display_name}</h3>
                          {item.is_featured ? <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">Featured</span> : null}
                          {!item.is_included ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-text-muted uppercase">Excluded</span> : null}
                        </div>
                        {item.partner_type ? <p className="mt-0.5 text-xs text-text-muted">{item.partner_type}</p> : null}

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
                        <PartnerForm
                          idPrefix={`partner_${item.id}`}
                          initial={toFormValues(item)}
                          clients={clients}
                          vendors={vendors}
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
              Add Partner
            </Button>
          ) : null}
        </>
      )}

      {creating ? (
        <Card>
          <h3 className="mb-3 font-serif text-[16px] font-semibold text-text">New Partner</h3>
          <PartnerForm
            idPrefix="partner_new"
            initial={EMPTY_FORM}
            clients={clients}
            vendors={vendors}
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
