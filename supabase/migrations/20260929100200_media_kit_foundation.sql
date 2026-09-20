-- MEDIAKIT-01C — Media Kit data foundation.
-- Approved design baseline: MEDIAKIT-01A (architecture audit) + MEDIAKIT-01B
-- (domain model) + MEDIAKIT-01B.1 (security review). This migration
-- implements exactly that approved schema — no application code, no
-- routes, no UI, no navigation changes accompany it.

-- ============================================================
-- 1. Root profile
-- ============================================================
create table public.media_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null default 'amore-bloom',

  headline text,
  positioning_statement text,
  brand_narrative text,
  location_label text,
  service_area text,
  established_year int,
  specialty_label text,

  contact_headline text,
  contact_subtext text,
  primary_cta_label text not null default 'Request a Proposal',
  primary_cta_type text not null default 'inquiry_form'
    check (primary_cta_type in ('inquiry_form', 'external_url')),
  primary_cta_external_url text,
  secondary_cta_label text,
  secondary_cta_url text,

  social_links jsonb not null default '[]'::jsonb,
  appearance jsonb not null default '{}'::jsonb,

  status text not null default 'draft'
    check (status in ('draft', 'published', 'unpublished')),
  current_published_snapshot_id uuid,
  published_at timestamptz,
  published_by uuid references auth.users(id),

  visitor_hash_pepper uuid not null default gen_random_uuid(),

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  unique (workspace_id),
  unique (slug)
);

comment on table public.media_kits is
  'One row per workspace. Schema is tenant-capable (matches every other workspace-scoped table) but the product is single-tenant-deployed: the public /media-kit route resolves a server-side-constant slug, never client input.';
comment on column public.media_kits.slug is
  'Globally unique by design, not workspace-scoped. BloomOS runs as one application instance for one business; workspace-scoped uniqueness would only matter for a genuine multi-org SaaS deployment, which this is not.';
comment on column public.media_kits.social_links is
  'Array of {platform, handle_or_url, is_visible}. Application-layer responsibility: this column must only ever be populated with display-safe link data by the Brand/Social editor UI, never secrets or private fields.';
comment on column public.media_kits.appearance is
  'Display preferences only (e.g. selected hero image), inheriting the existing approved design tokens. Never a place for secrets or private configuration.';
comment on column public.media_kits.visitor_hash_pepper is
  'A per-workspace random value mixed into the server-side visitor_hash computation, never exposed to any client. Not a secret in the cryptographic sense (visitor_hash is not a security boundary) - it exists purely to keep the hash workspace-scoped and non-guessable from the client-generated UUID alone.';

-- ============================================================
-- 2. Curated Services
-- ============================================================
create table public.media_kit_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,

  headline_override text,
  description_override text,
  icon_key text,
  public_starting_price_minor integer,
  public_price_label text,

  is_featured boolean not null default false,
  is_included boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  unique (media_kit_id, service_id)
);

-- ============================================================
-- 3. Curated Portfolio
-- ============================================================
create table public.media_kit_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,

  title text not null,
  category text,
  location_label text,
  event_year int,
  short_description text,
  cover_media_asset_id uuid references public.media_assets(id) on delete set null,

  is_featured boolean not null default false,
  is_included boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on column public.media_kit_portfolio_items.event_id is
  'Nullable: not every showcased piece maps to a formal Event. Editorial fields are always explicit, never auto-derived from the linked Event even when one exists.';

-- ============================================================
-- 4. Curated Partners
-- ============================================================
create table public.media_kit_partners (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,

  display_name text not null,
  logo_media_asset_id uuid references public.media_assets(id) on delete set null,
  partner_type text,

  is_featured boolean not null default false,
  is_included boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint media_kit_partners_single_reference check (client_id is null or vendor_id is null)
);

comment on column public.media_kit_partners.display_name is
  'Always manually entered at curation time, never auto-populated from Client/Vendor real name fields - the privacy boundary between "which real record this is" (client_id/vendor_id, staff-only) and "what the public sees" (display_name).';
comment on constraint media_kit_partners_single_reference on public.media_kit_partners is
  'At most one of client_id/vendor_id may be set. Both null is intentional and expected: a purely external partner/venue/brand with no backing CRM record at all.';

-- ============================================================
-- 5. Testimonials
-- ============================================================
create table public.media_kit_testimonials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,

  quote text not null,
  author_name text not null,
  author_role text,
  photo_media_asset_id uuid references public.media_assets(id) on delete set null,

  is_approved boolean not null default false,
  is_featured boolean not null default false,
  is_included boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on column public.media_kit_testimonials.is_approved is
  'Must be true, in addition to is_included, before a testimonial is eligible for the next publish snapshot. Two independent gates, matching "never automatically publish internal notes."';

-- ============================================================
-- 6. Press
-- ============================================================
create table public.media_kit_press_features (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,

  publication_name text not null,
  feature_title text,
  url text,
  logo_media_asset_id uuid references public.media_assets(id) on delete set null,
  featured_on date,

  is_featured boolean not null default false,
  is_included boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- ============================================================
-- 7. Gallery curation (shared: general Gallery + per-portfolio-item)
-- ============================================================
create table public.media_kit_gallery_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,
  portfolio_item_id uuid references public.media_kit_portfolio_items(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,

  caption text,
  is_cover boolean not null default false,
  is_included boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on column public.media_kit_gallery_items.portfolio_item_id is
  'Null = belongs to the top-level Gallery section. Non-null = belongs to that specific portfolio item''s own image set. One table serves both.';

-- ============================================================
-- 8. Published snapshots (immutable, append-only)
-- ============================================================
create table public.media_kit_published_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,
  version integer not null,

  content jsonb not null,

  published_by uuid references auth.users(id),
  published_at timestamptz not null default now(),

  unique (media_kit_id, version)
);

comment on table public.media_kit_published_snapshots is
  'Append-only. Never UPDATEd or archived - a republish inserts a new row and media_kits.current_published_snapshot_id is repointed. No authenticated INSERT/UPDATE/DELETE policy exists; the only writer is publish_media_kit().';
comment on column public.media_kit_published_snapshots.content is
  'Public-safe DTO only. Contains no foreign key into any private/business table (no service_id, event_id, client_id, vendor_id, lead_id) - only Media-Kit-owned curation-row ids, display fields, and media_asset_id references. Never a storage path or a baked signed URL, since signed URLs expire and this snapshot is meant to be long-lived; the public renderer resolves fresh signed URLs at request time.';

alter table public.media_kits
  add constraint media_kits_current_published_snapshot_id_fkey
  foreign key (current_published_snapshot_id)
  references public.media_kit_published_snapshots(id) on delete set null;

-- ============================================================
-- 9. Analytics events (append-only)
-- ============================================================
create table public.media_kit_view_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  media_kit_id uuid not null references public.media_kits(id) on delete cascade,
  published_snapshot_id uuid references public.media_kit_published_snapshots(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,

  event_type text not null
    check (event_type in ('viewed', 'cta_clicked', 'contact_started', 'inquiry_submitted')),
  visitor_hash text check (char_length(visitor_hash) <= 128),
  referrer text check (char_length(referrer) <= 500),
  path text check (char_length(path) <= 300),
  metadata jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now()
);

comment on column public.media_kit_view_events.visitor_hash is
  'A stable (non-rotating) one-way hash of a client-generated random UUID (stored in localStorage) mixed with the workspace''s visitor_hash_pepper. Not fingerprinting: derived from a token the browser itself created, never from device/browser characteristics. Supports DAILY_UNIQUE_VISITORS, APPROXIMATE_UNIQUE_VISITORS over any window, and RETURNING_VISITS from the same column. No IP address is ever captured.';
comment on column public.media_kit_view_events.lead_id is
  'Populated only by record_media_kit_inquiry_event() (trusted, service_role-only path), after the Lead has actually been created. The anonymous-facing record_public_media_kit_event() has no lead_id parameter at all and rejects inquiry_submitted outright.';
comment on table public.media_kit_view_events is
  'Append-only from every calling context - no INSERT policy exists for anon or authenticated. The only write paths are record_public_media_kit_event() (anon-safe, no lead linkage) and record_media_kit_inquiry_event() (service_role only, inquiry linkage).';

create index media_kit_view_events_media_kit_occurred_idx
  on public.media_kit_view_events (media_kit_id, occurred_at desc);
create index media_kit_view_events_throttle_idx
  on public.media_kit_view_events (media_kit_id, visitor_hash, occurred_at desc);

-- ============================================================
-- Triggers
-- ============================================================
create trigger trg_media_kits_set_updated_at before update on public.media_kits
  for each row execute function public.set_updated_at();
create trigger trg_media_kit_services_set_updated_at before update on public.media_kit_services
  for each row execute function public.set_updated_at();
create trigger trg_media_kit_portfolio_items_set_updated_at before update on public.media_kit_portfolio_items
  for each row execute function public.set_updated_at();
create trigger trg_media_kit_partners_set_updated_at before update on public.media_kit_partners
  for each row execute function public.set_updated_at();
create trigger trg_media_kit_testimonials_set_updated_at before update on public.media_kit_testimonials
  for each row execute function public.set_updated_at();
create trigger trg_media_kit_press_features_set_updated_at before update on public.media_kit_press_features
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.media_kits enable row level security;
alter table public.media_kit_services enable row level security;
alter table public.media_kit_portfolio_items enable row level security;
alter table public.media_kit_partners enable row level security;
alter table public.media_kit_testimonials enable row level security;
alter table public.media_kit_press_features enable row level security;
alter table public.media_kit_gallery_items enable row level security;
alter table public.media_kit_published_snapshots enable row level security;
alter table public.media_kit_view_events enable row level security;

create policy "media_kits_select_workspace_member" on public.media_kits
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_kits_insert_workspace_member" on public.media_kits
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "media_kits_update_workspace_member" on public.media_kits
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "media_kit_services_select_workspace_member" on public.media_kit_services
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_kit_services_insert_workspace_member" on public.media_kit_services
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "media_kit_services_update_workspace_member" on public.media_kit_services
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "media_kit_portfolio_items_select_workspace_member" on public.media_kit_portfolio_items
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_kit_portfolio_items_insert_workspace_member" on public.media_kit_portfolio_items
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "media_kit_portfolio_items_update_workspace_member" on public.media_kit_portfolio_items
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "media_kit_partners_select_workspace_member" on public.media_kit_partners
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_kit_partners_insert_workspace_member" on public.media_kit_partners
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "media_kit_partners_update_workspace_member" on public.media_kit_partners
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "media_kit_testimonials_select_workspace_member" on public.media_kit_testimonials
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_kit_testimonials_insert_workspace_member" on public.media_kit_testimonials
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "media_kit_testimonials_update_workspace_member" on public.media_kit_testimonials
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "media_kit_press_features_select_workspace_member" on public.media_kit_press_features
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_kit_press_features_insert_workspace_member" on public.media_kit_press_features
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "media_kit_press_features_update_workspace_member" on public.media_kit_press_features
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "media_kit_gallery_items_select_workspace_member" on public.media_kit_gallery_items
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_kit_gallery_items_insert_workspace_member" on public.media_kit_gallery_items
  for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "media_kit_gallery_items_update_workspace_member" on public.media_kit_gallery_items
  for update to authenticated using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- No insert/update/delete policy for authenticated users: writes happen
-- exclusively inside publish_media_kit() (security definer).
create policy "media_kit_snapshots_select_workspace_member"
  on public.media_kit_published_snapshots
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- No insert/update/delete policy for anon or authenticated: writes happen
-- exclusively inside record_public_media_kit_event() / record_media_kit_inquiry_event().
create policy "media_kit_view_events_select_workspace_member"
  on public.media_kit_view_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- ============================================================
-- Functions
-- ============================================================

-- Public read: the only thing an anonymous visitor's browser ever queries.
create or replace function public.get_published_media_kit(p_slug text default 'amore-bloom')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.content
  from public.media_kits mk
  join public.media_kit_published_snapshots s on s.id = mk.current_published_snapshot_id
  where mk.slug = p_slug
    and mk.status = 'published'
    and mk.archived_at is null
  limit 1;
$$;
-- This project's schema-level default privileges grant anon/authenticated/
-- service_role a direct, role-specific EXECUTE privilege at function-
-- creation time, entirely separate from PUBLIC (confirmed via pg_default_acl,
-- the same gap closed for is_workspace_member() et al. in
-- 20260727100100_revoke_anon_from_rls_helper_functions.sql). Revoking from
-- PUBLIC alone never touches that separate grant, so every revoke below
-- targets the named roles explicitly, not just PUBLIC.
revoke all on function public.get_published_media_kit(text) from public, anon, authenticated, service_role;
grant execute on function public.get_published_media_kit(text) to anon, authenticated;

comment on function public.get_published_media_kit(text) is
  'The only anonymous read path. Returns null (never an error) if unpublished/unknown. Returns exactly one jsonb value - the pre-composed, public-safe content column - never a joined view over working tables.';

-- Public write (anon-safe): viewed / cta_clicked / contact_started only.
-- No lead_id parameter exists on this function at all.
create or replace function public.record_public_media_kit_event(
  p_slug text,
  p_event_type text,
  p_visitor_hash text default null,
  p_referrer text default null,
  p_path text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media_kit record;
  v_recent_count integer;
  v_safe_metadata jsonb;
  v_visitor_hash text;
begin
  if p_event_type not in ('viewed', 'cta_clicked', 'contact_started') then
    return; -- inquiry_submitted and any unknown type: silent no-op
  end if;

  select id, workspace_id, current_published_snapshot_id
    into v_media_kit
    from public.media_kits
    where slug = p_slug and status = 'published' and archived_at is null
    limit 1;

  if v_media_kit.id is null then
    return; -- unknown/unpublished: silent no-op, never an error a caller could probe
  end if;

  v_visitor_hash := left(p_visitor_hash, 128);

  if v_visitor_hash is not null then
    select count(*) into v_recent_count
    from public.media_kit_view_events
    where media_kit_id = v_media_kit.id
      and visitor_hash = v_visitor_hash
      and occurred_at > now() - interval '60 seconds';

    if v_recent_count >= 20 then
      return; -- basic per-visitor throttle: silent no-op, never an error
    end if;
  end if;

  -- Metadata allow-list per event_type. Nothing outside this shape survives.
  v_safe_metadata := '{}'::jsonb;
  if p_event_type = 'cta_clicked' and jsonb_typeof(p_metadata -> 'cta_id') = 'string' then
    v_safe_metadata := jsonb_build_object('cta_id', left(p_metadata ->> 'cta_id', 100));
  end if;

  insert into public.media_kit_view_events (
    workspace_id, media_kit_id, published_snapshot_id, lead_id, event_type,
    visitor_hash, referrer, path, metadata, occurred_at
  ) values (
    v_media_kit.workspace_id, v_media_kit.id, v_media_kit.current_published_snapshot_id, null,
    p_event_type,
    v_visitor_hash, left(p_referrer, 500), left(p_path, 300),
    v_safe_metadata,
    now()
  );
end;
$$;
revoke all on function public.record_public_media_kit_event(text, text, text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_public_media_kit_event(text, text, text, text, text, jsonb) to anon, authenticated;

comment on function public.record_public_media_kit_event(text, text, text, text, text, jsonb) is
  'Anonymous-safe. No lead_id parameter exists - ANONYMOUS_CALLER_CAN_SUPPLY_LEAD_ID = NO is enforced by the signature itself, not by runtime clearing. Rejects inquiry_submitted outright. Metadata is rebuilt from a fixed per-event-type allow-list, never passed through. Silent no-op on any invalid/unpublished/throttled input - never an error a caller could use to probe state.';

-- Trusted write: inquiry_submitted only, service_role only, never anon/authenticated.
create or replace function public.record_media_kit_inquiry_event(
  p_slug text,
  p_lead_id uuid,
  p_visitor_hash text default null,
  p_referrer text default null,
  p_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media_kit record;
  v_lead_workspace_id uuid;
begin
  select id, workspace_id, current_published_snapshot_id
    into v_media_kit
    from public.media_kits
    where slug = p_slug and status = 'published' and archived_at is null
    limit 1;

  if v_media_kit.id is null then
    raise exception 'Media Kit not found or not published';
  end if;

  select workspace_id into v_lead_workspace_id from public.leads where id = p_lead_id;

  if v_lead_workspace_id is null or v_lead_workspace_id <> v_media_kit.workspace_id then
    raise exception 'Lead does not belong to this Media Kit''s workspace';
  end if;

  insert into public.media_kit_view_events (
    workspace_id, media_kit_id, published_snapshot_id, lead_id, event_type,
    visitor_hash, referrer, path, metadata, occurred_at
  ) values (
    v_media_kit.workspace_id, v_media_kit.id, v_media_kit.current_published_snapshot_id, p_lead_id,
    'inquiry_submitted',
    left(p_visitor_hash, 128), left(p_referrer, 500), left(p_path, 300),
    '{}'::jsonb,
    now()
  );
end;
$$;
revoke all on function public.record_media_kit_inquiry_event(text, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_media_kit_inquiry_event(text, uuid, text, text, text) to service_role;

comment on function public.record_media_kit_inquiry_event(text, uuid, text, text, text) is
  'Trusted path only - granted to service_role, never anon or authenticated. Called exclusively from the server-side inquiry Server Action, after the Lead has already been created. Re-resolves the Media Kit from slug itself (never trusts a passed media_kit_id) and explicitly verifies the Lead''s workspace_id matches before writing, preventing cross-workspace linkage even from trusted server code.';

-- Staff-only: compose + insert a new immutable snapshot, repoint the pointer.
create or replace function public.publish_media_kit(p_media_kit_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_next_version integer;
  v_snapshot_id uuid;
  v_content jsonb;
begin
  select workspace_id into v_workspace_id
  from public.media_kits
  where id = p_media_kit_id
  for update;

  if v_workspace_id is null then
    raise exception 'Media Kit not found';
  end if;
  if not public.is_workspace_member(v_workspace_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.media_kit_published_snapshots
  where media_kit_id = p_media_kit_id;

  select jsonb_build_object(
    'brand', jsonb_build_object(
      'headline', mk.headline,
      'positioning_statement', mk.positioning_statement,
      'brand_narrative', mk.brand_narrative,
      'location_label', mk.location_label,
      'service_area', mk.service_area,
      'established_year', mk.established_year,
      'specialty_label', mk.specialty_label
    ),
    'contact', jsonb_build_object(
      'headline', mk.contact_headline,
      'subtext', mk.contact_subtext,
      'primary_cta_label', mk.primary_cta_label,
      'primary_cta_type', mk.primary_cta_type,
      'primary_cta_external_url', mk.primary_cta_external_url,
      'secondary_cta_label', mk.secondary_cta_label,
      'secondary_cta_url', mk.secondary_cta_url
    ),
    'social_links', mk.social_links,
    'appearance', mk.appearance,
    'services', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'headline', s.headline_override,
        'description', s.description_override,
        'icon_key', s.icon_key,
        'price_label', s.public_price_label,
        'is_featured', s.is_featured
      ) order by s.sort_order), '[]'::jsonb)
      from public.media_kit_services s
      where s.media_kit_id = mk.id and s.is_included and s.archived_at is null
    ),
    'portfolio', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'category', p.category,
        'location_label', p.location_label,
        'event_year', p.event_year,
        'short_description', p.short_description,
        'is_featured', p.is_featured,
        'gallery', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'media_asset_id', g.media_asset_id,
            'caption', g.caption,
            'is_cover', g.is_cover
          ) order by g.sort_order), '[]'::jsonb)
          from public.media_kit_gallery_items g
          where g.portfolio_item_id = p.id and g.is_included
        )
      ) order by p.sort_order), '[]'::jsonb)
      from public.media_kit_portfolio_items p
      where p.media_kit_id = mk.id and p.is_included and p.archived_at is null
    ),
    'partners', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pt.id,
        'display_name', pt.display_name,
        'logo_media_asset_id', pt.logo_media_asset_id,
        'partner_type', pt.partner_type,
        'is_featured', pt.is_featured
      ) order by pt.sort_order), '[]'::jsonb)
      from public.media_kit_partners pt
      where pt.media_kit_id = mk.id and pt.is_included and pt.archived_at is null
    ),
    'testimonials', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'quote', t.quote,
        'author_name', t.author_name,
        'author_role', t.author_role,
        'photo_media_asset_id', t.photo_media_asset_id,
        'is_featured', t.is_featured
      ) order by t.sort_order), '[]'::jsonb)
      from public.media_kit_testimonials t
      where t.media_kit_id = mk.id and t.is_included and t.is_approved and t.archived_at is null
    ),
    'press', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id,
        'publication_name', pr.publication_name,
        'feature_title', pr.feature_title,
        'url', pr.url,
        'logo_media_asset_id', pr.logo_media_asset_id,
        'featured_on', pr.featured_on
      ) order by pr.sort_order), '[]'::jsonb)
      from public.media_kit_press_features pr
      where pr.media_kit_id = mk.id and pr.is_included and pr.archived_at is null
    ),
    'gallery', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'media_asset_id', g.media_asset_id,
        'caption', g.caption,
        'is_cover', g.is_cover
      ) order by g.sort_order), '[]'::jsonb)
      from public.media_kit_gallery_items g
      where g.media_kit_id = mk.id and g.portfolio_item_id is null and g.is_included
    )
  )
  into v_content
  from public.media_kits mk
  where mk.id = p_media_kit_id;

  insert into public.media_kit_published_snapshots (workspace_id, media_kit_id, version, content, published_by)
  values (v_workspace_id, p_media_kit_id, v_next_version, v_content, auth.uid())
  returning id into v_snapshot_id;

  update public.media_kits
  set current_published_snapshot_id = v_snapshot_id,
      status = 'published',
      published_at = now(),
      published_by = auth.uid()
  where id = p_media_kit_id;

  return v_snapshot_id;
end;
$$;
revoke all on function public.publish_media_kit(uuid) from public, anon, authenticated, service_role;
grant execute on function public.publish_media_kit(uuid) to authenticated;

comment on function public.publish_media_kit(uuid) is
  'Takes a row lock (for update) on the target media_kits row before computing the next version number, serializing concurrent publish attempts for the same Media Kit and preventing a unique(media_kit_id, version) collision. Composes a public-safe DTO containing no foreign key into any private/business table.';

-- Staff-only: fast, reversible show/hide toggle.
create or replace function public.set_media_kit_publication_status(p_media_kit_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  if p_status not in ('published', 'unpublished') then
    raise exception 'Invalid status';
  end if;

  select workspace_id into v_workspace_id from public.media_kits where id = p_media_kit_id;
  if v_workspace_id is null then
    raise exception 'Media Kit not found';
  end if;
  if not public.is_workspace_member(v_workspace_id) then
    raise exception 'Not authorized';
  end if;

  update public.media_kits set status = p_status where id = p_media_kit_id;
end;
$$;
revoke all on function public.set_media_kit_publication_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.set_media_kit_publication_status(uuid, text) to authenticated;

-- Staff-only: rollback to an older snapshot belonging to the SAME Media Kit only.
create or replace function public.rollback_media_kit(p_media_kit_id uuid, p_snapshot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id from public.media_kits where id = p_media_kit_id;
  if v_workspace_id is null then
    raise exception 'Media Kit not found';
  end if;
  if not public.is_workspace_member(v_workspace_id) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.media_kit_published_snapshots
    where id = p_snapshot_id and media_kit_id = p_media_kit_id
  ) then
    raise exception 'Snapshot does not belong to this Media Kit';
  end if;

  update public.media_kits
  set current_published_snapshot_id = p_snapshot_id, status = 'published'
  where id = p_media_kit_id;
end;
$$;
revoke all on function public.rollback_media_kit(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.rollback_media_kit(uuid, uuid) to authenticated;

comment on function public.rollback_media_kit(uuid, uuid) is
  'Explicitly verifies the snapshot belongs to the target Media Kit before repointing, raising an exception otherwise rather than silently affecting zero rows - prevents Media Kit A from ever being repointed to a snapshot belonging to Media Kit B.';
