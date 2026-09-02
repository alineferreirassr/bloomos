"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMediaAssetsByOwner,
  uploadMediaAsset,
  getMediaAssetDownloadUrl,
  deleteMediaAsset,
  restoreMediaAsset,
} from "@/lib/data";
import type { MediaAsset } from "@/types/mediaAsset";
import { validateMimeType, validateFileSize, extractFileExtension } from "@/lib/media/mediaFile";
import { formatBytes } from "@/modules/documents/mappers";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; assets: MediaAsset[] };

async function loadInventoryItemDocuments(inventoryItemId: string): Promise<LoadState> {
  try {
    const assets = await getMediaAssetsByOwner("inventory_item", inventoryItemId, { includeArchived: true });
    return { status: "ready", assets };
  } catch {
    return { status: "error" };
  }
}

/**
 * Inventory "Documents" are Media Assets, not `Document` rows — the same
 * architectural choice Vendor Documents made (see VendorDocumentsSection's
 * own comment): `inventory_item` is a reserved MediaAsset owner type
 * (`LIVE_MEDIA_ASSET_OWNER_TYPES`), not a reserved `documents` owner type.
 * No folders, no versioning, no title/category/status metadata — just
 * upload / list / open / archive / restore.
 *
 * Fetches independently of InventoryItemDetailView, Notes, Timeline, and
 * Movement History (own effect, own loading/error state) — a Documents
 * failure must never blank the rest of the item page.
 */
export function InventoryDocumentsSection({ inventoryItemId }: { inventoryItemId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadInventoryItemDocuments(inventoryItemId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [inventoryItemId]);

  const refetch = () => {
    loadInventoryItemDocuments(inventoryItemId).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadInventoryItemDocuments(inventoryItemId).then(setState);
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file || isUploading) return;
    setActionError(null);

    const extension = extractFileExtension(file.name);
    const mimeCheck = validateMimeType(file.type, extension);
    if (!mimeCheck.valid) {
      setActionError(mimeCheck.error ?? "Unsupported file type.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const sizeCheck = validateFileSize(file.size, file.type);
    if (!sizeCheck.valid) {
      setActionError(sizeCheck.error ?? "File is too large.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    const result = await uploadMediaAsset({ ownerType: "inventory_item", ownerId: inventoryItemId, file, originalFilename: file.name });
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!result.success) {
      setActionError(result.error);
      return;
    }
    refetch();
  };

  const handleOpen = async (assetId: string) => {
    setPendingAssetId(assetId);
    const result = await getMediaAssetDownloadUrl(assetId);
    setPendingAssetId(null);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  };

  const handleArchive = async (assetId: string) => {
    setPendingAssetId(assetId);
    const result = await deleteMediaAsset(assetId);
    setPendingAssetId(null);
    setConfirmArchiveId(null);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    refetch();
  };

  const handleRestore = async (assetId: string) => {
    setPendingAssetId(assetId);
    const result = await restoreMediaAsset(assetId);
    setPendingAssetId(null);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    refetch();
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-live="polite" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this item's documents." onRetry={retry} />;
  }

  const { assets } = state;
  const assetPendingArchive = assets.find((asset) => asset.id === confirmArchiveId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label htmlFor="inventory_item_document_upload" className="text-sm font-medium text-text-muted">
          Upload a file
        </label>
        <Button type="button" variant="secondary" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileInputRef}
          id="inventory_item_document_upload"
          type="file"
          className="sr-only"
          onChange={(event) => handleFileSelected(event.target.files?.[0])}
        />
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {actionError}
        </div>
      ) : null}

      {assets.length === 0 ? (
        <EmptyState title="No documents yet" description="Upload the first file for this item." />
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <LuxuryCard key={asset.id} className={asset.archived_at ? "opacity-60" : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text">{asset.original_filename}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {asset.mime_type} · {formatBytes(asset.file_size)} · {new Date(asset.created_at).toLocaleDateString()}
                  </p>
                  {asset.uploaded_by ? <p className="mt-0.5 text-xs text-text-muted">Uploaded by {asset.uploaded_by}</p> : null}
                  {asset.archived_at ? <p className="mt-0.5 text-xs text-text-muted">Archived</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpen(asset.id)}
                    disabled={pendingAssetId === asset.id}
                    aria-label={`Open file: ${asset.original_filename}`}
                    className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                  >
                    Open
                  </button>
                  {asset.archived_at ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(asset.id)}
                      disabled={pendingAssetId === asset.id}
                      aria-label={`Restore file: ${asset.original_filename}`}
                      className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmArchiveId(asset.id)}
                      disabled={pendingAssetId === asset.id}
                      aria-label={`Archive file: ${asset.original_filename}`}
                      className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            </LuxuryCard>
          ))}
        </div>
      )}

      <Modal open={!!assetPendingArchive} onClose={() => setConfirmArchiveId(null)} title="Archive this file?">
        <p>
          {assetPendingArchive
            ? `"${assetPendingArchive.original_filename}" will be archived and hidden from the active list. You can restore it later.`
            : ""}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            onClick={() => confirmArchiveId && handleArchive(confirmArchiveId)}
            disabled={pendingAssetId === confirmArchiveId}
          >
            {pendingAssetId === confirmArchiveId ? "Archiving…" : "Archive"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setConfirmArchiveId(null)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
