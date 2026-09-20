import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => (key === "user-agent" ? "vitest" : null),
  })),
}));
vi.mock("@/lib/mediaKit/publicMediaKit", () => ({
  getPublishedMediaKitContent: vi.fn(),
  resolvePublicMediaAssetUrls: vi.fn(async () => new Map()),
  computeVisitorHash: vi.fn(() => "hash"),
  recordPublicMediaKitViewEvent: vi.fn(async () => {}),
}));

import PublicMediaKitPage, { generateMetadata } from "@/app/m/[slug]/page";
import { getPublishedMediaKitContent, recordPublicMediaKitViewEvent } from "@/lib/mediaKit/publicMediaKit";
import type { PublicMediaKitContent } from "@/types/mediaKit";

const CONTENT: PublicMediaKitContent = {
  brand: {
    headline: "Modern romance, timelessly told.",
    positioning_statement: "A real positioning statement.",
    brand_narrative: null,
    location_label: null,
    service_area: null,
    established_year: null,
    specialty_label: null,
  },
  contact: { headline: null, subtext: null, primary_cta_label: "Request a Proposal", primary_cta_type: "inquiry_form", primary_cta_external_url: null, secondary_cta_label: null, secondary_cta_url: null },
  social_links: [],
  appearance: {},
  services: [],
  portfolio: [],
  partners: [],
  testimonials: [],
  press: [],
  gallery: [],
};

describe("PublicMediaKitPage", () => {
  it("renders the calm unavailable state — never draft content — when no published snapshot exists for this slug", async () => {
    vi.mocked(getPublishedMediaKitContent).mockResolvedValue(null);
    const element = await PublicMediaKitPage({ params: Promise.resolve({ slug: "amore-bloom" }) });
    render(element);
    expect(screen.getByText("This Media Kit isn't available.")).toBeInTheDocument();
    expect(vi.mocked(recordPublicMediaKitViewEvent)).not.toHaveBeenCalled();
  });

  it("renders the real published content and records exactly one view event for a qualifying page load", async () => {
    vi.mocked(getPublishedMediaKitContent).mockResolvedValue(CONTENT);
    const element = await PublicMediaKitPage({ params: Promise.resolve({ slug: "amore-bloom" }) });
    render(element);
    expect(screen.getByRole("heading", { name: "Modern romance, timelessly told." })).toBeInTheDocument();
    expect(vi.mocked(recordPublicMediaKitViewEvent)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordPublicMediaKitViewEvent)).toHaveBeenCalledWith("amore-bloom", "hash", null, "/m/amore-bloom");
  });

  it("generateMetadata uses only real persisted Brand content, with no fabricated fallback headline for an unpublished slug", async () => {
    vi.mocked(getPublishedMediaKitContent).mockResolvedValue(null);
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "unknown-slug" }) });
    expect(metadata.title).toBe("Amoré Bloom");
    expect(metadata.description).toBeUndefined();
  });

  it("generateMetadata reflects the real published headline/positioning statement", async () => {
    vi.mocked(getPublishedMediaKitContent).mockResolvedValue(CONTENT);
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "amore-bloom" }) });
    expect(metadata.title).toBe("Amoré Bloom — Modern romance, timelessly told.");
    expect(metadata.description).toBe("A real positioning statement.");
  });
});
