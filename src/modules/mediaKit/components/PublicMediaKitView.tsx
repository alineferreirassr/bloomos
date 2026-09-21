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

const PAGE = "mx-auto w-full max-w-[1440px] px-6 sm:px-10 lg:px-16";

/**
 * Founder-approved public Media Kit brand copy (MEDIAKIT-06Z.1 §1). Approved
 * as a brand constant rather than persisted content — rendering it needs no
 * schema change, and it is not per-workspace data.
 */
const BRAND_TAGLINE = ["People", "Places", "Meaningful", "Moments"] as const;

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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] tracking-[0.24em] text-accent uppercase">{children}</p>;
}

/**
 * A Selected Work plate. The aspect is supplied by the composition, not by the
 * item: the approved layout assigns a dominant, a secondary and a detail
 * shape, and each published item is cropped into the slot it occupies.
 */
function Plate({ item, assetUrls, aspect, className = "" }: { item: PublicMediaKitPortfolioItem; assetUrls: Map<string, string>; aspect: string; className?: string }) {
  const meta = portfolioMeta(item);
  return (
    <figure className={className}>
      <div className={`overflow-hidden rounded-sm ${aspect}`}>
        <PublicImage mediaAssetId={coverImageFor(item)} assetUrls={assetUrls} alt={item.title} />
      </div>
      <figcaption className="mt-3.5">
        <h3 className="font-serif text-[20px] leading-tight text-text">{item.title}</h3>
        {meta ? <p className="mt-1 text-[13px] text-text-muted">{meta}</p> : null}
        {item.short_description ? <p className="mt-2 max-w-[42ch] text-[14px] leading-relaxed text-text-muted">{item.short_description}</p> : null}
      </figcaption>
    </figure>
  );
}

function GalleryFrame({ image, assetUrls }: { image: PublicMediaKitGalleryImage; assetUrls: Map<string, string> }) {
  const url = assetUrls.get(image.media_asset_id);
  if (!url) return null;
  return (
    <figure className="aspect-square overflow-hidden rounded-sm">
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
 * MEDIAKIT-06Z — the composition approved as MEDIAKIT-06Y.2, translated onto
 * the canonical renderer. Six content moments; no section was added:
 *
 *   header · hero · services · selected work · about · work with us · footer
 *
 * The three visual locks of that approval:
 *   - the hero is ONE scene washed toward the copy, with a smaller secondary
 *     print near the text/image seam — never a text-rectangle/image-rectangle
 *     split;
 *   - Services is a compact index of three pairs (01/02, 03/04, 05/06);
 *   - Selected Work is asymmetric — a dominant 4:5, a secondary 3:2 dropped
 *     lower, and a square detail inset further — never three equal cards.
 *
 * Every image slot is filled from published Media Kit assets and simply does
 * not render when an asset is absent; the prototype defined aspect, crop,
 * placement and hierarchy, never the photograph. All copy is persisted
 * content or an already-approved generic label — no prototype marketing copy
 * was carried across.
 */
export function PublicMediaKitView({ content, assetUrls, brandName, slug }: PublicMediaKitViewProps) {
  const { brand, contact, social_links, appearance, services, portfolio, partners, testimonials, press, gallery } = content;

  // A Service entry can publish with a null `headline` (see the documented
  // gap on `PublicMediaKitContent` in src/types/mediaKit.ts) — an entry with
  // no headline has nothing honest to show, so it's omitted.
  const visibleServices = services.filter((service) => service.headline).slice(0, 6);
  const servicePairs = [visibleServices.slice(0, 2), visibleServices.slice(2, 4), visibleServices.slice(4, 6)].filter((p) => p.length > 0);
  const hasServices = visibleServices.length > 0;

  // Canonical ordering: the publish snapshot already returns portfolio by
  // `sort_order`, so the first three published items take the dominant,
  // secondary and detail placements in that order.
  const [dominant, secondary, detail] = portfolio;
  const hasPortfolio = portfolio.length > 0;

  const resolvedGallery = gallery.filter((image) => assetUrls.has(image.media_asset_id));
  // The Home is a preview, not the whole Media Kit: at most three gallery
  // images are shown here. Everything else stays published and intact in the
  // snapshot for a dedicated Portfolio experience later.
  const galleryPreview = resolvedGallery.slice(0, 3);

  // Secondary imagery is drawn from published gallery assets. Crucially it is
  // BORROWED, never consumed: every resolved gallery image still renders in
  // the gallery grid below, so no published photograph can disappear into a
  // decorative slot. A print is only used once there are at least two images,
  // so a single-image kit never shows the same photograph twice on one screen.
  const heroMediaAssetId = typeof appearance.hero_media_asset_id === "string" ? appearance.hero_media_asset_id : null;
  const heroImageUrl = heroMediaAssetId ? assetUrls.get(heroMediaAssetId) : undefined;
  const heroPrintId = resolvedGallery.length >= 2 ? resolvedGallery[1].media_asset_id : null;
  const aboutImageId = resolvedGallery[0]?.media_asset_id ?? (dominant ? coverImageFor(dominant) : null);
  const aboutPrintId = resolvedGallery.length >= 3 ? resolvedGallery[2].media_asset_id : null;
  const closingId = resolvedGallery.length > 0 ? resolvedGallery[resolvedGallery.length - 1].media_asset_id : null;
  const closingUrl = closingId ? assetUrls.get(closingId) : undefined;
  const hasGallery = resolvedGallery.length > 0;

  const hasAbout = Boolean(brand.brand_narrative || brand.location_label || brand.service_area || brand.established_year || brand.specialty_label);
  const hasPartners = partners.length > 0;
  const leadTestimonial = testimonials[0] ?? null;
  const hasTestimonials = Boolean(leadTestimonial);
  const hasPress = press.length > 0;
  const hasRecognition = hasPartners || hasTestimonials || hasPress;
  const hasAboutBand = hasAbout || hasRecognition;

  const visibleSocialLinks = social_links.filter((link) => link.is_visible);

  const primaryCtaIsExternal = contact.primary_cta_type === "external_url" && Boolean(contact.primary_cta_external_url);
  const primaryCtaHref = primaryCtaIsExternal ? (contact.primary_cta_external_url as string) : "#contact";
  const ctaTarget = primaryCtaIsExternal ? "_blank" : undefined;
  const ctaRel = primaryCtaIsExternal ? "noopener noreferrer" : undefined;

  const navSections = [
    hasAboutBand ? { id: "about", label: "About" } : null,
    hasServices ? { id: "services", label: "Services" } : null,
    hasPortfolio ? { id: "portfolio", label: "Portfolio" } : null,
    { id: "contact", label: "Contact" },
  ].filter((section): section is { id: string; label: string } => section !== null);

  return (
    <div className="min-h-screen bg-background text-text">
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header className="bg-surface">
        <div className={`${PAGE} flex flex-wrap items-center justify-between gap-6 py-5`}>
          <span className="font-serif text-[26px] leading-none text-accent">{brandName}</span>
          <nav aria-label="Section navigation" className="flex flex-wrap items-center gap-x-9 gap-y-2">
            {navSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-[2px] text-[15px] text-text-muted transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
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
            className="inline-flex items-center gap-2 rounded-sm bg-accent px-7 py-3 text-[14px] font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {contact.primary_cta_label} <span aria-hidden>→</span>
          </PublicMediaKitCtaButton>
        </div>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-surface">
        <div className="relative mx-auto w-full max-w-[1440px]">
          {heroImageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize */}
              <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to right, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 92%, transparent) 24%, color-mix(in srgb, var(--color-surface) 45%, transparent) 44%, transparent 60%)",
                }}
              />
            </>
          ) : (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 70% 70% at 72% 30%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent), radial-gradient(ellipse 60% 60% at 90% 85%, color-mix(in srgb, var(--color-accent-2) 12%, transparent), transparent)",
              }}
            />
          )}

          <div className="relative grid grid-cols-1 items-center gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-16 lg:py-20">
            <div>
              <Eyebrow>{brandName}</Eyebrow>
              <h1 className="mt-6 font-serif text-[46px] leading-[1.08] text-accent-800 sm:text-[56px] lg:text-[62px]">
                {brand.headline || brandName}
              </h1>
              {brand.positioning_statement ? (
                <p className="mt-6 max-w-[34ch] text-[17px] leading-relaxed text-text">{brand.positioning_statement}</p>
              ) : null}
              <PublicMediaKitCtaButton
                slug={slug}
                ctaId="hero_primary"
                href={primaryCtaHref}
                target={ctaTarget}
                rel={ctaRel}
                className="mt-8 inline-flex items-center gap-2.5 rounded-sm bg-accent px-8 py-3.5 text-[15px] font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {contact.primary_cta_label} <span aria-hidden>→</span>
              </PublicMediaKitCtaButton>
            </div>

            {/* The secondary print. Renders only when a published asset exists. */}
            {heroPrintId && assetUrls.has(heroPrintId) ? (
              <div className="relative hidden lg:block">
                <div className="absolute top-6 -left-20 w-[196px] rotate-[-0.8deg] rounded-sm bg-surface p-2 shadow-[0_12px_28px_-14px_rgba(58,36,32,0.32)]">
                  <div className="aspect-[3/4] overflow-hidden rounded-[2px]">
                    <PublicImage mediaAssetId={heroPrintId} assetUrls={assetUrls} alt="" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── SERVICES — a compact index of three pairs ───────────────── */}
      {hasServices ? (
        <section id="services" className="bg-surface-tint">
          <div className={`${PAGE} py-14`}>
            <Eyebrow>Our Services</Eyebrow>
            <h2 className="mt-4 font-serif text-[30px] leading-tight text-text sm:text-[34px]">Services</h2>
            <ul className="mt-11 grid gap-x-14 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {servicePairs.map((pair, g) => (
                <li key={g} className={g > 0 ? "lg:border-l lg:border-border/45 lg:pl-14" : ""}>
                  {pair.map((service, j) => (
                    <div key={service.id} className={j === 1 ? "mt-5 border-t border-border/40 pt-5" : ""}>
                      <div className="flex items-baseline gap-3">
                        <span className="font-serif text-[12px] tracking-[0.14em] text-accent-2 tabular-nums">
                          {String(g * 2 + j + 1).padStart(2, "0")}
                        </span>
                        <h3 className="font-serif text-[19px] leading-tight text-text">{service.headline}</h3>
                      </div>
                      {service.description ? (
                        <p className="mt-1.5 pl-[30px] text-[13px] leading-relaxed text-text-muted">{service.description}</p>
                      ) : null}
                      {service.public_starting_price_minor != null ? (
                        <p className="mt-2 pl-[30px] text-[13px] text-accent-2">
                          {service.price_label ?? "Starting at"}{" "}
                          <span className="font-medium">{formatMoney(service.public_starting_price_minor, "USD")}</span>
                        </p>
                      ) : service.price_label ? (
                        <p className="mt-2 pl-[30px] text-[13px] text-accent-2">{service.price_label}</p>
                      ) : null}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ── SELECTED WORK — dominant / secondary / detail ───────────── */}
      {hasPortfolio || hasGallery ? (
        <section id="portfolio" className="bg-background">
          <div className={`${PAGE} py-14`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>Selected Work</Eyebrow>
                <h2 className="mt-3 font-serif text-[34px] leading-tight text-text sm:text-[38px]">
                  {hasPortfolio ? "Portfolio" : "Gallery"}
                </h2>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-12">
              {dominant ? <Plate item={dominant} assetUrls={assetUrls} aspect="aspect-[4/5]" className="sm:col-span-7" /> : null}
              {secondary || detail ? (
                <div className="sm:col-span-5 lg:pt-20">
                  {secondary ? <Plate item={secondary} assetUrls={assetUrls} aspect="aspect-[3/2]" /> : null}
                  {detail ? (
                    <Plate item={detail} assetUrls={assetUrls} aspect="aspect-square" className={`${secondary ? "mt-10" : ""} lg:ml-20`} />
                  ) : null}
                </div>
              ) : null}
            </div>

            {galleryPreview.length > 0 ? (
              <div className={hasPortfolio ? "mt-12" : ""}>
                {hasPortfolio ? <h3 className="sr-only">Gallery</h3> : null}
                <div className="grid grid-cols-3 gap-4 lg:max-w-[62%]">
                  {galleryPreview.map((image) => (
                    <GalleryFrame key={image.media_asset_id} image={image} assetUrls={assetUrls} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── ABOUT ──────────────────────────────────────────────────── */}
      {hasAboutBand ? (
        <section id="about" className="bg-surface-tint">
          <div className={`${PAGE} grid grid-cols-1 items-center gap-12 py-14 ${hasAbout ? "lg:grid-cols-[0.82fr_1.18fr] lg:gap-16" : ""}`}>
            <div>
              {hasAbout ? <Eyebrow>About {brandName}</Eyebrow> : null}
              {brand.specialty_label ? (
                <h2 className="mt-4 font-serif text-[36px] leading-[1.12] text-accent-800 sm:text-[42px]">{brand.specialty_label}</h2>
              ) : (
                <h2 className="sr-only">About</h2>
              )}
              {brand.brand_narrative ? (
                <p className="mt-5 max-w-[44ch] text-[16px] leading-relaxed whitespace-pre-wrap text-text">{brand.brand_narrative}</p>
              ) : null}

              {brand.location_label || brand.service_area || brand.established_year ? (
                <dl className="mt-7 flex flex-wrap gap-x-12 gap-y-4">
                  {brand.location_label ? (
                    <div>
                      <dt className="text-[11px] tracking-[0.14em] text-accent-2 uppercase">Based In</dt>
                      <dd className="mt-0.5 text-[15px] text-text">{brand.location_label}</dd>
                    </div>
                  ) : null}
                  {brand.service_area ? (
                    <div>
                      <dt className="text-[11px] tracking-[0.14em] text-accent-2 uppercase">Service Area</dt>
                      <dd className="mt-0.5 text-[15px] text-text">{brand.service_area}</dd>
                    </div>
                  ) : null}
                  {brand.established_year ? (
                    <div>
                      <dt className="text-[11px] tracking-[0.14em] text-accent-2 uppercase">Established</dt>
                      <dd className="mt-0.5 text-[15px] text-text">{brand.established_year}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {contact.secondary_cta_label && contact.secondary_cta_url ? (
                <PublicMediaKitCtaButton
                  slug={slug}
                  ctaId="secondary"
                  href={contact.secondary_cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex items-center gap-2 rounded-sm border border-accent/45 px-6 py-2.5 text-[14px] text-accent transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {contact.secondary_cta_label} <span aria-hidden>→</span>
                </PublicMediaKitCtaButton>
              ) : null}

              {hasRecognition ? (
                <div className={hasAbout ? "mt-10 border-t border-border/50 pt-8" : ""}>
                  {hasTestimonials ? (
                    <div>
                      <h3 className="text-[11px] tracking-[0.2em] text-accent-2 uppercase">What Clients Say</h3>
                      <figure className="mt-4">
                        <blockquote className="max-w-xl font-serif text-[19px] leading-snug text-text italic">&ldquo;{leadTestimonial!.quote}&rdquo;</blockquote>
                        <figcaption className="mt-2 text-[11px] tracking-[0.14em] text-text-muted uppercase">
                          {leadTestimonial!.author_name}
                          {leadTestimonial!.author_role ? <span className="text-text-muted/70"> — {leadTestimonial!.author_role}</span> : null}
                        </figcaption>
                      </figure>
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

            {hasAbout && aboutImageId ? (
              <div className="relative">
                <div className="relative aspect-[16/11] overflow-hidden rounded-sm">
                  <PublicImage mediaAssetId={aboutImageId} assetUrls={assetUrls} alt="" />
                  <p className="pointer-events-none absolute top-1/2 right-7 -translate-y-1/2 text-right font-serif text-[16px] leading-[1.7] tracking-[0.14em] text-white uppercase sm:text-[17px]">
                    {BRAND_TAGLINE.map((word) => (
                      <span key={word} className="block">
                        {word}
                      </span>
                    ))}
                  </p>
                </div>
                {aboutPrintId && assetUrls.has(aboutPrintId) ? (
                  <div className="absolute -bottom-7 -left-8 hidden w-[148px] rotate-[1deg] rounded-sm bg-surface-tint p-2 shadow-[0_10px_24px_-12px_rgba(58,36,32,0.3)] lg:block">
                    <div className="aspect-square overflow-hidden rounded-[2px]">
                      <PublicImage mediaAssetId={aboutPrintId} assetUrls={assetUrls} alt="" />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── WORK WITH US — the closing moment, then the real CRM form ── */}
      <section id="contact" className="scroll-mt-4">
        <div className="relative overflow-hidden bg-accent-800 text-white">
          {closingUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL resolved per-request server-side, not a static asset Next can optimize */}
              <img src={closingUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div aria-hidden className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-accent-800)_58%,transparent)]" />
            </>
          ) : null}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-28" style={{ background: "linear-gradient(to bottom, transparent, var(--color-surface))" }} />
          <div className={`${PAGE} relative pt-[72px] pb-24 text-center`}>
            <h2 className="mx-auto max-w-[24ch] font-serif text-[34px] leading-tight sm:text-[42px]">
              {contact.headline || "Let's create something meaningful."}
            </h2>
            {contact.subtext ? <p className="mx-auto mt-4 max-w-[52ch] text-[16px] leading-relaxed opacity-90">{contact.subtext}</p> : null}
            <PublicMediaKitCtaButton
              slug={slug}
              ctaId="closing_primary"
              href="#inquiry-form"
              className="mt-8 inline-flex items-center gap-2.5 rounded-sm bg-accent px-8 py-3.5 text-[15px] font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {contact.primary_cta_label} <span aria-hidden>→</span>
            </PublicMediaKitCtaButton>
          </div>
        </div>

        <div className="bg-surface">
          <div className={`${PAGE} pb-14`}>
            <details className="mx-auto max-w-2xl scroll-mt-8">
              <summary className="mx-auto flex w-fit cursor-pointer items-center gap-2.5 rounded-sm border border-accent/45 px-7 py-3 text-[14px] text-accent transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                {contact.primary_cta_label}
                <span aria-hidden>+</span>
              </summary>
              <div id="inquiry-form" className="mt-6 scroll-mt-10 rounded-md border border-border/60 bg-background p-8 sm:p-10">
                <PublicMediaKitInquiryForm slug={slug} />
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ── FOOTER — closing credits ───────────────────────────────── */}
      <footer className="bg-surface">
        <div className={`${PAGE} pt-12 pb-10`}>
          <div className="flex flex-col items-center gap-6 text-center">
            <span className="font-serif text-[22px] leading-none text-accent">{brandName}</span>
            <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
              {navSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-[2px] text-[13px] text-text-muted transition-colors hover:text-accent focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {section.label}
                </a>
              ))}
            </nav>
            {visibleSocialLinks.length > 0 ? (
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
          </div>
        </div>
        <div className="border-t border-border/40">
          <div className={`${PAGE} flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 text-center`}>
            <p className="text-[11px] text-text-muted/70">{brandName}</p>
            <p className="text-[10px] tracking-[0.22em] text-text-muted/70 uppercase">
              {BRAND_TAGLINE.join(" \u00b7 ")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
