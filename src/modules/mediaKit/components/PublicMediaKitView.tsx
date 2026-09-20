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

/** The editorial canvas width — deliberately wider than the private BloomOS Manager's admin content width. Images and major visual sections use this; prose nests a narrower reading measure inside it. */
const WIDE = "mx-auto w-full max-w-[1400px] px-6 sm:px-10 lg:px-16";

function PublicImage({ mediaAssetId, assetUrls, alt, className = "" }: { mediaAssetId: string | null; assetUrls: Map<string, string>; alt: string; className?: string }) {
  const url = mediaAssetId ? assetUrls.get(mediaAssetId) : undefined;
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize
    return <img src={url} alt={alt} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--color-accent)_6%,var(--color-surface-tint))] ${className}`}>
      <span aria-hidden="true" className="font-serif text-3xl text-accent/25">
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
      <div className={`overflow-hidden rounded-sm border border-border/60 ${emphasized ? "aspect-[16/9]" : "aspect-[3/4]"}`}>
        <PublicImage mediaAssetId={cover} assetUrls={assetUrls} alt={item.title} />
      </div>
      <div className="mt-5">
        {meta ? <p className="text-[11px] tracking-[0.18em] text-accent-2 uppercase">{meta}</p> : null}
        <h3 className={`mt-1.5 font-serif text-text ${emphasized ? "text-3xl sm:text-4xl" : "text-2xl"}`}>{item.title}</h3>
        {item.short_description ? <p className="mt-2 max-w-md text-base leading-relaxed text-text-muted">{item.short_description}</p> : null}
      </div>
    </article>
  );
}

function TestimonialQuote({ testimonial, assetUrls }: { testimonial: PublicMediaKitTestimonial; assetUrls: Map<string, string> }) {
  return (
    <figure className="flex flex-col items-center gap-5 text-center">
      {testimonial.photo_media_asset_id ? (
        <div className="h-20 w-20 overflow-hidden rounded-full border border-border/60">
          <PublicImage mediaAssetId={testimonial.photo_media_asset_id} assetUrls={assetUrls} alt={testimonial.author_name} />
        </div>
      ) : (
        <span aria-hidden="true" className="font-serif text-2xl text-accent/30">
          ✦
        </span>
      )}
      <blockquote className="max-w-lg text-balance font-serif text-2xl leading-snug text-text italic sm:text-[28px]">&ldquo;{testimonial.quote}&rdquo;</blockquote>
      <figcaption className="text-xs tracking-[0.14em] text-text-muted uppercase">
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
    <img src={url} alt={feature.publication_name} className="h-9 max-w-[160px] object-contain opacity-70 grayscale transition-opacity hover:opacity-100" />
  ) : (
    <span className="font-serif text-base tracking-wide text-text-muted">{feature.publication_name}</span>
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
 * A light deterministic rhythm for the masonry gallery — every third image
 * reads slightly taller so the grid has real editorial variation instead of
 * a uniform checkerboard, without needing to measure real image
 * dimensions client-side.
 */
function galleryAspect(index: number): string {
  return index % 3 === 0 ? "aspect-[3/4]" : index % 3 === 1 ? "aspect-square" : "aspect-[4/5]";
}

function GalleryImage({ image, assetUrls, aspectClass }: { image: PublicMediaKitGalleryImage; assetUrls: Map<string, string>; aspectClass: string }) {
  const url = assetUrls.get(image.media_asset_id);
  if (!url) return null;
  return (
    <div className={`mb-4 break-inside-avoid overflow-hidden rounded-sm border border-border/60 ${aspectClass} sm:mb-6`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize */}
      <img src={url} alt={image.caption ?? "Gallery image"} className="h-full w-full object-cover" />
    </div>
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
 *
 * MEDIAKIT-05V — a visual-only pass over the same content/DTO: a wider
 * editorial canvas (`WIDE`, 1400px, wider than the private Manager's admin
 * width), larger type/image scale throughout, and a Gallery section that
 * only ever renders when at least one of its images has a REAL resolved
 * URL (`assetUrls` has an entry) — a Gallery row existing in the snapshot
 * is not enough on its own; an unresolvable asset is treated the same as
 * "no gallery" rather than rendering a lone placeholder tile as the entire
 * section.
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
  const resolvedGallery = gallery.filter((image) => assetUrls.has(image.media_asset_id));
  const hasGallery = resolvedGallery.length > 0;
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
        <div className={`${WIDE} flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between`}>
          <span className="font-serif text-xl tracking-wide text-text">{brandName}</span>
          {navSections.length > 0 ? (
            <nav aria-label="Section navigation" className="flex flex-wrap gap-x-6 gap-y-1.5">
              {navSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-[2px] text-[11px] tracking-[0.14em] text-text-muted uppercase transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:text-xs"
                >
                  {section.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      {/* Hero / first fold */}
      {heroImageUrl ? (
        <section className="relative flex min-h-[85vh] items-end overflow-hidden sm:min-h-screen">
          {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize */}
          <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
          <div className={`${WIDE} relative z-10 pb-20 text-white sm:pb-28`}>
            <div className="max-w-3xl">
              <p className="text-[12px] tracking-[0.3em] uppercase opacity-85">{brandName}</p>
              <h1 className="mt-5 text-balance font-serif text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">{brand.headline || brandName}</h1>
              {brand.positioning_statement ? <p className="mt-6 max-w-xl text-lg leading-relaxed italic opacity-90 sm:text-xl">{brand.positioning_statement}</p> : null}
              <PublicMediaKitCtaButton
                slug={slug}
                ctaId="hero_primary"
                href={primaryCtaHref}
                target={primaryCtaIsExternal ? "_blank" : undefined}
                rel={primaryCtaIsExternal ? "noopener noreferrer" : undefined}
                className="mt-10 inline-flex items-center justify-center rounded-sm border border-white bg-white px-9 py-4 font-serif text-base font-medium tracking-wide text-text transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {contact.primary_cta_label}
              </PublicMediaKitCtaButton>
            </div>
          </div>
        </section>
      ) : (
        <section className="flex min-h-[75vh] items-center border-b border-border/60 sm:min-h-[85vh]">
          <div className={`${WIDE} text-center`}>
            <span aria-hidden="true" className="font-serif text-3xl text-accent/40">
              ✦
            </span>
            <p className="mt-5 text-[12px] tracking-[0.3em] text-accent-2 uppercase">{brandName}</p>
            <h1 className="mx-auto mt-5 max-w-4xl text-balance font-serif text-6xl leading-[1.05] text-text sm:text-7xl lg:text-8xl">{brand.headline || brandName}</h1>
            {brand.positioning_statement ? (
              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-text-muted italic sm:text-xl">{brand.positioning_statement}</p>
            ) : null}
            <PublicMediaKitCtaButton
              slug={slug}
              ctaId="hero_primary"
              href={primaryCtaHref}
              target={primaryCtaIsExternal ? "_blank" : undefined}
              rel={primaryCtaIsExternal ? "noopener noreferrer" : undefined}
              className="mt-10 inline-flex items-center justify-center rounded-sm border border-accent bg-accent px-9 py-4 font-serif text-base font-medium tracking-wide text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {contact.primary_cta_label}
            </PublicMediaKitCtaButton>
          </div>
        </section>
      )}

      {hasAbout ? (
        <section id="about" className="border-b border-border/60 bg-surface">
          <div className={`${WIDE} grid grid-cols-1 gap-12 py-24 sm:py-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}>
            <div>
              {brand.specialty_label ? (
                <h2 className="font-serif text-3xl leading-tight text-text sm:text-4xl">{brand.specialty_label}</h2>
              ) : (
                <h2 className="sr-only">About</h2>
              )}
              {brand.location_label || brand.service_area || brand.established_year ? (
                <dl className="mt-8 space-y-3">
                  {brand.location_label ? (
                    <div>
                      <dt className="text-[11px] tracking-[0.14em] text-accent-2 uppercase">Based In</dt>
                      <dd className="mt-0.5 text-base text-text">{brand.location_label}</dd>
                    </div>
                  ) : null}
                  {brand.service_area ? (
                    <div>
                      <dt className="text-[11px] tracking-[0.14em] text-accent-2 uppercase">Service Area</dt>
                      <dd className="mt-0.5 text-base text-text">{brand.service_area}</dd>
                    </div>
                  ) : null}
                  {brand.established_year ? (
                    <div>
                      <dt className="text-[11px] tracking-[0.14em] text-accent-2 uppercase">Established</dt>
                      <dd className="mt-0.5 text-base text-text">{brand.established_year}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
            {brand.brand_narrative ? (
              <p className="max-w-2xl text-xl leading-relaxed whitespace-pre-wrap text-text">{brand.brand_narrative}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {hasServices ? (
        <section id="services" className="border-b border-border/60">
          <div className={`${WIDE} py-24 sm:py-32`}>
            <h2 className="font-serif text-4xl text-text sm:text-5xl">Services</h2>
            <div className="mt-16 grid grid-cols-1 gap-x-16 gap-y-16 lg:grid-cols-2">
              {visibleServices.map((service, index) => (
                <div key={service.id} className={`border-t pt-6 ${service.is_featured ? "border-accent" : "border-border"}`}>
                  <div className="flex items-baseline gap-4">
                    <span className="font-serif text-sm text-accent-2 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    {service.is_featured ? <span className="text-[10px] tracking-[0.18em] text-accent uppercase">Featured</span> : null}
                  </div>
                  <h3 className="mt-3 font-serif text-2xl text-text sm:text-3xl">{service.headline}</h3>
                  {service.description ? <p className="mt-3 max-w-lg text-base leading-relaxed text-text-muted">{service.description}</p> : null}
                  {service.public_starting_price_minor != null ? (
                    <p className="mt-4 text-base text-accent-2">
                      {service.price_label ?? "Starting at"} <span className="font-medium">{formatMoney(service.public_starting_price_minor, "USD")}</span>
                    </p>
                  ) : service.price_label ? (
                    <p className="mt-4 text-base text-accent-2">{service.price_label}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasPortfolio ? (
        <section id="portfolio" className="border-b border-border/60 bg-surface">
          <div className={`${WIDE} py-24 sm:py-32`}>
            <h2 className="font-serif text-4xl text-text sm:text-5xl">Portfolio</h2>
            <div className="mt-16 grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2">
              {portfolio.map((item, index) => (
                <PortfolioCard key={item.id} item={item} assetUrls={assetUrls} emphasized={item.is_featured && index === 0} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {hasPartners || hasTestimonials || hasPress ? (
        <section id="recognition" className="border-b border-border/60">
          {hasTestimonials ? (
            <div className={`${WIDE} py-24 sm:py-32`}>
              <h2 className="text-center font-serif text-4xl text-text sm:text-5xl">What Clients Say</h2>
              <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-16 sm:grid-cols-2">
                {testimonials.map((testimonial) => (
                  <TestimonialQuote key={testimonial.id} testimonial={testimonial} assetUrls={assetUrls} />
                ))}
              </div>
            </div>
          ) : null}

          {hasPartners ? (
            <div className={`${WIDE} py-20 text-center ${hasTestimonials ? "border-t border-border/60" : ""}`}>
              <h2 className="text-[11px] tracking-[0.22em] text-accent-2 uppercase">Selected Partners</h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                {partners.map((partner) => (
                  <div key={partner.id} className="flex items-center gap-3">
                    {partner.logo_media_asset_id ? (
                      <div className="h-11 w-11 overflow-hidden rounded-full border border-border/60">
                        <PublicImage mediaAssetId={partner.logo_media_asset_id} assetUrls={assetUrls} alt={partner.display_name} />
                      </div>
                    ) : null}
                    <span className="font-serif text-base text-text">{partner.display_name}</span>
                    {partner.partner_type ? <span className="text-sm text-text-muted">— {partner.partner_type}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasPress ? (
            <div className={`${WIDE} py-20 text-center ${hasTestimonials || hasPartners ? "border-t border-border/60" : ""}`}>
              <h2 className="text-[11px] tracking-[0.22em] text-accent-2 uppercase">As Featured In</h2>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-14 gap-y-6">
                {press.map((feature) => (
                  <PressLogo key={feature.id} feature={feature} assetUrls={assetUrls} />
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {hasGallery ? (
        <section id="gallery" className="border-b border-border/60 bg-surface">
          <div className={`${WIDE} py-24 sm:py-32`}>
            <h2 className="font-serif text-4xl text-text sm:text-5xl">Gallery</h2>
            {resolvedGallery.length === 1 ? (
              <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-sm border border-border/60">
                <GalleryImage image={resolvedGallery[0]} assetUrls={assetUrls} aspectClass="aspect-[16/9]" />
              </div>
            ) : (
              <div className="mt-16 columns-1 gap-4 sm:columns-2 sm:gap-6 lg:columns-3">
                {resolvedGallery.map((image, index) => (
                  <GalleryImage key={image.media_asset_id} image={image} assetUrls={assetUrls} aspectClass={galleryAspect(index)} />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Work With Us — the strong closing conversion moment. */}
      <section id="contact" className="bg-surface-tint">
        <div className={`${WIDE} py-24 sm:py-32`}>
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-24">
            <div className="lg:pt-4">
              <h2 className="font-serif text-4xl leading-tight text-text sm:text-5xl">{contact.headline || "Work With Us"}</h2>
              {contact.subtext ? <p className="mt-5 max-w-md text-lg leading-relaxed text-text-muted">{contact.subtext}</p> : null}

              {contact.secondary_cta_label && contact.secondary_cta_url ? (
                <PublicMediaKitCtaButton
                  slug={slug}
                  ctaId="secondary"
                  href={contact.secondary_cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-block rounded-[2px] text-sm tracking-[0.1em] text-accent uppercase hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {contact.secondary_cta_label}
                </PublicMediaKitCtaButton>
              ) : null}
            </div>

            <div className="rounded-sm border border-border/60 bg-background p-8 sm:p-10">
              <PublicMediaKitInquiryForm slug={slug} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 bg-background">
        <div className={`${WIDE} flex flex-col items-center gap-5 py-14 text-center`}>
          {hasSocial ? (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {visibleSocialLinks.map((link) => (
                <a
                  key={`${link.platform}-${link.handle_or_url}`}
                  href={/^https?:\/\//.test(link.handle_or_url) ? link.handle_or_url : `https://${link.handle_or_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[2px] text-[11px] tracking-[0.14em] text-text-muted uppercase transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {link.platform}
                </a>
              ))}
            </div>
          ) : null}
          <p className="font-serif text-base tracking-wide text-text-muted">{brandName}</p>
        </div>
      </footer>
    </div>
  );
}
