import { formatMoney } from "@/lib/money";
import { PublicMediaKitCtaButton } from "@/modules/mediaKit/components/PublicMediaKitCtaButton";
import { PublicMediaKitInquiryForm } from "@/modules/mediaKit/components/PublicMediaKitInquiryForm";
import type {
  PublicMediaKitContent,
  PublicMediaKitGalleryImage,
  PublicMediaKitPortfolioItem,
  PublicMediaKitPressFeature,
} from "@/types/mediaKit";

interface PublicMediaKitViewProps {
  content: PublicMediaKitContent;
  /** Pre-resolved signed URLs, keyed by `media_asset_id` — an id with no entry here renders the elegant image-empty state, never a broken image. */
  assetUrls: Map<string, string>;
  brandName: string;
  /** The Media Kit's own slug — needed by every client-side CTA/tracking/inquiry component to reach the right published Media Kit. */
  slug: string;
}

/** The editorial canvas. One width for the whole page so the rhythm reads as a single publication. */
const WIDE = "mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16";

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

function portfolioMeta(item: PublicMediaKitPortfolioItem): string {
  return [item.category, item.location_label, item.event_year ? String(item.event_year) : null].filter(Boolean).join(" · ");
}

/** The small tracked label that opens each band — the page's one recurring editorial motif. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] tracking-[0.22em] text-accent-2 uppercase">{children}</p>;
}

/** A Selected Work plate: photograph first, then title and whatever real metadata exists. */
function WorkPlate({ item, assetUrls, aspectClass }: { item: PublicMediaKitPortfolioItem; assetUrls: Map<string, string>; aspectClass: string }) {
  const meta = portfolioMeta(item);
  return (
    <article>
      <div className={`overflow-hidden rounded-sm ${aspectClass}`}>
        <PublicImage mediaAssetId={coverImageFor(item)} assetUrls={assetUrls} alt={item.title} />
      </div>
      <h3 className="mt-5 font-serif text-[22px] leading-tight text-text">{item.title}</h3>
      {meta ? <p className="mt-1.5 text-[11px] tracking-[0.14em] text-accent-2 uppercase">{meta}</p> : null}
      {item.short_description ? <p className="mt-2.5 max-w-[34ch] text-[15px] leading-relaxed text-text-muted">{item.short_description}</p> : null}
    </article>
  );
}

function GalleryFrame({ image, assetUrls, aspectClass }: { image: PublicMediaKitGalleryImage; assetUrls: Map<string, string>; aspectClass: string }) {
  const url = assetUrls.get(image.media_asset_id);
  if (!url) return null;
  return (
    <figure className={`overflow-hidden rounded-sm ${aspectClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize */}
      <img src={url} alt={image.caption ?? ""} className="h-full w-full object-cover" />
    </figure>
  );
}

function PressLogo({ feature, assetUrls }: { feature: PublicMediaKitPressFeature; assetUrls: Map<string, string> }) {
  const url = feature.logo_media_asset_id ? assetUrls.get(feature.logo_media_asset_id) : undefined;
  const content = url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize
    <img src={url} alt={feature.publication_name} className="h-8 max-w-[150px] object-contain opacity-70 grayscale transition-opacity hover:opacity-100" />
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
 * MEDIAKIT-05 — the public-facing Amoré Bloom Media Kit. Renders ONLY
 * `content` that survived the frozen `publish_media_kit()` composition
 * (already published/is_included/is_approved-filtered) — this component
 * never reaches back into draft data, never fabricates copy, and omits any
 * section with nothing real to show rather than rendering an empty/broken
 * placeholder.
 *
 * MEDIAKIT-06X — the Home is now a short luxury portfolio site, not a long
 * editorial document. Six primary bands, in this order:
 *
 *   01 header + hero   02 services   03 selected work
 *   04 about           05 work with us (CTA + the real inquiry form)
 *   06 footer
 *
 * Recognition (testimonials / partners / press) and the Gallery no longer
 * occupy bands of their own: when real published content exists they appear
 * compactly inside Selected Work and About, so nothing published is lost
 * while the page stays short. Every omission rule and the whole
 * content/DTO/CRM contract are unchanged — this is presentation only.
 *
 * Public metrics are deliberately absent: the published snapshot carries no
 * founder-approved public metric fields, and the visual reference's
 * 200+/150+/25+/100% are illustrative mockup content, never real data.
 */
export function PublicMediaKitView({ content, assetUrls, brandName, slug }: PublicMediaKitViewProps) {
  const { brand, contact, social_links, appearance, services, portfolio, partners, testimonials, press, gallery } = content;

  // A Service entry can publish with a null `headline` (see the documented
  // gap on `PublicMediaKitContent` in src/types/mediaKit.ts) — an entry with
  // no headline has nothing honest to show, so it's omitted rather than
  // rendered blank.
  const visibleServices = services.filter((service) => service.headline);
  const hasAbout = Boolean(brand.brand_narrative || brand.location_label || brand.service_area || brand.established_year || brand.specialty_label);
  const hasServices = visibleServices.length > 0;

  // Home is the preview: three plates lead, the rest stays available just
  // below rather than being hidden behind a link with nowhere to go.
  const leadWork = portfolio.slice(0, 3);
  const restWork = portfolio.slice(3);
  const hasPortfolio = leadWork.length > 0;

  const resolvedGallery = gallery.filter((image) => assetUrls.has(image.media_asset_id));
  const hasGallery = resolvedGallery.length > 0;
  const hasPartners = partners.length > 0;
  const hasTestimonials = testimonials.length > 0;
  const hasPress = press.length > 0;
  const hasRecognition = hasPartners || hasTestimonials || hasPress;

  // The fourth band renders when there is anything real to say — About copy,
  // recognition, or both. Recognition never disappears just because the
  // brand narrative happens to be empty.
  const hasAboutBand = hasAbout || hasRecognition;

  const visibleSocialLinks = social_links.filter((link) => link.is_visible);
  const hasSocial = visibleSocialLinks.length > 0;

  const heroMediaAssetId = typeof appearance.hero_media_asset_id === "string" ? appearance.hero_media_asset_id : null;
  const heroImageUrl = heroMediaAssetId ? assetUrls.get(heroMediaAssetId) : undefined;

  // The closing band borrows a real published photograph when one exists —
  // never a fabricated one. Falls back to the existing deep-wine token band.
  const closingImageUrl =
    resolvedGallery.length > 0 ? assetUrls.get(resolvedGallery[resolvedGallery.length - 1].media_asset_id) : undefined;

  const primaryCtaIsExternal = contact.primary_cta_type === "external_url" && Boolean(contact.primary_cta_external_url);
  const primaryCtaHref = primaryCtaIsExternal ? (contact.primary_cta_external_url as string) : "#contact";
  const ctaTarget = primaryCtaIsExternal ? "_blank" : undefined;
  const ctaRel = primaryCtaIsExternal ? "noopener noreferrer" : undefined;

  const navSections = [
    hasAbout ? { id: "about", label: "About" } : null,
    hasServices ? { id: "services", label: "Services" } : null,
    hasPortfolio ? { id: "portfolio", label: "Portfolio" } : null,
    { id: "contact", label: "Contact" },
  ].filter((section): section is { id: string; label: string } => section !== null);

  return (
    <div className="min-h-screen bg-background text-text">
      {/* ── BAND 01 · header + hero ─────────────────────────────────── */}
      <header className="border-b border-border/60 bg-background">
        <div className={`${WIDE} flex flex-wrap items-center justify-between gap-x-10 gap-y-3 py-5`}>
          <span className="font-serif text-xl tracking-wide text-text">{brandName}</span>
          <nav aria-label="Section navigation" className="flex flex-wrap items-center gap-x-7 gap-y-1.5">
            {navSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-[2px] text-[11px] tracking-[0.14em] text-text-muted uppercase transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {section.label}
              </a>
            ))}
          </nav>
          <PublicMediaKitCtaButton
            slug={slug}
            ctaId="header_primary"
            href={primaryCtaHref}
            target={ctaTarget}
            rel={ctaRel}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-6 py-2.5 text-[12px] font-medium tracking-[0.1em] text-accent-foreground uppercase transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {contact.primary_cta_label}
          </PublicMediaKitCtaButton>
        </div>
      </header>

      <section className="border-b border-border/60">
        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14">
          <div className="px-6 pt-14 pb-2 sm:px-10 lg:py-16 lg:pr-0 lg:pl-16">
            <Eyebrow>{brandName}</Eyebrow>
            <h1 className="mt-5 text-balance font-serif text-[44px] leading-[1.07] text-text sm:text-6xl lg:text-[64px]">{brand.headline || brandName}</h1>
            {brand.positioning_statement ? (
              <p className="mt-6 max-w-md text-lg leading-relaxed text-text-muted">{brand.positioning_statement}</p>
            ) : null}
            <PublicMediaKitCtaButton
              slug={slug}
              ctaId="hero_primary"
              href={primaryCtaHref}
              target={ctaTarget}
              rel={ctaRel}
              className="mt-8 inline-flex items-center justify-center rounded-sm bg-accent px-9 py-3.5 font-serif text-base font-medium tracking-wide text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {contact.primary_cta_label}
            </PublicMediaKitCtaButton>
          </div>

          <div className="overflow-hidden">
            {heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize
              <img src={heroImageUrl} alt="" className="aspect-[4/3] w-full object-cover lg:aspect-[6/5]" />
            ) : (
              <div
                aria-hidden="true"
                className="aspect-[4/3] w-full lg:aspect-[6/5]"
                style={{
                  background:
                    "radial-gradient(ellipse 80% 70% at 40% 30%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent), radial-gradient(ellipse 70% 60% at 85% 85%, color-mix(in srgb, var(--color-accent-2) 14%, transparent), transparent), var(--color-surface-tint)",
                }}
              />
            )}
          </div>
        </div>
      </section>

      {/* ── BAND 02 · services ──────────────────────────────────────── */}
      {hasServices ? (
        <section id="services" className="border-b border-border/60 bg-surface">
          <div className={`${WIDE} py-14 sm:py-[72px]`}>
            <Eyebrow>Our Services</Eyebrow>
            <h2 className="mt-4 font-serif text-4xl text-text sm:text-[42px]">Services</h2>
            <ul className="mt-11 grid grid-cols-1 gap-px bg-border/50 sm:grid-cols-2 lg:grid-cols-3">
              {visibleServices.slice(0, 6).map((service, index) => (
                <li key={service.id} className="bg-surface px-7 py-8 transition-colors hover:bg-background lg:px-8 lg:py-9">
                  <span className="font-serif text-xs text-accent-2 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 font-serif text-[26px] leading-tight text-text">{service.headline}</h3>
                  {service.description ? <p className="mt-2.5 max-w-[30ch] text-[15px] leading-relaxed text-text-muted">{service.description}</p> : null}
                  {service.public_starting_price_minor != null ? (
                    <p className="mt-4 text-[13px] tracking-[0.04em] text-accent-2">
                      {service.price_label ?? "Starting at"} <span className="font-medium">{formatMoney(service.public_starting_price_minor, "USD")}</span>
                    </p>
                  ) : service.price_label ? (
                    <p className="mt-4 text-[13px] tracking-[0.04em] text-accent-2">{service.price_label}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ── BAND 03 · selected work ─────────────────────────────────── */}
      {hasPortfolio || hasGallery ? (
        <section id="portfolio" className="border-b border-border/60">
          <div className={`${WIDE} py-14 sm:py-[72px]`}>
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
              <div>
                <Eyebrow>Selected Work</Eyebrow>
                <h2 className="mt-4 font-serif text-4xl text-text sm:text-[42px]">Portfolio</h2>
              </div>
              {restWork.length > 0 || hasGallery ? (
                <a
                  href="#portfolio-more"
                  className="rounded-[2px] text-[12px] tracking-[0.12em] text-accent uppercase underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  View More Work
                </a>
              ) : null}
            </div>

            {hasPortfolio ? (
              <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {leadWork.map((item) => (
                  <WorkPlate key={item.id} item={item} assetUrls={assetUrls} aspectClass="aspect-[4/3]" />
                ))}
              </div>
            ) : null}

            {restWork.length > 0 || hasGallery ? (
              <div id="portfolio-more" className="mt-14 scroll-mt-24">
                {restWork.length > 0 ? (
                  <>
                    <h3 className="sr-only">More work</h3>
                    <div className="grid grid-cols-2 items-start gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                      {restWork.map((item) => (
                        <WorkPlate key={item.id} item={item} assetUrls={assetUrls} aspectClass="aspect-square" />
                      ))}
                    </div>
                  </>
                ) : null}
                {hasGallery ? (
                  <>
                    <h3 className="sr-only">Gallery</h3>
                    <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 ${restWork.length > 0 ? "mt-8" : ""}`}>
                      {resolvedGallery.map((image) => (
                        <GalleryFrame key={image.media_asset_id} image={image} assetUrls={assetUrls} aspectClass="aspect-square" />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── BAND 04 · about ─────────────────────────────────────────── */}
      {hasAboutBand ? (
        <section id="about" className="border-b border-border/60 bg-surface">
          <div className={`${WIDE} grid grid-cols-1 items-center gap-10 py-14 sm:py-[72px] ${hasAbout ? "lg:grid-cols-[0.95fr_1.05fr] lg:gap-16" : ""}`}>
            {hasAbout ? (
            <div className="overflow-hidden rounded-sm">
              <div className="aspect-[4/5]">
                <PublicImage
                  mediaAssetId={resolvedGallery[0]?.media_asset_id ?? (leadWork[0] ? coverImageFor(leadWork[0]) : null)}
                  assetUrls={assetUrls}
                  alt=""
                />
              </div>
            </div>
            ) : null}

            <div>
              {hasAbout ? <Eyebrow>About {brandName}</Eyebrow> : null}
              {brand.specialty_label ? (
                <h2 className="mt-4 font-serif text-4xl leading-tight text-text sm:text-[42px]">{brand.specialty_label}</h2>
              ) : (
                <h2 className="sr-only">About</h2>
              )}
              {brand.brand_narrative ? (
                <p className="mt-6 max-w-xl text-lg leading-relaxed whitespace-pre-wrap text-text-muted">{brand.brand_narrative}</p>
              ) : null}

              {brand.location_label || brand.service_area || brand.established_year ? (
                <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
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

              {/* Real recognition, compactly — never its own band, never fabricated. */}
              {hasRecognition ? (
                <div className={hasAbout ? "mt-10 border-t border-border/60 pt-8" : ""}>
                  {hasTestimonials ? (
                    <div>
                      <h3 className="text-[11px] tracking-[0.2em] text-accent-2 uppercase">What Clients Say</h3>
                      <div className="mt-4 flex flex-col gap-6">
                        {testimonials.map((testimonial) => (
                          <figure key={testimonial.id}>
                            <blockquote className="max-w-xl font-serif text-xl leading-snug text-text italic">&ldquo;{testimonial.quote}&rdquo;</blockquote>
                            <figcaption className="mt-2 text-[11px] tracking-[0.14em] text-text-muted uppercase">
                              {testimonial.author_name}
                              {testimonial.author_role ? <span className="text-text-muted/70"> — {testimonial.author_role}</span> : null}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {hasPartners ? (
                    <div className={hasTestimonials ? "mt-7" : ""}>
                      <h3 className="text-[11px] tracking-[0.2em] text-accent-2 uppercase">Selected Partners</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-7 gap-y-2">
                        {partners.map((partner) => (
                          <span key={partner.id} className="font-serif text-base text-text">
                            {partner.display_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {hasPress ? (
                    <div className={hasTestimonials || hasPartners ? "mt-7" : ""}>
                      <h3 className="text-[11px] tracking-[0.2em] text-accent-2 uppercase">As Featured In</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-10 gap-y-4">
                        {press.map((feature) => (
                          <PressLogo key={feature.id} feature={feature} assetUrls={assetUrls} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── BAND 05 · work with us: the closing moment and the real CRM form ── */}
      <section id="contact" className="scroll-mt-4">
        <div className="relative overflow-hidden bg-accent-800 text-white">
          {closingImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize */}
              <img src={closingImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div aria-hidden="true" className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-accent-800)_72%,transparent)]" />
            </>
          ) : null}
          <div className={`${WIDE} relative z-10 py-14 text-center sm:py-[72px]`}>
            <p className="text-[12px] tracking-[0.28em] uppercase opacity-75">Work With Us</p>
            <h2 className="mx-auto mt-4 max-w-2xl text-balance font-serif text-4xl leading-[1.1] sm:text-5xl">
              {contact.headline || "Let's create something meaningful."}
            </h2>
            {contact.subtext ? <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed opacity-85">{contact.subtext}</p> : null}
            {contact.secondary_cta_label && contact.secondary_cta_url ? (
              <PublicMediaKitCtaButton
                slug={slug}
                ctaId="secondary"
                href={contact.secondary_cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-block rounded-[2px] text-sm tracking-[0.1em] text-white uppercase underline decoration-white/40 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {contact.secondary_cta_label}
              </PublicMediaKitCtaButton>
            ) : null}
          </div>
        </div>

        <div className="border-b border-border/60 bg-surface">
          <div className={`${WIDE} py-12 sm:py-14`}>
            <div className="mx-auto max-w-2xl">
              <p className="text-center text-[11px] tracking-[0.22em] text-accent-2 uppercase">Tell us about your celebration</p>
              <div className="mt-6 rounded-md border border-border/60 bg-background p-8 sm:p-10">
                <PublicMediaKitInquiryForm slug={slug} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BAND 06 · footer ────────────────────────────────────────── */}
      <footer className="bg-background">
        <div className={`${WIDE} flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left`}>
          <span className="font-serif text-lg tracking-wide text-text">{brandName}</span>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5">
            {navSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-[2px] text-[11px] tracking-[0.14em] text-text-muted uppercase transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {section.label}
              </a>
            ))}
          </nav>
          {hasSocial ? (
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
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
        </div>
      </footer>
    </div>
  );
}
