import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventServiceAttachmentsSection } from "@/modules/services/components/EventServiceAttachmentsSection";
import type { MediaAsset } from "@/types/mediaAsset";
import type { DataResult } from "@/lib/data/result";

vi.mock("@/lib/data", () => ({
  getMediaAssetsByOwner: vi.fn(),
  uploadMediaAsset: vi.fn(),
  getMediaAssetDownloadUrl: vi.fn(),
  deleteMediaAsset: vi.fn(),
  restoreMediaAsset: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: "ws_test",
    owner_type: "event_service",
    owner_id: "es_1",
    original_filename: "site-map.pdf",
    stored_filename: "site-map.pdf",
    storage_bucket: "media-assets",
    storage_path: "ws_test/event_service/es_1/asset_1/v1/site-map.pdf",
    mime_type: "application/pdf",
    extension: "pdf",
    file_size: 204_800,
    checksum: "abc123",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: "Amoré Bloom Team",
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-01-01T12:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function ok<T>(data: T): DataResult<T> {
  return { success: true, data };
}

function fail(error: string): DataResult<never> {
  return { success: false, error };
}

function makeFile(name: string, type: string, content = "hello") {
  return new File([content], name, { type });
}

describe("EventServiceAttachmentsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows a loading state before attachments resolve", () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockReturnValue(new Promise(() => {}));
    const { container } = render(<EventServiceAttachmentsSection eventServiceId="es_1" status="confirmed" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("passes owner type 'event_service' and the assignment id through to getMediaAssetsByOwner", async () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    render(<EventServiceAttachmentsSection eventServiceId="es_42" status="confirmed" />);
    await screen.findByText("No attachments yet");
    expect(dataLayer.getMediaAssetsByOwner).toHaveBeenCalledWith("event_service", "es_42", { includeArchived: true });
  });

  it("shows an error state with retry when loading fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockRejectedValueOnce(new Error("boom"));
    render(<EventServiceAttachmentsSection eventServiceId="es_1" status="confirmed" />);
    expect(await screen.findByText(/could not load this assignment's attachments/i)).toBeInTheDocument();

    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValueOnce([makeAsset()]);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("site-map.pdf")).toBeInTheDocument();
  });

  it("uploads a valid file and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValueOnce([]).mockResolvedValueOnce([makeAsset({ original_filename: "invoice.pdf" })]);
    vi.mocked(dataLayer.uploadMediaAsset).mockResolvedValue(ok(makeAsset({ original_filename: "invoice.pdf" })));

    render(<EventServiceAttachmentsSection eventServiceId="es_1" status="confirmed" />);
    await screen.findByText("No attachments yet");
    const input = document.getElementById("event_service_attachment_upload") as HTMLInputElement;
    await user.upload(input, makeFile("invoice.pdf", "application/pdf"));

    await waitFor(() =>
      expect(dataLayer.uploadMediaAsset).toHaveBeenCalledWith(expect.objectContaining({ ownerType: "event_service", ownerId: "es_1" })),
    );
    expect(await screen.findByText("invoice.pdf")).toBeInTheDocument();
  });

  it("blocks an unsupported file type before calling uploadMediaAsset", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    render(<EventServiceAttachmentsSection eventServiceId="es_1" status="confirmed" />);
    await screen.findByText("No attachments yet");
    const input = document.getElementById("event_service_attachment_upload") as HTMLInputElement;
    await user.upload(input, makeFile("installer.exe", "application/octet-stream"));
    expect(await screen.findByText(/not supported/i)).toBeInTheDocument();
    expect(dataLayer.uploadMediaAsset).not.toHaveBeenCalled();
  });

  it("archives an attachment after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner)
      .mockResolvedValueOnce([makeAsset({ original_filename: "old-cert.pdf" })])
      .mockResolvedValueOnce([makeAsset({ original_filename: "old-cert.pdf", archived_at: "2026-01-02T00:00:00.000Z" })]);
    vi.mocked(dataLayer.deleteMediaAsset).mockResolvedValue(ok(makeAsset({ archived_at: "2026-01-02T00:00:00.000Z" })));

    render(<EventServiceAttachmentsSection eventServiceId="es_1" status="confirmed" />);
    await screen.findByText("old-cert.pdf");
    await user.click(screen.getByRole("button", { name: /archive file: old-cert\.pdf/i }));
    expect(await screen.findByRole("dialog", { name: /archive this file/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^archive$/i }));

    await waitFor(() => expect(dataLayer.deleteMediaAsset).toHaveBeenCalledWith("asset_1"));
    expect(await screen.findByText("Archived")).toBeInTheDocument();
  });

  it("retains the file when archiving fails", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([makeAsset({ original_filename: "stubborn.pdf" })]);
    vi.mocked(dataLayer.deleteMediaAsset).mockResolvedValue(fail("Could not archive this file."));
    render(<EventServiceAttachmentsSection eventServiceId="es_1" status="confirmed" />);
    await screen.findByText("stubborn.pdf");
    await user.click(screen.getByRole("button", { name: /archive file: stubborn\.pdf/i }));
    await screen.findByRole("dialog", { name: /archive this file/i });
    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    expect(await screen.findByText("Could not archive this file.")).toBeInTheDocument();
    expect(screen.getByText("stubborn.pdf")).toBeInTheDocument();
  });

  it("hides upload and archive/restore controls once the assignment reaches a terminal status", async () => {
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([makeAsset({ original_filename: "final-photos.zip" })]);
    render(<EventServiceAttachmentsSection eventServiceId="es_1" status="completed" />);
    await screen.findByText("final-photos.zip");
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /archive file/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open file/i })).toBeInTheDocument();
  });

  it("still allows Open for read-only attachments — read-only means no mutation, not no viewing", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([makeAsset({ original_filename: "contract.pdf" })]);
    vi.mocked(dataLayer.getMediaAssetDownloadUrl).mockResolvedValue(ok({ url: "https://signed.example/contract.pdf", expiresAt: "2026-01-01T13:00:00.000Z" }));
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<EventServiceAttachmentsSection eventServiceId="es_1" status="cancelled" />);
    await screen.findByText("contract.pdf");
    await user.click(screen.getByRole("button", { name: /open file: contract\.pdf/i }));
    await waitFor(() => expect(dataLayer.getMediaAssetDownloadUrl).toHaveBeenCalledWith("asset_1"));
    windowOpenSpy.mockRestore();
  });
});
