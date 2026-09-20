import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicMediaKitView } from "@/modules/mediaKit/components/PublicMediaKitView";
import type { PublicMediaKitContent } from "@/types/mediaKit";

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
    render(<PublicMediaKitView content={EMPTY_CONTENT} assetUrls={new Map()} brandName="Amoré Bloom" />);
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
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" />);
    expect(screen.getByRole("heading", { name: "Modern romance, timelessly told." })).toBeInTheDocument();
    expect(screen.getByText("For couples who want their story shown, not staged.")).toBeInTheDocument();
    expect(screen.getByText("A longer brand story.")).toBeInTheDocument();
    expect(screen.getByText(/Charleston, SC/)).toBeInTheDocument();
    expect(screen.getByText(/Est\. 2019/)).toBeInTheDocument();
  });

  it("renders included Services and omits any Service with no headline (the documented snapshot fallback gap)", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      services: [
        { id: "s1", headline: "Full-Service Design", description: "End-to-end event design.", icon_key: null, price_label: "Starting at", is_featured: false },
        { id: "s2", headline: null, description: null, icon_key: null, price_label: null, is_featured: false },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" />);
    expect(screen.getByText("Full-Service Design")).toBeInTheDocument();
    expect(screen.getByText("End-to-end event design.")).toBeInTheDocument();
    // The second entry has no headline (an included Service published with an empty override) — nothing renders for it, and no internal id ("s2") leaks into the page.
    expect(screen.queryByText("s2")).not.toBeInTheDocument();
    // No numeric price ever renders — the published snapshot carries no price amount field at all (see PublicMediaKitContent's doc comment).
    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
  });

  it("excluded Services never appear at all — the snapshot itself is already is_included-filtered, so this component has nothing to exclude by name; confirms no extra unlisted service text leaks in", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      services: [{ id: "s1", headline: "Floral Styling", description: null, icon_key: null, price_label: null, is_featured: false }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" />);
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
          is_featured: true,
          gallery: [],
        },
      ],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" />);
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
    render(<PublicMediaKitView content={content} assetUrls={assetUrls} brandName="Amoré Bloom" />);
    expect(screen.getByRole("heading", { name: "Gallery" })).toBeInTheDocument();
    const image = screen.getByAltText("Reception detail");
    expect(image).toHaveAttribute("src", "https://example.test/signed/asset_1.jpg");
  });

  it("public navigation only lists anchors for sections that actually rendered", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      brand: { ...EMPTY_CONTENT.brand, headline: "Headline" },
      services: [{ id: "s1", headline: "A Service", description: null, icon_key: null, price_label: null, is_featured: false }],
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" />);
    const nav = screen.getByRole("navigation", { name: "Section navigation" });
    expect(nav).toHaveTextContent("Services");
    expect(nav).not.toHaveTextContent("Portfolio");
    expect(nav).not.toHaveTextContent("Gallery");
  });

  it("omits the CTA entirely when the CTA type isn't a real external URL — never a fake/broken action", () => {
    render(<PublicMediaKitView content={EMPTY_CONTENT} assetUrls={new Map()} brandName="Amoré Bloom" />);
    expect(screen.queryByRole("link", { name: "Request a Proposal" })).not.toBeInTheDocument();
  });

  it("renders a real external CTA link when configured", () => {
    const content: PublicMediaKitContent = {
      ...EMPTY_CONTENT,
      contact: { ...EMPTY_CONTENT.contact, primary_cta_type: "external_url", primary_cta_external_url: "https://example.test/contact", primary_cta_label: "Work With Us" },
    };
    render(<PublicMediaKitView content={content} assetUrls={new Map()} brandName="Amoré Bloom" />);
    const links = screen.getAllByRole("link", { name: "Work With Us" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "https://example.test/contact");
  });
});
