-- Media Library migration 3 of 6: updated_at trigger.
--
-- Reuses the generic public.set_updated_at() function defined in
-- 20260715150400_updated_at_trigger.sql — no bespoke function per table.

drop trigger if exists trg_media_assets_set_updated_at on public.media_assets;
create trigger trg_media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();
