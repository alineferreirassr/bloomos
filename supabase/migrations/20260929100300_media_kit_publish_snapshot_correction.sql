-- MEDIAKIT-05 — narrow, additive correction to publish_media_kit()'s
-- snapshot composition. No table changes, no RLS changes, no new columns.
-- Two mechanically-confirmed gaps from MEDIAKIT-04's public rendering pass:
--
-- 1. A curated Service's published `headline`/`description` were the
--    override columns copied verbatim, with no fallback to the canonical
--    Service's own name/description when an override was left empty (the
--    private editor's own documented behavior — "empty override remains
--    empty" — but the public page has nowhere else to source display text
--    from once published, since the snapshot never captured the canonical
--    values). The resolved fallback is computed HERE, at publish time,
--    server-side — never a client-side guess, and the canonical Service's
--    `service_id` still never appears in the output (only the already-
--    resolved display text does), preserving the snapshot's "no foreign
--    key into any private/business table" invariant.
-- 2. A curated Service's `public_starting_price_minor` was never included
--    at all — only `public_price_label` was, making a label-with-no-amount
--    the only possible public pricing presentation. Adding the amount
--    itself; this is the founder-curated PUBLIC price the curator
--    explicitly typed into the Services editor, never a private cost/
--    margin/contract-rate field.
-- 3. A curated Portfolio item's `cover_media_asset_id` (edited in the
--    private Portfolio editor) was never serialized — only that item's own
--    `media_kit_gallery_items` rows (via `is_cover`) reached the snapshot,
--    silently overriding an explicit cover selection with "first gallery
--    image" whenever the founder never also duplicated that same image
--    into the item's own gallery. Adding the field directly: still only a
--    `media_asset_id` reference (the same class of reference the gallery
--    arrays already expose), resolved to a signed URL by the public
--    renderer at request time, exactly like every other image reference in
--    this snapshot.
--
-- `create or replace function` preserves the existing revoke/grant ACLs
-- (Postgres does not reset function privileges on replace), but every
-- other function in the foundation migration re-states its revoke/grant
-- explicitly as inline documentation of intent, so this correction matches
-- that same convention rather than relying on ACL persistence silently.

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
        'headline', coalesce(s.headline_override, svc.name),
        'description', coalesce(s.description_override, svc.description),
        'icon_key', s.icon_key,
        'public_starting_price_minor', s.public_starting_price_minor,
        'price_label', s.public_price_label,
        'is_featured', s.is_featured
      ) order by s.sort_order), '[]'::jsonb)
      from public.media_kit_services s
      join public.services svc on svc.id = s.service_id
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
        'cover_media_asset_id', p.cover_media_asset_id,
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
  'MEDIAKIT-05 correction: Services now resolve headline/description to the canonical Service''s own name/description when the curator left an override empty, and carry public_starting_price_minor; Portfolio items now carry cover_media_asset_id directly. Still composes a public-safe DTO containing no foreign key into any private/business table — only the already-resolved display text and media_asset_id references. Takes a row lock (for update) on the target media_kits row before computing the next version number, serializing concurrent publish attempts for the same Media Kit and preventing a unique(media_kit_id, version) collision.';
