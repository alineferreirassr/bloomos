import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaKitServicesCurator } from "@/modules/mediaKit/components/MediaKitServicesCurator";
import type { MediaKitServiceCuration } from "@/types/mediaKit";

vi.mock("@/lib/queries/services/catalog", () => ({
  getServicesCatalog: vi.fn(),
}));
vi.mock("@/modules/mediaKit/getMediaKitServiceCurationsData", () => ({
  getMediaKitServiceCurationsData: vi.fn(),
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

import { getServicesCatalog } from "@/lib/queries/services/catalog";
import { getMediaKitServiceCurationsData } from "@/modules/mediaKit/getMediaKitServiceCurationsData";
import { setMediaKitServiceIncludedAction } from "@/modules/mediaKit/setMediaKitServiceIncludedAction";
import { updateMediaKitServiceCurationAction } from "@/modules/mediaKit/updateMediaKitServiceCurationAction";
import { reorderMediaKitServicesAction } from "@/modules/mediaKit/reorderMediaKitServicesAction";

function makeCuration(overrides: Partial<MediaKitServiceCuration> = {}): MediaKitServiceCuration {
  return {
    id: "curation_1",
    workspace_id: "workspace_1",
    media_kit_id: "mk_1",
    service_id: "service_1",
    headline_override: null,
    description_override: null,
    icon_key: null,
    public_starting_price_minor: null,
    public_price_label: null,
    is_featured: false,
    is_included: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

// Shape-compatible with `ServiceCatalogRow` (only the fields the curator actually reads).
function makeCatalogRow(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    service: { id, name, description: "End-to-end event design.", archived_at: null, category_id: null },
    categoryName: "Design",
    draftVersion: { id: `${id}_draft` },
    publishedVersion: { base_price_minor: 500000, currency: "USD" },
    health: {},
    usageCount: 0,
    ...overrides,
  };
}

const SERVICE_1_ROW = makeCatalogRow("service_1", "Full-Service Design");
const SERVICE_2_ROW = makeCatalogRow("service_2", "Floral Styling");

function mockCatalog(rows: ReturnType<typeof makeCatalogRow>[]) {
  vi.mocked(getServicesCatalog).mockResolvedValue({ rows, categories: [] } as unknown as Awaited<ReturnType<typeof getServicesCatalog>>);
}

describe("MediaKitServicesCurator", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays the canonical Services catalog", async () => {
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: true, data: [] });
    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Full-Service Design" })).toBeInTheDocument();
    expect(screen.getByText("End-to-end event design.")).toBeInTheDocument();
  });

  it("reading never mutates state — no include/exclude/reorder action fires on load", async () => {
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: true, data: [] });
    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    await screen.findByRole("heading", { name: "Full-Service Design" });
    expect(vi.mocked(setMediaKitServiceIncludedAction)).not.toHaveBeenCalled();
    expect(vi.mocked(updateMediaKitServiceCurationAction)).not.toHaveBeenCalled();
    expect(vi.mocked(reorderMediaKitServicesAction)).not.toHaveBeenCalled();
  });

  it("shows the zero-selection prompt when canonical Services exist but none are included yet", async () => {
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: true, data: [] });
    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    expect(await screen.findByText("Choose the services you want to feature in your Media Kit.")).toBeInTheDocument();
  });

  it("shows a calm no-canonical-services state, with navigation to Services, when zero Services exist at all — never a duplicate-creation prompt", async () => {
    mockCatalog([]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: true, data: [] });
    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    expect(await screen.findByText("No Services yet")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Go to Services" });
    expect(link).toHaveAttribute("href", "/services");
  });

  it("a failure to load this Media Kit's own curation rows surfaces the error state — even though the catalog itself loaded fine", async () => {
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: false, error: "This Media Kit could not be found." });
    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    expect(await screen.findByText("Services couldn't be loaded.")).toBeInTheDocument();
  });

  it("selecting a Service calls the include action and refreshes real state (no fabricated optimistic curation)", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValueOnce({ success: true, data: [] });
    vi.mocked(setMediaKitServiceIncludedAction).mockResolvedValue({ success: true, data: makeCuration() });
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValueOnce({ success: true, data: [makeCuration()] });

    render(<MediaKitServicesCurator onChanged={onChanged} />);
    await screen.findByRole("heading", { name: "Full-Service Design" });

    await user.click(screen.getByRole("checkbox", { name: "Add Full-Service Design to Media Kit" }));

    expect(vi.mocked(setMediaKitServiceIncludedAction)).toHaveBeenCalledWith("service_1", true);
    expect(await screen.findByRole("checkbox", { name: "Remove Full-Service Design from Media Kit" })).toBeChecked();
    expect(onChanged).toHaveBeenCalled();
  });

  it("excluding a Service calls the include action with false", async () => {
    const user = userEvent.setup();
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValueOnce({ success: true, data: [makeCuration()] });
    vi.mocked(setMediaKitServiceIncludedAction).mockResolvedValue({ success: true, data: makeCuration({ is_included: false }) });
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValueOnce({ success: true, data: [makeCuration({ is_included: false })] });

    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    await screen.findByRole("heading", { name: "Full-Service Design" });

    await user.click(screen.getByRole("checkbox", { name: "Remove Full-Service Design from Media Kit" }));
    expect(vi.mocked(setMediaKitServiceIncludedAction)).toHaveBeenCalledWith("service_1", false);
  });

  it("toggling Featured calls the update action, preserving the current overrides", async () => {
    const user = userEvent.setup();
    const curated = makeCuration({ headline_override: "Signature Package", is_featured: false });
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValueOnce({ success: true, data: [curated] });
    vi.mocked(updateMediaKitServiceCurationAction).mockResolvedValue({ success: true, data: { ...curated, is_featured: true } });
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValueOnce({ success: true, data: [{ ...curated, is_featured: true }] });

    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    await screen.findByRole("heading", { name: "Full-Service Design" });

    await user.click(screen.getByRole("checkbox", { name: "Featured" }));

    expect(vi.mocked(updateMediaKitServiceCurationAction)).toHaveBeenCalledWith(
      "curation_1",
      expect.objectContaining({ headline_override: "Signature Package", is_featured: true }),
    );
  });

  it("editing an override saves only the changed override field, and an empty override remains empty (never copies canonical text in)", async () => {
    const user = userEvent.setup();
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: true, data: [makeCuration()] });
    vi.mocked(updateMediaKitServiceCurationAction).mockResolvedValue({ success: true, data: makeCuration({ headline_override: "Signature Package" }) });

    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    await screen.findByRole("heading", { name: "Full-Service Design" });

    await user.click(screen.getByRole("button", { name: "Edit presentation" }));

    // The override field opens genuinely empty — the canonical name is only a placeholder hint, never a persisted value.
    const headlineInput = screen.getByLabelText("Headline override") as HTMLInputElement;
    expect(headlineInput.value).toBe("");
    expect(headlineInput.placeholder).toBe("Full-Service Design");

    const descriptionInput = screen.getByLabelText("Description override") as HTMLTextAreaElement;
    expect(descriptionInput.value).toBe("");

    await user.type(headlineInput, "Signature Package");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(vi.mocked(updateMediaKitServiceCurationAction)).toHaveBeenCalledWith(
      "curation_1",
      expect.objectContaining({ headline_override: "Signature Package", description_override: null }),
    );
  });

  it("editing public pricing converts major-unit input into minor units", async () => {
    const user = userEvent.setup();
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: true, data: [makeCuration()] });
    vi.mocked(updateMediaKitServiceCurationAction).mockResolvedValue({ success: true, data: makeCuration({ public_starting_price_minor: 250000 }) });

    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    await screen.findByRole("heading", { name: "Full-Service Design" });
    await user.click(screen.getByRole("button", { name: "Edit presentation" }));

    await user.type(screen.getByLabelText("Public starting price"), "2500");
    await user.type(screen.getByLabelText("Public price label"), "Starting at");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(vi.mocked(updateMediaKitServiceCurationAction)).toHaveBeenCalledWith(
      "curation_1",
      expect.objectContaining({ public_starting_price_minor: 250000, public_price_label: "Starting at" }),
    );
  });

  it("ordering: Move up/down sends the full reordered curation id array", async () => {
    const user = userEvent.setup();
    mockCatalog([SERVICE_1_ROW, SERVICE_2_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({
      success: true,
      data: [makeCuration({ id: "curation_1", service_id: "service_1", sort_order: 0 }), makeCuration({ id: "curation_2", service_id: "service_2", sort_order: 1 })],
    });
    vi.mocked(reorderMediaKitServicesAction).mockResolvedValue({ success: true, data: [] });

    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    await screen.findByRole("heading", { name: "Floral Styling" });

    const secondCard = screen.getByRole("heading", { name: "Floral Styling" }).closest("li") as HTMLElement;
    await user.click(within(secondCard).getByRole("button", { name: "Move up" }));

    expect(vi.mocked(reorderMediaKitServicesAction)).toHaveBeenCalledWith(["curation_2", "curation_1"]);
  });

  it("selecting an already-included Service again is disabled by the checkbox's own checked state — no duplicate selection path exists in the UI", async () => {
    mockCatalog([SERVICE_1_ROW]);
    vi.mocked(getMediaKitServiceCurationsData).mockResolvedValue({ success: true, data: [makeCuration()] });
    render(<MediaKitServicesCurator onChanged={vi.fn()} />);
    const checkbox = await screen.findByRole("checkbox", { name: "Remove Full-Service Design from Media Kit" });
    expect(checkbox).toBeChecked();
    // Only one checkbox — and one card — exists per Service; there is no "add again" control while included.
    expect(screen.getAllByRole("heading", { name: "Full-Service Design" })).toHaveLength(1);
  });
});
