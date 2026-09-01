"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  listMediaAssetsForWorkspace,
  getMediaFolders,
  createMediaFolder,
  setMediaAssetFolder,
  uploadMediaAsset,
  getEvents,
  getClients,
} from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { MediaAsset } from "@/types/mediaAsset";
import type { MediaFolder } from "@/types/mediaFolder";
import { getFolderChildren } from "@/core/workflows/mediaFolderWorkflow";
import { categorizeAsset, ASSET_CATEGORIES, ASSET_CATEGORY_LABELS, type AssetCategory } from "@/modules/assets/assetCategory";
import { MEDIA_ASSET_STATUS_LABELS, type MediaAssetStatus } from "@/core/enums/mediaAssetStatus";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { CardGridSkeleton } from "@/components/ui/Skeleton";
import { AssetsIcon, SearchIcon } from "@/components/ui/icons";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { AssetCard } from "@/modules/assets/components/AssetCard";
import { AssetListRow } from "@/modules/assets/components/AssetListRow";
import { AssetFolderSidebar } from "@/modules/assets/components/AssetFolderSidebar";
import { AssetPlatformSummary } from "@/modules/assets/components/AssetPlatformSummary";
import { ViewToggle, type CatalogViewMode } from "@/modules/services/components/ViewToggle";
import Link from "next/link";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      assets: MediaAsset[];
      folders: MediaFolder[];
      eventNames: Map<string, string>;
      clientNames: Map<string, string>;
      loadedAt: number;
    };

async function loadAssetLibrary(): Promise<LoadState> {
  try {
    const [assets, folders, events, clients] = await Promise.all([
      listMediaAssetsForWorkspace(CURRENT_WORKSPACE_ID),
      getMediaFolders({ ownerType: null, ownerId: null }),
      getEvents(),
      getClients(),
    ]);
    return {
      status: "ready",
      assets,
      folders,
      eventNames: new Map(events.map((e) => [e.id, e.title])),
      clientNames: new Map(clients.map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()])),
      loadedAt: Date.now(),
    };
  } catch {
    return { status: "error" };
  }
}

const RECENT_UPLOAD_WINDOW_DAYS = 7;

function relatedLabelFor(asset: MediaAsset, eventNames: Map<string, string>, clientNames: Map<string, string>): string | undefined {
  if (asset.owner_type === "event") return eventNames.get(asset.owner_id);
  if (asset.owner_type === "client") return clientNames.get(asset.owner_id);
  return undefined;
}

export function AssetLibraryView() {
  const { profile, can } = useMemberSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AssetCategory | "all">("all");
  const [status, setStatus] = useState<MediaAssetStatus | "all">("all");
  const [activeFolderId, setActiveFolderId] = useState<string | null | "all">("all");
  const [viewMode, setViewMode] = useState<CatalogViewMode>("grid");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canManage = can("assets.manage");

  function reload() {
    setState({ status: "loading" });
    loadAssetLibrary().then(setState);
  }

  useEffect(() => {
    let cancelled = false;
    loadAssetLibrary().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAssets = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.assets.filter((asset) => {
      if (activeFolderId !== "all" && asset.folder_id !== activeFolderId) return false;
      if (category !== "all" && categorizeAsset(asset) !== category) return false;
      if (status !== "all" && asset.status !== status) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesName = asset.original_filename.toLowerCase().includes(query);
        const matchesTag = asset.tags.some((tag) => tag.toLowerCase().includes(query));
        if (!matchesName && !matchesTag) return false;
      }
      return true;
    });
  }, [state, activeFolderId, category, status, search]);

  const quickStats = useMemo(() => {
    if (state.status !== "ready") return null;
    const cutoff = state.loadedAt - RECENT_UPLOAD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    let images = 0;
    let videos = 0;
    let recent = 0;
    for (const asset of state.assets) {
      const c = categorizeAsset(asset);
      if (c === "image") images += 1;
      if (c === "video") videos += 1;
      if (new Date(asset.created_at).getTime() >= cutoff) recent += 1;
    }
    return { total: state.assets.length, images, videos, recent };
  }, [state]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !profile) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const result = await uploadMediaAsset({
        ownerType: "workspace",
        ownerId: CURRENT_WORKSPACE_ID,
        file,
        originalFilename: file.name,
        folderId: activeFolderId === "all" ? null : activeFolderId,
      });
      if (result.success && activeFolderId !== "all" && activeFolderId !== null) {
        await setMediaAssetFolder(result.data.id, activeFolderId);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    reload();
  }

  async function handleNewFolder() {
    const name = window.prompt("New folder name");
    if (!name || !name.trim()) return;
    const parentFolderId = activeFolderId === "all" ? null : activeFolderId;
    await createMediaFolder({ name, parentFolderId });
    reload();
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Asset Library" subtitle="Every file BloomOS knows about, in one place." icon={AssetsIcon} />
        <CardGridSkeleton count={8} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div>
        <PageHeader title="Asset Library" icon={AssetsIcon} />
        <ErrorState message="We couldn't load the Asset Library." onRetry={reload} />
      </div>
    );
  }

  const folders = state.folders;
  const visibleFolders = getFolderChildren(activeFolderId === "all" ? null : activeFolderId, folders);

  return (
    <div>
      <PageHeader
        title="Asset Library"
        subtitle="Every image, video, document, and brand asset BloomOS knows about — who uploaded it, where it's used, and who approved it."
        icon={AssetsIcon}
        actions={
          <div className="flex gap-2">
            <Link href="/assets/knowledge-graph">
              <Button variant="secondary">Knowledge Graph</Button>
            </Link>
            {canManage ? (
              <>
                <Button variant="secondary" onClick={handleNewFolder}>
                  New Folder
                </Button>
                <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload Files"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                  aria-label="Upload files to the Asset Library"
                />
              </>
            ) : null}
          </div>
        }
      />

      <p className="mb-4 text-xs text-text-muted">{getDataPersistenceMessage()}</p>

      {quickStats ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <p className="text-xs text-text-muted">Total Assets</p>
            <p className="mt-1 text-2xl font-semibold text-text">{quickStats.total}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Images</p>
            <p className="mt-1 text-2xl font-semibold text-text">{quickStats.images}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Videos</p>
            <p className="mt-1 text-2xl font-semibold text-text">{quickStats.videos}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Recent Uploads</p>
            <p className="mt-1 text-2xl font-semibold text-text">{quickStats.recent}</p>
            <p className="mt-0.5 text-[11px] text-text-muted">Last {RECENT_UPLOAD_WINDOW_DAYS} days</p>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <AssetFolderSidebar
          folders={folders}
          activeFolderId={activeFolderId}
          onSelectFolder={setActiveFolderId}
          totalAssetCount={state.assets.length}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <Card className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[180px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by filename or tag…"
                aria-label="Search assets"
                className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory | "all")}
              aria-label="Filter by file type"
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            >
              <option value="all">All file types</option>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ASSET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MediaAssetStatus | "all")}
              aria-label="Filter by approval status"
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            >
              <option value="all">All statuses</option>
              {Object.entries(MEDIA_ASSET_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <ViewToggle value={viewMode} onChange={setViewMode} className="shrink-0" />
          </Card>

          {visibleFolders.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {visibleFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                  className="flex flex-col items-start gap-1 rounded-lg border border-border bg-surface-tint p-3 text-left text-sm hover:bg-text/5"
                >
                  <span className="font-medium">{folder.name}</span>
                  <span className="text-xs text-text-muted">Folder</span>
                </button>
              ))}
            </div>
          ) : null}

          {filteredAssets.length === 0 ? (
            <EmptyState
              illustration="generic"
              title={
                state.assets.length === 0
                  ? "No assets yet"
                  : activeFolderId !== "all"
                    ? "This folder is empty"
                    : "No results for this search"
              }
              description={
                state.assets.length === 0
                  ? "Upload your first photo, video, or brand file to start building the Asset Library."
                  : "Try a different search term, file type, or status."
              }
              action={
                canManage && state.assets.length === 0 ? (
                  <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                    Upload Files
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} relatedLabel={relatedLabelFor(asset, state.eventNames, state.clientNames)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map((asset) => (
                <AssetListRow key={asset.id} asset={asset} relatedLabel={relatedLabelFor(asset, state.eventNames, state.clientNames)} />
              ))}
            </div>
          )}

          <div>
            <h2 className="mb-3 font-serif text-lg font-semibold text-text">Platform Health &amp; Usage</h2>
            <AssetPlatformSummary />
          </div>
        </div>
      </div>
    </div>
  );
}
