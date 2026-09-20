import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaKitOverviewView } from "@/modules/mediaKit/components/MediaKitOverviewView";
import type { MediaKitOverview } from "@/types/mediaKit";

vi.mock("@/modules/mediaKit/getMediaKitOverviewData", () => ({
  getMediaKitOverviewData: vi.fn(),
}));
vi.mock("@/modules/mediaKit/createMediaKitAction", () => ({
  createMediaKitAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitBrandAction", () => ({
  updateMediaKitBrandAction: vi.fn(),
}));
vi.mock("@/lib/queries/services/catalog", () => ({
  getServicesCatalog: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/getMediaKitServiceCurationsData", () => ({
  getMediaKitServiceCurationsData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/setMediaKitServiceIncludedAction", () => ({
  setMediaKitServiceIncludedAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitServiceCurationAction", () => ({
  updateMediaKitServiceCurationAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/reorderMediaKitServicesAction", () => ({
  reorderMediaKitServicesAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/publishMediaKitAction", () => ({
  publishMediaKitAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/getMediaKitPortfolioItemsData", () => ({
  getMediaKitPortfolioItemsData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/createMediaKitPortfolioItemAction", () => ({
  createMediaKitPortfolioItemAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitPortfolioItemAction", () => ({
  updateMediaKitPortfolioItemAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/archiveMediaKitPortfolioItemAction", () => ({
  archiveMediaKitPortfolioItemAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/reorderMediaKitPortfolioItemsAction", () => ({
  reorderMediaKitPortfolioItemsAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/getMediaKitEventOptionsData", () => ({
  getMediaKitEventOptionsData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/getMediaKitGalleryItemsData", () => ({
  getMediaKitGalleryItemsData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/addMediaKitGalleryItemAction", () => ({
  addMediaKitGalleryItemAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitGalleryItemAction", () => ({
  updateMediaKitGalleryItemAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/archiveMediaKitGalleryItemAction", () => ({
  archiveMediaKitGalleryItemAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/reorderMediaKitGalleryItemsAction", () => ({
  reorderMediaKitGalleryItemsAction: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getMediaAssetDownloadUrl: vi.fn(() => new Promise(() => {})),
  listMediaAssetsForWorkspace: vi.fn(() => new Promise(() => {})),
  getVendors: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/getMediaKitPartnersData", () => ({
  getMediaKitPartnersData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/createMediaKitPartnerAction", () => ({
  createMediaKitPartnerAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitPartnerAction", () => ({
  updateMediaKitPartnerAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/archiveMediaKitPartnerAction", () => ({
  archiveMediaKitPartnerAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/reorderMediaKitPartnersAction", () => ({
  reorderMediaKitPartnersAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/getMediaKitClientOptionsData", () => ({
  getMediaKitClientOptionsData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/getMediaKitTestimonialsData", () => ({
  getMediaKitTestimonialsData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/createMediaKitTestimonialAction", () => ({
  createMediaKitTestimonialAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitTestimonialAction", () => ({
  updateMediaKitTestimonialAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/setMediaKitTestimonialApprovedAction", () => ({
  setMediaKitTestimonialApprovedAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/archiveMediaKitTestimonialAction", () => ({
  archiveMediaKitTestimonialAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/reorderMediaKitTestimonialsAction", () => ({
  reorderMediaKitTestimonialsAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/getMediaKitPressFeaturesData", () => ({
  getMediaKitPressFeaturesData: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/modules/mediaKit/createMediaKitPressFeatureAction", () => ({
  createMediaKitPressFeatureAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitPressFeatureAction", () => ({
  updateMediaKitPressFeatureAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/archiveMediaKitPressFeatureAction", () => ({
  archiveMediaKitPressFeatureAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/reorderMediaKitPressFeaturesAction", () => ({
  reorderMediaKitPressFeaturesAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitSocialLinksAction", () => ({
  updateMediaKitSocialLinksAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitContactCtaAction", () => ({
  updateMediaKitContactCtaAction: vi.fn(),
}));
vi.mock("@/modules/mediaKit/updateMediaKitAppearanceAction", () => ({
  updateMediaKitAppearanceAction: vi.fn(),
}));

import { getMediaKitOverviewData } from "@/modules/mediaKit/getMediaKitOverviewData";
import { createMediaKitAction } from "@/modules/mediaKit/createMediaKitAction";
import { publishMediaKitAction } from "@/modules/mediaKit/publishMediaKitAction";

const EMPTY_MEDIA_KIT: MediaKitOverview = {
  mediaKit: {
    id: "mk_1",
    workspace_id: "workspace_1",
    slug: "amore-bloom",
    headline: null,
    positioning_statement: null,
    brand_narrative: null,
    location_label: null,
    service_area: null,
    established_year: null,
    specialty_label: null,
    contact_headline: null,
    contact_subtext: null,
    primary_cta_label: "Request a Proposal",
    primary_cta_type: "inquiry_form",
    primary_cta_external_url: null,
    secondary_cta_label: null,
    secondary_cta_url: null,
    social_links: [],
    appearance: {},
    status: "draft",
    current_published_snapshot_id: null,
    published_at: null,
    published_by: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
  },
  contentStatus: {
    brand: "not_started",
    services: "not_started",
    portfolio: "not_started",
    partners: "not_started",
    testimonials: "not_started",
    press: "not_started",
    gallery: "not_started",
    contact: "not_started",
  },
  analytics: { totalViews: 0, approxUniqueVisitors: 0, inquiries: 0, leadsGenerated: 0 },
  recentActivity: [],
};

describe("MediaKitOverviewView", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the loading skeleton before the fetch resolves", () => {
    vi.mocked(getMediaKitOverviewData).mockReturnValue(new Promise(() => {}));
    render(<MediaKitOverviewView />);
    expect(screen.queryByText("Media Kit")).not.toBeInTheDocument();
  });

  it("renders the Overview on a successful result, with zero/empty real data — never fabricated", async () => {
    vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: EMPTY_MEDIA_KIT });
    render(<MediaKitOverviewView />);

    expect(await screen.findByRole("heading", { name: "Media Kit" })).toBeInTheDocument();

    // Every performance metric renders its real, truthful zero — never a
    // placeholder or a fabricated example figure like "200+".
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText(/200\+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/150\+/)).not.toBeInTheDocument();

    // Every content section reads its real, deterministic "Not started"
    // state — no fabricated "Ready"/completion percentage.
    expect(screen.getAllByText("Not started").length).toBeGreaterThan(0);
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();

    // Draft publication state, read from the real mediaKit.status.
    expect(screen.getByText("Draft")).toBeInTheDocument();
    // Not published yet — no "View Public Page" link, and a truthful "not published" message.
    expect(screen.getByText(/Not published yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View Public Page" })).not.toBeInTheDocument();

    // Publish is present and real (not a dead-looking permanently-disabled button).
    const publishButtons = screen.getAllByRole("button", { name: "Publish" });
    expect(publishButtons.length).toBeGreaterThan(0);
    for (const button of publishButtons) {
      expect(button).not.toBeDisabled();
    }
  });

  it("renders section navigation for every capability in the approved information architecture", async () => {
    vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: EMPTY_MEDIA_KIT });
    render(<MediaKitOverviewView />);
    await screen.findByRole("heading", { name: "Media Kit" });

    for (const label of ["Overview", "Brand", "Services", "Portfolio", "Partners", "Testimonials", "Press", "Metrics", "Social", "Gallery", "Publish"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("switching to the Brand tab shows the real Brand editor in its view state, reading the real (empty) Media Kit fields — never lorem ipsum", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: EMPTY_MEDIA_KIT });
    render(<MediaKitOverviewView />);
    await screen.findByRole("heading", { name: "Media Kit" });

    await user.click(screen.getByRole("tab", { name: "Brand" }));
    expect(screen.getByRole("heading", { name: "Brand" })).toBeInTheDocument();
    // Every empty Brand field reads a genuine "Not set" — never fabricated example copy.
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument();
  });

  it("clicking Publish calls the publish action and refreshes to show View Public Page once published", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitOverviewData).mockResolvedValueOnce({ success: true, data: EMPTY_MEDIA_KIT });
    render(<MediaKitOverviewView />);
    await screen.findByRole("heading", { name: "Media Kit" });

    const published = { ...EMPTY_MEDIA_KIT, mediaKit: { ...EMPTY_MEDIA_KIT.mediaKit, status: "published" as const, published_at: "2026-01-02T00:00:00Z" } };
    vi.mocked(publishMediaKitAction).mockResolvedValue({ success: true, data: published.mediaKit });
    vi.mocked(getMediaKitOverviewData).mockResolvedValueOnce({ success: true, data: published });

    await user.click(screen.getAllByRole("button", { name: "Publish" })[0]);

    expect(vi.mocked(publishMediaKitAction)).toHaveBeenCalledTimes(1);
    // The real read path (not a client-fabricated status) is what surfaces the "View Public Page" link, pointing at the real slug's public route.
    const publicLinks = await screen.findAllByRole("link", { name: "View Public Page" });
    expect(publicLinks.length).toBeGreaterThan(0);
    expect(publicLinks[0]).toHaveAttribute("href", "/m/amore-bloom");
  });

  it("shows a calm error on a failed publish and never claims the Media Kit is published", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: EMPTY_MEDIA_KIT });
    render(<MediaKitOverviewView />);
    await screen.findByRole("heading", { name: "Media Kit" });

    vi.mocked(publishMediaKitAction).mockResolvedValue({ success: false, error: "This Media Kit could not be published." });
    await user.click(screen.getAllByRole("button", { name: "Publish" })[0]);

    expect(await screen.findByText("This Media Kit could not be published.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View Public Page" })).not.toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders the controlled ErrorState on a { success: false } result", async () => {
    vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: false, error: "The Media Kit isn't available." });
    render(<MediaKitOverviewView />);
    expect(await screen.findByText("The Media Kit isn't available.")).toBeInTheDocument();
  });

  it("exits the skeleton and renders ErrorState when the Server Action promise rejects — never hangs forever", async () => {
    vi.mocked(getMediaKitOverviewData).mockRejectedValue(new Error("Could not find the table 'public.media_kits' in the schema cache"));
    render(<MediaKitOverviewView />);

    expect(await screen.findByText("The Media Kit isn't available.")).toBeInTheDocument();
    expect(screen.queryByText(/media_kits/)).not.toBeInTheDocument();
    expect(screen.queryByText(/schema cache/)).not.toBeInTheDocument();
  });

  it("retry after a rejection calls load again and can recover", async () => {
    const user = userEvent.setup();
    vi.mocked(getMediaKitOverviewData).mockRejectedValueOnce(new Error("network error"));
    render(<MediaKitOverviewView />);
    await screen.findByText("The Media Kit isn't available.");

    vi.mocked(getMediaKitOverviewData).mockResolvedValueOnce({ success: true, data: EMPTY_MEDIA_KIT });
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByRole("heading", { name: "Media Kit" })).toBeInTheDocument();
    expect(vi.mocked(getMediaKitOverviewData)).toHaveBeenCalledTimes(2);
  });

  // MEDIAKIT-02.1 — the founder correction: a plain page load (data: null,
  // no access error) must render an explicit first-use setup, never a
  // silently-created Overview.
  describe("first-use setup (no Media Kit exists yet)", () => {
    it("renders the first-use setup, not the Manager Overview, when no Media Kit exists", async () => {
      vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: null });
      render(<MediaKitOverviewView />);

      expect(await screen.findByText("Create your Amoré Bloom Media Kit")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Media Kit" })).toBeInTheDocument();
      // The Manager's own tab navigation and Publish button must not render
      // before a Media Kit exists.
      expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
      // No fabricated content anywhere in the first-use copy.
      expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/200\+/)).not.toBeInTheDocument();
    });

    it("explicit create calls the create action and transitions into the real Manager Overview with truthful zero-state data", async () => {
      const user = userEvent.setup();
      vi.mocked(getMediaKitOverviewData).mockResolvedValueOnce({ success: true, data: null });
      render(<MediaKitOverviewView />);
      await screen.findByRole("button", { name: "Create Media Kit" });

      vi.mocked(createMediaKitAction).mockResolvedValue({ success: true, data: EMPTY_MEDIA_KIT.mediaKit });
      vi.mocked(getMediaKitOverviewData).mockResolvedValueOnce({ success: true, data: EMPTY_MEDIA_KIT });

      await user.click(screen.getByRole("button", { name: "Create Media Kit" }));

      expect(await screen.findByRole("heading", { name: "Media Kit" })).toBeInTheDocument();
      expect(vi.mocked(createMediaKitAction)).toHaveBeenCalledTimes(1);
      // The real read path is what populates the Overview after creation —
      // never a client-fabricated ready state.
      expect(vi.mocked(getMediaKitOverviewData)).toHaveBeenCalledTimes(2);
      // Initial metrics are real zeros, content is genuinely not_started.
      expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(4);
      expect(screen.getAllByText("Not started").length).toBeGreaterThan(0);
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    it("double-clicking Create Media Kit only calls the create action once", async () => {
      const user = userEvent.setup();
      vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: null });
      render(<MediaKitOverviewView />);
      const createButton = await screen.findByRole("button", { name: "Create Media Kit" });

      let resolveCreate: (value: Awaited<ReturnType<typeof createMediaKitAction>>) => void = () => {};
      vi.mocked(createMediaKitAction).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
      );

      await user.click(createButton);
      // The button must be disabled (and re-labeled) while the create is in
      // flight, so a second click can't fire a second creation.
      expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Creating…" }));

      resolveCreate({ success: true, data: EMPTY_MEDIA_KIT.mediaKit });
      expect(vi.mocked(createMediaKitAction)).toHaveBeenCalledTimes(1);
    });

    it("shows a calm, actionable error state on creation failure — never a raw database error, and never pretends the Media Kit exists", async () => {
      const user = userEvent.setup();
      vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: null });
      render(<MediaKitOverviewView />);
      await screen.findByRole("button", { name: "Create Media Kit" });

      vi.mocked(createMediaKitAction).mockResolvedValue({ success: false, error: "The Media Kit isn't available." });
      await user.click(screen.getByRole("button", { name: "Create Media Kit" }));

      expect(await screen.findByText("The Media Kit isn't available.")).toBeInTheDocument();
      // Still on the first-use setup, not a fabricated Overview.
      expect(screen.getByRole("button", { name: "Create Media Kit" })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();
    });

    it("retries cleanly after a rejected create action, never exposing the raw error", async () => {
      const user = userEvent.setup();
      vi.mocked(getMediaKitOverviewData).mockResolvedValue({ success: true, data: null });
      render(<MediaKitOverviewView />);
      await screen.findByRole("button", { name: "Create Media Kit" });

      vi.mocked(createMediaKitAction).mockRejectedValueOnce(new Error("duplicate key value violates unique constraint"));
      await user.click(screen.getByRole("button", { name: "Create Media Kit" }));

      expect(await screen.findByText(/Something went wrong creating your Media Kit/)).toBeInTheDocument();
      expect(screen.queryByText(/duplicate key/)).not.toBeInTheDocument();
      expect(screen.queryByText(/unique constraint/)).not.toBeInTheDocument();

      vi.mocked(createMediaKitAction).mockResolvedValueOnce({ success: true, data: EMPTY_MEDIA_KIT.mediaKit });
      vi.mocked(getMediaKitOverviewData).mockResolvedValueOnce({ success: true, data: EMPTY_MEDIA_KIT });
      await user.click(screen.getByRole("button", { name: "Create Media Kit" }));

      expect(await screen.findByRole("heading", { name: "Media Kit" })).toBeInTheDocument();
    });
  });
});
