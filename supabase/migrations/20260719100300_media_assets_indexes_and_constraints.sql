-- Media Library migration 4 of 6: indexes and constraints.
--
-- Mirrors the query patterns getMediaAssetsByOwner()/quota-style SUM(file_size)
-- queries actually use: workspace+owner scoping, and a uniqueness guard so
-- two rows can never claim the same physical Storage object.

create index if not exists media_assets_workspace_owner_idx
  on public.media_assets (workspace_id, owner_type, owner_id);
create index if not exists media_assets_workspace_archived_idx
  on public.media_assets (workspace_id, archived_at);

create unique index if not exists media_assets_bucket_path_unique
  on public.media_assets (storage_bucket, storage_path);
