import type { PublicMediaKitContent, PublicMediaKitGalleryImage, PublicMediaKitPortfolioItem } from "@/types/mediaKit";

interface PublicMediaKitViewProps {
  content: PublicMediaKitContent;
  /** Pre-resolved signed URLs, keyed by `media_asset_id` — an id with no entry here renders the elegant image-empty state, never a broken image. */
  assetUrls: Map<string, string>;
  brandName: string;
}

function PublicImage({ mediaAssetId, assetUrls, alt, className = "" }: { mediaAssetId: string | null; assetUrls: Map<string, string>; alt: string; className?: string }) {
  const url = mediaAssetId ? assetUrls.get(mediaAssetId) : undefined;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize
    return <img src={url} alt={alt} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-surface-tint))] ${className}`}>
      <span aria-hidden="true" className="font-serif text-2xl text-accent/25">
        ✦
      </span>
    </div>
  );
}

function coverImageFor(gallery: PublicMediaKitGalleryImage[]): PublicMediaKitGalleryImage | null {
  return gallery.find((image) => image.is_cover) ?? gallery[0] ?? null;
}

function PortfolioCard({ item, assetUrls, emphasized }: { item: PublicMediaKitPortfolioItem; assetUrls: Map<string, string>; emphasized: boolean }) {
  const cover = coverImageFor(item.gallery);
  const meta = [item.category, item.location_label, item.event_year ? String(item.event_year) : null].filter(Boolean).join(" · ");

  return (
    <article className={emphasized ? "sm:col-span-2" : ""}>
      <div className={`overflow-hidden rounded-sm border border-border/60 ${emphasized ? "aspect-[16/10]" : "aspect-[4/5]"}`}>
        <PublicImage mediaAssetId={cover?.media_asset_id ?? null} assetUrls={assetUrls} alt={item.title} />
      </div>
      <div className="mt-3">
        {meta ? <p className="text-[11px] tracking-[0.15em] text-accent-2 uppercase">{meta}</p> : null}
        <h3 className={`mt-1 font-serif text-text ${emphasized ? "text-2xl" : "text-lg"}`}>{item.title}</h3>
        {item.short_description ? <p className="mt-1.5 max-w-md text-sm text-text-muted">{item.short_description}</p> : null}
      </div>
    </article>
  );
}

/**
 * MEDIAKIT-04 — the public-facing Amoré Bloom Media Kit. Renders ONLY
 * `content` that survived the frozen `publish_media_kit()` composition
 * (already published/is_included-filtered) — this component never reaches
 * back into draft data, never fabricates copy, and omits any section with
 * nothing real to show rather than rendering an empty/broken placeholder.
 * Deliberately does not reuse the private Manager's `Card`/admin
 * components: this is a public brand experience, not a dashboard.
 */
export function PublicMediaKitView({ content, assetUrls, brandName }: PublicMediaKitViewProps) {
  const { brand, contact, services, portfolio, gallery } = content;

  // A Service entry can publish with a null `headline` (see the documented
  // gap on `PublicMediaKitContent` in src/types/mediaKit.ts) — a card with
  // no headline has nothing honest to show, so it's omitted rather than
  // rendered blank.
  const visibleServices = services.filter((service) => service.headline);
  const hasAbout = Boolean(brand.brand_narrative || brand.location_label || brand.service_area || brand.established_year || brand.specialty_label);
  const hasServices = visibleServices.length > 0;
  const hasPortfolio = portfolio.length > 0;
  const hasGallery = gallery.length > 0;
  const hasContact = Boolean(contact.headline || contact.subtext);
  const primaryCta = contact.primary_cta_type === "external_url" && contact.primary_cta_external_url ? contact.primary_cta_external_url : null;

  const navSections = [
    hasAbout ? { id: "about", label: "About" } : null,
    hasServices ? { id: "services", label: "Services" } : null,
    hasPortfolio ? { id: "portfolio", label: "Portfolio" } : null,
    hasGallery ? { id: "gallery", label: "Gallery" } : null,
    hasContact || primaryCta ? { id: "contact", label: "Contact" } : null,
  ].filter((section): section is { id: string; label: string } => section !== null);

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-2 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span className="font-serif text-lg tracking-wide text-text">{brandName}</span>
          {navSections.length > 0 ? (
            <nav aria-label="Section navigation" className="flex flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
              {navSections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="text-[11px] tracking-[0.1em] text-text-muted uppercase transition-colors hover:text-accent sm:text-xs">
                  {section.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      {/* Hero / first fold */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:px-10 sm:py-28">
        <p className="text-[11px] tracking-[0.25em] text-accent-2 uppercase">{brandName}</p>
        {brand.headline ? (
          <h1 className="mt-4 text-balance font-serif text-4xl leading-tight text-text sm:text-5xl">{brand.headline}</h1>
        ) : (
          <h1 className="mt-4 text-balance font-serif text-4xl leading-tight text-text sm:text-5xl">{brandName}</h1>
        )}
        {brand.positioning_statement ? <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-muted italic">{brand.positioning_statement}</p> : null}
        {primaryCta ? (
          <a
            href={primaryCta}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center justify-center rounded-sm border border-accent bg-accent px-7 py-3 font-serif text-sm font-medium tracking-wide text-accent-foreground transition-opacity hover:opacity-90"
          >
            {contact.primary_cta_label}
          </a>
        ) : null}
      </section>

      {hasAbout ? (
        <section id="about" className="border-t border-border/60 bg-surface">
          <div className="mx-auto max-w-2xl px-6 py-16 text-center sm:px-10 sm:py-20">
            {brand.specialty_label ? <p className="text-[11px] tracking-[0.2em] text-accent-2 uppercase">{brand.specialty_label}</p> : null}
            {brand.brand_narrative ? <p className="mt-4 text-base leading-relaxed whitespace-pre-wrap text-text">{brand.brand_narrative}</p> : null}
            {brand.location_label || brand.service_area || brand.established_year ? (
              <p className="mt-6 text-xs tracking-[0.1em] text-text-muted uppercase">
                {[brand.location_label, brand.service_area ? `Serving ${brand.service_area}` : null, brand.established_year ? `Est. ${brand.established_year}` : null]
                  .filter(Boolean)
                  .join("  ·  ")}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasServices ? (
        <section id="services" className="border-t border-border/60">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
            <h2 className="text-center font-serif text-2xl text-text sm:text-3xl">Services</h2>
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {visibleServices.map((service) => (
                <div key={service.id} className={`border-t pt-4 ${service.is_featured ? "border-accent" : "border-border"}`}>
                  {service.is_featured ? <p className="mb-1 text-[10px] tracking-[0.15em] text-accent uppercase">Featured</p> : null}
                  <h3 className="font-serif text-lg text-text">{service.headline}</h3>
                  {service.description ? <p className="mt-1.5 text-sm text-text-muted">{service.description}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasPortfolio ? (
        <section id="portfolio" className="border-t border-border/60 bg-surface">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
            <h2 className="text-center font-serif text-2xl text-text sm:text-3xl">Portfolio</h2>
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
              {portfolio.map((item, index) => (
                <PortfolioCard key={item.id} item={item} assetUrls={assetUrls} emphasized={item.is_featured && index === 0} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasGallery ? (
        <section id="gallery" className="border-t border-border/60">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
            <h2 className="text-center font-serif text-2xl text-text sm:text-3xl">Gallery</h2>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {gallery.map((image) => (
                <div key={image.media_asset_id} className="aspect-square overflow-hidden rounded-sm border border-border/60">
                  <PublicImage mediaAssetId={image.media_asset_id} assetUrls={assetUrls} alt={image.caption ?? "Gallery image"} />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <footer id="contact" className="border-t border-border/60 bg-surface">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center sm:px-10 sm:py-20">
          {contact.headline ? <h2 className="font-serif text-2xl text-text sm:text-3xl">{contact.headline}</h2> : null}
          {contact.subtext ? <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">{contact.subtext}</p> : null}
          {primaryCta ? (
            <a
              href={primaryCta}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center rounded-sm border border-accent bg-accent px-7 py-3 font-serif text-sm font-medium tracking-wide text-accent-foreground transition-opacity hover:opacity-90"
            >
              {contact.primary_cta_label}
            </a>
          ) : null}
          <p className={contact.headline || contact.subtext ? "mt-10 font-serif text-sm tracking-wide text-text-muted" : "font-serif text-sm tracking-wide text-text-muted"}>{brandName}</p>
        </div>
      </footer>
    </div>
  );
}
