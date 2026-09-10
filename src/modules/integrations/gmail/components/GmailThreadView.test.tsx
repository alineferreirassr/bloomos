import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/integrations/gmail/getGmailInboxActions", () => ({ getMyGmailThreadAction: vi.fn() }));

import { getMyGmailThreadAction } from "@/modules/integrations/gmail/getGmailInboxActions";
import { GmailThreadView } from "@/modules/integrations/gmail/components/GmailThreadView";
import type { GmailInboxMessageView } from "@/modules/integrations/gmail/getGmailInboxActions";

function message(overrides: Partial<GmailInboxMessageView> = {}): GmailInboxMessageView {
  return {
    id: "message_1",
    fromAddress: { name: "Jordan Lee", email: "jordan@example.com" },
    toAddresses: [{ name: null, email: "ana@amorebloom.com" }],
    ccAddresses: [],
    subject: "Booking",
    internalDate: "2026-01-01T12:00:00.000Z",
    bodyText: "Plain text body.",
    sanitizedBodyHtml: null,
    hasAttachments: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GmailThreadView", () => {
  it("shows a loading state on mount", () => {
    vi.mocked(getMyGmailThreadAction).mockReturnValue(new Promise(() => {}));
    render(<GmailThreadView threadId="thread_1" />);
    expect(screen.getByRole("heading", { name: "Conversation" })).toBeInTheDocument();
  });

  it("shows a safe error state on failure", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: false, error: "raw db error" });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText(/isn't available right now/)).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown/unauthorized thread id, without distinguishing which", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: true, data: { status: "not_found" } });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText("Conversation not found")).toBeInTheDocument();
  });

  it("shows an all-deleted state without rendering any message content", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: true, data: { status: "all_deleted" } });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText("This conversation has been deleted")).toBeInTheDocument();
    expect(screen.queryByText(/Plain text body/)).not.toBeInTheDocument();
  });

  it("renders messages in the order the server already returned them (chronological)", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({
      success: true,
      data: {
        status: "ready",
        subject: "Booking",
        messages: [message({ id: "m1", bodyText: "First message" }), message({ id: "m2", bodyText: "Second message" })],
      },
    });
    render(<GmailThreadView threadId="thread_1" />);
    const bodies = await screen.findAllByText(/message$/);
    expect(bodies[0]).toHaveTextContent("First message");
    expect(bodies[1]).toHaveTextContent("Second message");
  });

  it("renders sender and recipient", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: true, data: { status: "ready", subject: "Booking", messages: [message()] } });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText("Jordan Lee <jordan@example.com>")).toBeInTheDocument();
    expect(screen.getByText("To: ana@amorebloom.com")).toBeInTheDocument();
  });

  it("renders a readable timestamp", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: true, data: { status: "ready", subject: "Booking", messages: [message({ internalDate: "2026-03-15T09:30:00.000Z" })] } });
    render(<GmailThreadView threadId="thread_1" />);
    const time = await screen.findByText((_, element) => element?.tagName === "TIME");
    expect(time).toHaveAttribute("dateTime", "2026-03-15T09:30:00.000Z");
  });

  it("renders sanitized HTML when present, via a contained surface", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({
      success: true,
      data: { status: "ready", subject: "Booking", messages: [message({ bodyText: null, sanitizedBodyHtml: "<p>Hi <b>Ana</b></p>" })] },
    });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText("Ana", { selector: "b" })).toBeInTheDocument();
  });

  it("falls back to plain text when there is no HTML body", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({
      success: true,
      data: { status: "ready", subject: "Booking", messages: [message({ bodyText: "Plain only", sanitizedBodyHtml: null })] },
    });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText("Plain only")).toBeInTheDocument();
  });

  it("shows an explicit empty-body state when neither HTML nor text body is present", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({
      success: true,
      data: { status: "ready", subject: "Booking", messages: [message({ bodyText: null, sanitizedBodyHtml: null })] },
    });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText("This message has no readable content.")).toBeInTheDocument();
  });

  it("shows an attachment indicator without offering any download/preview action", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: true, data: { status: "ready", subject: "Booking", messages: [message({ hasAttachments: true })] } });
    render(<GmailThreadView threadId="thread_1" />);
    expect(await screen.findByText(/has an attachment/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /download/i })).not.toBeInTheDocument();
  });

  it("never renders a compose/reply/forward control", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: true, data: { status: "ready", subject: "Booking", messages: [message()] } });
    render(<GmailThreadView threadId="thread_1" />);
    await screen.findByText("Jordan Lee <jordan@example.com>");
    expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /forward/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("links the breadcrumb back to /gmail-inbox", async () => {
    vi.mocked(getMyGmailThreadAction).mockResolvedValue({ success: true, data: { status: "ready", subject: "Booking", messages: [message()] } });
    render(<GmailThreadView threadId="thread_1" />);
    const link = await screen.findByRole("link", { name: "Gmail" });
    expect(link).toHaveAttribute("href", "/gmail-inbox");
  });
});
