import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaKitBrandEditor } from "@/modules/mediaKit/components/MediaKitBrandEditor";
import type { MediaKit } from "@/types/mediaKit";

vi.mock("@/modules/mediaKit/updateMediaKitBrandAction", () => ({
  updateMediaKitBrandAction: vi.fn(),
}));

import { updateMediaKitBrandAction } from "@/modules/mediaKit/updateMediaKitBrandAction";

const EMPTY_MEDIA_KIT: MediaKit = {
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
};

const FILLED_MEDIA_KIT: MediaKit = {
  ...EMPTY_MEDIA_KIT,
  headline: "Modern romance, timelessly told.",
  positioning_statement: "For couples who want their story shown, not staged.",
  brand_narrative: "A longer brand story.",
  location_label: "Charleston, SC",
  service_area: "Southeast",
  established_year: 2019,
  specialty_label: "Editorial Florals",
};

describe("MediaKitBrandEditor", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays existing values in the view state", () => {
    render(<MediaKitBrandEditor mediaKit={FILLED_MEDIA_KIT} onChanged={vi.fn()} />);
    // The headline/positioning statement appear twice — once in the view dl, once in the always-visible Brand Preview.
    expect(screen.getAllByText("Modern romance, timelessly told.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("For couples who want their story shown, not staged.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Charleston, SC")).toBeInTheDocument();
    expect(screen.getByText("2019")).toBeInTheDocument();
  });

  it("empty values remain genuinely empty — never fabricated Amoré Bloom narrative", () => {
    render(<MediaKitBrandEditor mediaKit={EMPTY_MEDIA_KIT} onChanged={vi.fn()} />);
    expect(screen.getAllByText("Not set").length).toBe(7);
    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument();
  });

  it("editing does not pre-fill fields with example/fabricated text", async () => {
    const user = userEvent.setup();
    render(<MediaKitBrandEditor mediaKit={EMPTY_MEDIA_KIT} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Headline")).toHaveValue("");
    expect(screen.getByLabelText("Brand Story")).toHaveValue("");
  });

  it("a successful save calls onChanged and returns to the view state with the new values", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(updateMediaKitBrandAction).mockResolvedValue({ success: true, data: FILLED_MEDIA_KIT });

    render(<MediaKitBrandEditor mediaKit={EMPTY_MEDIA_KIT} onChanged={onChanged} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.type(screen.getByLabelText("Headline"), "Modern romance, timelessly told.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateMediaKitBrandAction)).toHaveBeenCalledWith(expect.objectContaining({ headline: "Modern romance, timelessly told." }));
  });

  it("shows a validation failure inline and stays in the edit state", async () => {
    const user = userEvent.setup();
    vi.mocked(updateMediaKitBrandAction).mockResolvedValue({ success: false, error: "Established must be a year between 1900 and 2026." });

    render(<MediaKitBrandEditor mediaKit={EMPTY_MEDIA_KIT} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Established must be a year between 1900 and 2026.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("shows a calm error and stays in the edit state on a persistence failure — never a raw database error", async () => {
    const user = userEvent.setup();
    vi.mocked(updateMediaKitBrandAction).mockResolvedValue({ success: false, error: "This Media Kit could not be found." });

    render(<MediaKitBrandEditor mediaKit={EMPTY_MEDIA_KIT} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This Media Kit could not be found.")).toBeInTheDocument();
    expect(screen.queryByText(/relation|constraint|schema cache/i)).not.toBeInTheDocument();
  });

  it("Cancel discards in-progress edits and restores the last-saved values", async () => {
    const user = userEvent.setup();
    render(<MediaKitBrandEditor mediaKit={FILLED_MEDIA_KIT} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Headline"));
    await user.type(screen.getByLabelText("Headline"), "Something else entirely");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getAllByText("Modern romance, timelessly told.").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Something else entirely")).not.toBeInTheDocument();
    expect(vi.mocked(updateMediaKitBrandAction)).not.toHaveBeenCalled();
  });

  it("shows the Brand Preview once identity content exists, and a calm placeholder when it doesn't", () => {
    const { rerender } = render(<MediaKitBrandEditor mediaKit={EMPTY_MEDIA_KIT} onChanged={vi.fn()} />);
    expect(screen.getByText(/Your Brand Preview will appear here/)).toBeInTheDocument();

    rerender(<MediaKitBrandEditor mediaKit={FILLED_MEDIA_KIT} onChanged={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Modern romance, timelessly told." })).toBeInTheDocument();
  });
});
