import { formatMoney } from "@/lib/money";
import { PublicMediaKitCtaButton } from "@/modules/mediaKit/components/PublicMediaKitCtaButton";
import { PublicMediaKitInquiryForm } from "@/modules/mediaKit/components/PublicMediaKitInquiryForm";
import type {
  PublicMediaKitContent,
  PublicMediaKitGalleryImage,
  PublicMediaKitPortfolioItem,
  PublicMediaKitPressFeature,
  PublicMediaKitTestimonial,
} from "@/types/mediaKit";

interface PublicMediaKitViewProps {
  content: PublicMediaKitContent;
  /** Pre-resolved signed URLs, keyed by `media_asset_id` — an id with no entry here renders the elegant image-empty state, never a broken image. */
  assetUrls: Map<string, string>;
  brandName: string;
  /** The Media Kit's own slug — needed by every client-side CTA/tracking/inquiry component to reach the right published Media Kit. */
  slug: string;
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

function coverImageFor(item: PublicMediaKitPortfolioItem): string | null {
  if (item.cover_media_asset_id) return item.cover_media_asset_id;
  const galleryImage = item.gallery.find((image) => image.is_cover) ?? item.gallery[0] ?? null;
  return galleryImage?.media_asset_id ?? null;
}

function PortfolioCard({ item, assetUrls, emphasized }: { item: PublicMediaKitPortfolioItem; assetUrls: Map<string, string>; emphasized: boolean }) {
  const cover = coverImageFor(item);
  const meta = [item.category, item.location_label, item.event_year ? String(item.event_year) : null].filter(Boolean).join(" · ");

  return (
    <article className={emphasized ? "sm:col-span-2" : ""}>
      <div className={`overflow-hidden rounded-sm border border-border/60 ${emphasized ? "aspect-[16/10]" : "aspect-[4/5]"}`}>
        <PublicImage mediaAssetId={cover} assetUrls={assetUrls} alt={item.title} />
      </div>
      <div className="mt-3">
        {meta ? <p className="text-[11px] tracking-[0.15em] text-accent-2 uppercase">{meta}</p> : null}
        <h3 className={`mt-1 font-serif text-text ${emphasized ? "text-2xl" : "text-lg"}`}>{item.title}</h3>
        {item.short_description ? <p className="mt-1.5 max-w-md text-sm text-text-muted">{item.short_description}</p> : null}
      </div>
    </article>
  );
}

function TestimonialQuote({ testimonial, assetUrls }: { testimonial: PublicMediaKitTestimonial; assetUrls: Map<string, string> }) {
  return (
    <figure className="flex flex-col items-center gap-4 text-center">
      {testimonial.photo_media_asset_id ? (
        <div className="h-16 w-16 overflow-hidden rounded-full border border-border/60">
          <PublicImage mediaAssetId={testimonial.photo_media_asset_id} assetUrls={assetUrls} alt={testimonial.author_name} />
        </div>
      ) : null}
      <blockquote className="max-w-md font-serif text-lg leading-relaxed text-text italic">&ldquo;{testimonial.quote}&rdquo;</blockquote>
      <figcaption className="text-xs tracking-[0.1em] text-text-muted uppercase">
        {testimonial.author_name}
        {testimonial.author_role ? <span className="text-text-muted/70"> — {testimonial.author_role}</span> : null}
      </figcaption>
    </figure>
  );
}

function PressLogo({ feature, assetUrls }: { feature: PublicMediaKitPressFeature; assetUrls: Map<string, string> }) {
  const url = feature.logo_media_asset_id ? assetUrls.get(feature.logo_media_asset_id) : undefined;
  const content = url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize
    <img src={url} alt={feature.publication_name} className="h-8 max-w-[140px] object-contain opacity-70 grayscale transition-opacity hover:opacity-100" />
  ) : (
    <span className="font-serif text-sm tracking-wide text-text-muted">{feature.publication_name}</span>
  );
  return feature.url ? (
    <a href={feature.url} target="_blank" rel="noopener noreferrer" className="flex items-center">
      {content}
    </a>
  ) : (
    <div className="flex items-center">{content}</div>
  );
}

/**
 * MEDIAKIT-05 — the public-facing Amoré Bloom Media Kit. Renders ONLY
 * `content` that survived the frozen `publish_media_kit()` composition
 * (already published/is_included/is_approved-filtered) — this component
 * never reaches back into draft data, never fabricates copy, and omits any
 * section with nothing real to show rather than rendering an empty/broken
 * placeholder. Deliberately does not reuse the private Manager's
 * `Card`/admin components: this is a public brand experience, not a
 * dashboard.
 *
 * The Contact section always renders — the real CRM inquiry form is a
 * non-negotiable core feature, not optional content — using persisted
 * copy when set and an already-approved generic label otherwise
 * (`primary_cta_label` always has a real value; the schema itself
 * defaults it, never fabricated Amoré Bloom-specific claims).
 */
export function PublicMediaKitView({ content, assetUrls, brandName, slug }: PublicMediaKitViewProps) {
  const { brand, contact, social_links, appearance, services, portfolio, partners, testimonials, press, gallery } = content;

  // A Service entry can publish with a null `headline` (see the documented
  // gap on `PublicMediaKitContent` in src/types/mediaKit.ts) — a card with
  // no headline has nothing honest to show, so it's omitted rather than
  // rendered blank.
  const visibleServices = services.filter((service) => service.headline);
  const hasAbout = Boolean(brand.brand_narrative || brand.location_label || brand.service_area || brand.established_year || brand.specialty_label);
  const hasServices = visibleServices.length > 0;
  const hasPortfolio = portfolio.length > 0;
  const hasPartners = partners.length > 0;
  const hasTestimonials = testimonials.length > 0;
  const hasPress = press.length > 0;
  const hasGallery = gallery.length > 0;
  const visibleSocialLinks = social_links.filter((link) => link.is_visible);
  const hasSocial = visibleSocialLinks.length > 0;

  const heroMediaAssetId = typeof appearance.hero_media_asset_id === "string" ? appearance.hero_media_asset_id : null;
  const heroImageUrl = heroMediaAssetId ? assetUrls.get(heroMediaAssetId) : undefined;

  const primaryCtaIsExternal = contact.primary_cta_type === "external_url" && Boolean(contact.primary_cta_external_url);
  const primaryCtaHref = primaryCtaIsExternal ? (contact.primary_cta_external_url as string) : "#contact";

  const navSections = [
    hasAbout ? { id: "about", label: "About" } : null,
    hasServices ? { id: "services", label: "Services" } : null,
    hasPortfolio ? { id: "portfolio", label: "Portfolio" } : null,
    hasPartners || hasTestimonials || hasPress ? { id: "recognition", label: "Recognition" } : null,
    hasGallery ? { id: "gallery", label: "Gallery" } : null,
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
      {heroImageUrl ? (
        <section className="relative flex min-h-[70vh] items-end overflow-hidden sm:min-h-[80vh]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize */}
          <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-16 text-center text-white sm:px-10 sm:pb-24">
            <p className="text-[11px] tracking-[0.25em] uppercase opacity-80">{brandName}</p>
            <h1 className="mt-4 text-balance font-serif text-4xl leading-tight sm:text-5xl">{brand.headline || brandName}</h1>
            {brand.positioning_statement ? <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed italic opacity-90">{brand.positioning_statement}</p> : null}
            <PublicMediaKitCtaButton
              slug={slug}
              ctaId="hero_primary"
              href={primaryCtaHref}
              target={primaryCtaIsExternal ? "_blank" : undefined}
              rel={primaryCtaIsExternal ? "noopener noreferrer" : undefined}
              className="mt-8 inline-flex items-center justify-center rounded-sm border border-white bg-white px-7 py-3 font-serif text-sm font-medium tracking-wide text-text transition-opacity hover:opacity-90"
            >
              {contact.primary_cta_label}
            </PublicMediaKitCtaButton>
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:px-10 sm:py-28">
          <p className="text-[11px] tracking-[0.25em] text-accent-2 uppercase">{brandName}</p>
          <h1 className="mt-4 text-balance font-serif text-4xl leading-tight text-text sm:text-5xl">{brand.headline || brandName}</h1>
          {brand.positioning_statement ? <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-muted italic">{brand.positioning_statement}</p> : null}
          <PublicMediaKitCtaButton
            slug={slug}
            ctaId="hero_primary"
            href={primaryCtaHref}
            target={primaryCtaIsExternal ? "_blank" : undefined}
            rel={primaryCtaIsExternal ? "noopener noreferrer" : undefined}
            className="mt-8 inline-flex items-center justify-center rounded-sm border border-accent bg-accent px-7 py-3 font-serif text-sm font-medium tracking-wide text-accent-foreground transition-opacity hover:opacity-90"
          >
            {contact.primary_cta_label}
          </PublicMediaKitCtaButton>
        </section>
      )}

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
                  {service.public_starting_price_minor != null ? (
                    <p className="mt-2 text-sm text-accent-2">
                      {service.price_label ?? "Starting at"} {formatMoney(service.public_starting_price_minor, "USD")}
                    </p>
                  ) : service.price_label ? (
                    <p className="mt-2 text-sm text-accent-2">{service.price_label}</p>
                  ) : null}
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

      {hasPartners || hasTestimonials || hasPress ? (
        <section id="recognition" className="border-t border-border/60">
          {hasTestimonials ? (
            <div className="mx-auto max-w-4xl px-6 py-16 sm:px-10 sm:py-20">
              <h2 className="text-center font-serif text-2xl text-text sm:text-3xl">What Clients Say</h2>
              <div className="mt-10 grid grid-cols-1 gap-12 sm:grid-cols-2">
                {testimonials.map((testimonial) => (
                  <TestimonialQuote key={testimonial.id} testimonial={testimonial} assetUrls={assetUrls} />
                ))}
              </div>
            </div>
          ) : null}

          {hasPartners ? (
            <div className={`mx-auto max-w-4xl px-6 py-14 text-center sm:px-10 ${hasTestimonials ? "border-t border-border/60" : ""}`}>
              <p className="text-[11px] tracking-[0.2em] text-accent-2 uppercase">Selected Partners</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                {partners.map((partner) => (
                  <div key={partner.id} className="flex items-center gap-2">
                    {partner.logo_media_asset_id ? (
                      <div className="h-9 w-9 overflow-hidden rounded-full border border-border/60">
                        <PublicImage mediaAssetId={partner.logo_media_asset_id} assetUrls={assetUrls} alt={partner.display_name} />
                      </div>
                    ) : null}
                    <span className="font-serif text-sm text-text">{partner.display_name}</span>
                    {partner.partner_type ? <span className="text-xs text-text-muted">— {partner.partner_type}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasPress ? (
            <div className={`mx-auto max-w-4xl px-6 py-14 text-center sm:px-10 ${hasTestimonials || hasPartners ? "border-t border-border/60" : ""}`}>
              <p className="text-[11px] tracking-[0.2em] text-accent-2 uppercase">As Featured In</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
                {press.map((feature) => (
                  <PressLogo key={feature.id} feature={feature} assetUrls={assetUrls} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasGallery ? (
        <section id="gallery" className="border-t border-border/60 bg-surface">
          <div className="mx-auto max-w-5xl px-6 py-16 sm:px-10 sm:py-20">
            <h2 className="text-center font-serif text-2xl text-text sm:text-3xl">Gallery</h2>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {gallery.map((image: PublicMediaKitGalleryImage) => (
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
          <h2 className="font-serif text-2xl text-text sm:text-3xl">{contact.headline || "Work With Us"}</h2>
          {contact.subtext ? <p className="mx-auto mt-3 max-w-md text-sm text-text-muted">{contact.subtext}</p> : null}

          <div className="mx-auto mt-8 max-w-md">
            <PublicMediaKitInquiryForm slug={slug} />
          </div>

          {contact.secondary_cta_label && contact.secondary_cta_url ? (
            <PublicMediaKitCtaButton
              slug={slug}
              ctaId="secondary"
              href={contact.secondary_cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block text-xs tracking-[0.1em] text-accent uppercase hover:underline"
            >
              {contact.secondary_cta_label}
            </PublicMediaKitCtaButton>
          ) : null}

          {hasSocial ? (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-border/60 pt-8">
              {visibleSocialLinks.map((link) => (
                <a
                  key={`${link.platform}-${link.handle_or_url}`}
                  href={/^https?:\/\//.test(link.handle_or_url) ? link.handle_or_url : `https://${link.handle_or_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] tracking-[0.1em] text-text-muted uppercase transition-colors hover:text-accent"
                >
                  {link.platform}
                </a>
              ))}
            </div>
          ) : null}

          <p className="mt-10 font-serif text-sm tracking-wide text-text-muted">{brandName}</p>
        </div>
      </footer>
    </div>
  );
}
