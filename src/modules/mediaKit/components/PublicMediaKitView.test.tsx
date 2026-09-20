import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicMediaKitView } from "@/modules/mediaKit/components/PublicMediaKitView";
import type { PublicMediaKitContent } from "@/types/mediaKit";

// These are real "use server" actions whose modules pull in `server-only`
// (via `mediaKitServiceRole.ts`/`publicMediaKit.ts`) — mocked the same way
// every other Media Kit client-component test mocks its own actions
// (see MediaKitPortfolioEditor.test.tsx), never executed for real here.
vi.mock("@/modules/mediaKit/submitMediaKitInquiryAction", () => ({ submitMediaKitInquiryAction: vi.fn(async () => ({ success: true, data: { submitted: true } })) }));
vi.mock("@/modules/mediaKit/recordMediaKitContactStartedAction", () => ({ recordMediaKitContactStartedAction: vi.fn(async () => undefined) }));
vi.mock("@/modules/mediaKit/recordMediaKitCtaClickedAction", () => ({ recordMediaKitCtaClickedAction: vi.fn(async () => undefined) }));

const EMPTY_CONTENT: PublicMediaKitContent = {
  brand: {
    headline: null,
    positioning_statement: null,
    brand_narrative: null,
    location_label: null,
    service_area: null,
    established_year: null,
    specialty_label: null,
  },
  contact: {
    headline: null,
    subtext: null,
    primary_cta_label: "Request a Proposal",
    primary_cta_type: "inquiry_form",
    primary_cta_external_url: null,
    secondary_cta_label: null,
    secondary_cta_url: null,
  },
  social_links: [],
  appearance: {},
  services: [],
  portfolio: [],
  partners: [],
  testimonials: [],
  press: [],
  gallery: [],
};

describe("PublicMediaKitView", () => {
  it("renders only the brand name when there is no persisted content at all — no fabricated marketing copy, no empty section shells", () => {
    render(<PublicMediaKitView content={EMPTY_CONTENT} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getAllByText("Amoré Bloom").length).toBeGreaterThan(0);
    // Nothing to navigate to yet — no nav links for unpopulated sections.
    expect(screen.queryByRole("navigation", { name: "Section navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Services" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Portfolio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Gallery" })).not.toBeInTheDocument();
  });

  it("renders real persisted Brand content and omits fields that are null", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      brand: {
        headline: "Modern romance, timelessly told.",
        positioning_statement: "For couples who want their story shown, not staged.",
        brand_narrative: "A longer brand story.",
        location_label: "Charleston, SC",
        service_area: "Southeast",
        established_year: 2019,
        specialty_label: "Editorial Florals",
      },
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByRole("heading", { name: "Modern romance, timelessly told." })).toBeInTheDocument();
    expect(screen.getByText("For couples who want their story shown, not staged.")).toBeInTheDocument();
    expect(screen.getByText("A longer brand story.")).toBeInTheDocument();
    expect(screen.getByText(/Charleston, SC/)).toBeInTheDocument();
    expect(screen.getByText("Established")).toBeInTheDocument();
    expect(screen.getByText("2019")).toBeInTheDocument();
  });

  it("renders included Services and omits any Service with no headline (the documented snapshot fallback gap)", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      services: [
        {
          id: "s1",
          headline: "Full-Service Design",
          description: "End-to-end event design.",
          icon_key: null,
          public_starting_price_minor: null,
          price_label: "Starting at",
          is_featured: false,
        },
        { id: "s2", headline: null, description: null, icon_key: null, public_starting_price_minor: null, price_label: null, is_featured: false },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText("Full-Service Design")).toBeInTheDocument();
    expect(screen.getByText("End-to-end event design.")).toBeInTheDocument();
    // The second entry has no headline (an included Service published with an empty override) — nothing renders for it, and no internal id ("s2") leaks into the page.
    expect(screen.queryByText("s2")).not.toBeInTheDocument();
  });

  it("renders the resolved public starting price alongside its price label when the corrected snapshot carries one", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      services: [
        {
          id: "s1",
          headline: "Full-Service Design",
          description: null,
          icon_key: null,
          public_starting_price_minor: 250000,
          price_label: "Packages from",
          is_featured: false,
        },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText(/Packages from/)).toBeInTheDocument();
    expect(screen.getByText("$2,500.00")).toBeInTheDocument();
  });

  it("excluded Services never appear at all — the snapshot itself is already is_included-filtered, so this component has nothing to exclude by name; confirms no extra unlisted service text leaks in", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      services: [{ id: "s1", headline: "Floral Styling", description: null, icon_key: null, public_starting_price_minor: null, price_label: null, is_featured: false }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText("Floral Styling")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("renders included Portfolio items with real fields only, and marks the page's own internal id nowhere in visible text", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      portfolio: [
        {
          id: "portfolio_row_internal_id",
          title: "The Harrington Wedding",
          category: "Wedding",
          location_label: "Savannah, GA",
          event_year: 2025,
          short_description: "A garden celebration.",
          cover_media_asset_id: null,
          is_featured: true,
          gallery: [],
        },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText("The Harrington Wedding")).toBeInTheDocument();
    expect(screen.getByText(/Wedding · Savannah, GA · 2025/)).toBeInTheDocument();
    expect(screen.getByText("A garden celebration.")).toBeInTheDocument();
    expect(screen.queryByText("portfolio_row_internal_id")).not.toBeInTheDocument();
  });

  it("renders the Gallery grid from included images, resolving each via the pre-resolved asset URL map", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      gallery: [
        { media_asset_id: "asset_1", caption: "Reception detail", is_cover: false },
        { media_asset_id: "asset_2", caption: null, is_cover: false },
      ],
    };
    const assetUrls = new Map([["asset_1", "https://example.test/signed/asset_1.jpg"]]);
    render(<PublicMediaKitView content={content} assetUrls={assetUrls} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByRole("heading", { name: "Gallery" })).toBeInTheDocument();
    const image = screen.getByAltText("Reception detail");
    expect(image).toHaveAttribute("src", "https://example.test/signed/asset_1.jpg");
  });

  it("MEDIAKIT-05V — omits the Gallery section entirely when its rows exist but none resolve to a real asset URL, rather than rendering a lone fake placeholder tile", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      gallery: [
        { media_asset_id: "asset_unresolvable_1", caption: "Broken", is_cover: false },
        { media_asset_id: "asset_unresolvable_2", caption: null, is_cover: false },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.queryByRole("heading", { name: "Gallery" })).not.toBeInTheDocument();
  });

  it("public navigation only lists anchors for sections that actually rendered", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      brand: { ...EMPTY_CONTENT.brand, headline: "Headline" },
      services: [{ id: "s1", headline: "A Service", description: null, icon_key: null, public_starting_price_minor: null, price_label: null, is_featured: false }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    const nav = screen.getByRole("navigation", { name: "Section navigation" });
    expect(nav).toHaveTextContent("Services");
    expect(nav).not.toHaveTextContent("Portfolio");
    expect(nav).not.toHaveTextContent("Gallery");
  });

  it("the primary CTA links to the on-page inquiry form (#contact) when the CTA type is the default inquiry_form — a real, working action, never a fake/broken one", () => {
    render(<PublicMediaKitView content={EMPTY_CONTENT} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    const links = screen.getAllByRole("link", { name: "Request a Proposal" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "#contact");
  });

  it("renders a real external CTA link when configured", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      contact: { ...EMPTY_CONTENT.contact, primary_cta_type: "external_url", primary_cta_external_url: "https://example.test/contact", primary_cta_label: "Work With Us" },
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    const links = screen.getAllByRole("link", { name: "Work With Us" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "https://example.test/contact");
  });

  it("always renders the real CRM inquiry form in the Contact section — the non-negotiable public inquiry flow, not optional content", () => {
    render(<PublicMediaKitView content={EMPTY_CONTENT} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Inquiry" })).toBeInTheDocument();
  });

  it("renders only approved+included Partners/Testimonials/Press the snapshot already carries, grouped under one Recognition section, and omits it entirely when none exist", () => {
    render(<PublicMediaKitView content={EMPTY_CONTENT} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.queryByText("What Clients Say")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected Partners")).not.toBeInTheDocument();
    expect(screen.queryByText("As Featured In")).not.toBeInTheDocument();

    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      partners: [{ id: "p1", display_name: "The Grand Ballroom", logo_media_asset_id: null, partner_type: "Venue", is_featured: false }],
      testimonials: [{ id: "t1", quote: "They made our day unforgettable.", author_name: "Jamie & Alex", author_role: "Married 2025", photo_media_asset_id: null, is_featured: false }],
      press: [{ id: "pr1", publication_name: "Southern Weddings", feature_title: null, url: null, logo_media_asset_id: null, featured_on: null }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText("What Clients Say")).toBeInTheDocument();
    expect(screen.getByText(/They made our day unforgettable\./)).toBeInTheDocument();
    expect(screen.getByText("Selected Partners")).toBeInTheDocument();
    expect(screen.getByText("The Grand Ballroom")).toBeInTheDocument();
    expect(screen.getByText("As Featured In")).toBeInTheDocument();
    expect(screen.getByText("Southern Weddings")).toBeInTheDocument();
  });

  it("renders only visible Social links, and omits the row entirely when none are visible", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      social_links: [
        { platform: "Instagram", handle_or_url: "instagram.com/amorebloom", is_visible: true },
        { platform: "Internal Draft Link", handle_or_url: "internal.example/draft", is_visible: false },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByRole("link", { name: "Instagram" })).toBeInTheDocument();
    expect(screen.queryByText("Internal Draft Link")).not.toBeInTheDocument();
  });

  it("MEDIAKIT-06 — falls back to the text-led hero when a hero_media_asset_id is configured but its URL never resolved (deleted/failed asset), never a broken <img>", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      brand: { ...EMPTY_CONTENT.brand, headline: "Headline" },
      appearance: { hero_media_asset_id: "asset_never_resolved" },
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByRole("heading", { level: 1, name: "Headline" })).toBeInTheDocument();
    // The text-led hero variant renders no <img> at all for the hero itself.
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("MEDIAKIT-06 — a Portfolio item's cover renders the elegant image-empty placeholder, not a broken <img>, when its cover_media_asset_id never resolved", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      portfolio: [
        {
          id: "p1",
          title: "The Harrington Wedding",
          category: null,
          location_label: null,
          event_year: null,
          short_description: null,
          cover_media_asset_id: "asset_never_resolved",
          is_featured: false,
          gallery: [],
        },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText("The Harrington Wedding")).toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("MEDIAKIT-06 — a Partner logo that never resolved renders the display name only, no broken <img>", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      partners: [{ id: "p1", display_name: "The Grand Ballroom", logo_media_asset_id: "asset_never_resolved", partner_type: null, is_featured: false }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText("The Grand Ballroom")).toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("MEDIAKIT-06 — a Press logo that never resolved falls back to the publication's name as text, no broken <img>", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      press: [{ id: "pr1", publication_name: "Southern Weddings", feature_title: null, url: null, logo_media_asset_id: "asset_never_resolved", featured_on: null }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    expect(screen.getByText("Southern Weddings")).toBeInTheDocument();
    expect(document.querySelectorAll("img")).toHaveLength(0);
  });

  it("MEDIAKIT-06 — About, Partners, and Press each expose a real heading element, not just styled text, so the section's landmark structure is complete for assistive tech", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      brand: { ...EMPTY_CONTENT.brand, location_label: "Charleston, SC" },
      partners: [{ id: "p1", display_name: "The Grand Ballroom", logo_media_asset_id: null, partner_type: null, is_featured: false }],
      press: [{ id: "pr1", publication_name: "Southern Weddings", feature_title: null, url: null, logo_media_asset_id: null, featured_on: null }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" slug="amore-bloom" />);
    // About has no specialty_label here, so its heading is the visually-hidden "About" — still a real heading.
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selected Partners" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "As Featured In" })).toBeInTheDocument();
  });
});
