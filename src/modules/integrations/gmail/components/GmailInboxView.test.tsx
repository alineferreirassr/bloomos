import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/modules/integrations/gmail/getGmailInboxActions", () => ({ getMyGmailInboxAction: vi.fn() }));

import { getMyGmailInboxAction } from "@/modules/integrations/gmail/getGmailInboxActions";
import { GmailInboxView } from "@/modules/integrations/gmail/components/GmailInboxView";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GmailInboxView", () => {
  it("shows a loading state on mount", () => {
    vi.mocked(getMyGmailInboxAction).mockReturnValue(new Promise(() => {}));
    render(<GmailInboxView />);
    expect(screen.getByRole("heading", { name: "Gmail" })).toBeInTheDocument();
  });

  it("shows a Connect Gmail prompt when there is no connection", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({ success: true, data: { status: "no_connection" } });
    render(<GmailInboxView />);
    expect(await screen.findByText(/Connect Gmail/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Integrations" })).toHaveAttribute("href", "/developer");
  });

  it("shows a Sync prompt when the mailbox has never synced", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({ success: true, data: { status: "not_synced" } });
    render(<GmailInboxView />);
    expect(await screen.findByText(/hasn't synced yet/)).toBeInTheDocument();
  });

  it("shows a safe error state on failure, never a raw error", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({ success: false, error: "raw db error: connection refused at 10.0.0.5" });
    render(<GmailInboxView />);
    const alert = await screen.findByText(/isn't available right now/);
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText(/10\.0\.0\.5/)).not.toBeInTheDocument();
  });

  it("shows an empty state when ready but no threads exist", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({ success: true, data: { status: "ready", threads: [] } });
    render(<GmailInboxView />);
    expect(await screen.findByText("No messages yet")).toBeInTheDocument();
  });

  it("renders threads in the order the server already returned them (newest first)", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({
      success: true,
      data: {
        status: "ready",
        threads: [
          { id: "thread_1", subject: "Newest", snippet: "Hi", latestMessageAt: "2026-01-05T00:00:00Z", messageCount: 2, unreadCount: 1 },
          { id: "thread_2", subject: "Older", snippet: "Hello", latestMessageAt: "2026-01-01T00:00:00Z", messageCount: 1, unreadCount: 0 },
        ],
      },
    });
    render(<GmailInboxView />);
    const links = await screen.findAllByRole("link", { name: /Newest|Older/ });
    expect(links[0]).toHaveTextContent("Newest");
    expect(links[1]).toHaveTextContent("Older");
  });

  it("shows an unread badge only when unreadCount > 0", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({
      success: true,
      data: {
        status: "ready",
        threads: [
          { id: "thread_1", subject: "Has unread", snippet: null, latestMessageAt: null, messageCount: 1, unreadCount: 2 },
          { id: "thread_2", subject: "All read", snippet: null, latestMessageAt: null, messageCount: 1, unreadCount: 0 },
        ],
      },
    });
    render(<GmailInboxView />);
    await screen.findByText("Has unread");
    expect(screen.getByText("2 unread")).toBeInTheDocument();
    expect(screen.queryByText("0 unread")).not.toBeInTheDocument();
  });

  it("shows the message count for each thread", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({
      success: true,
      data: { status: "ready", threads: [{ id: "thread_1", subject: "Booking", snippet: null, latestMessageAt: null, messageCount: 3, unreadCount: 0 }] },
    });
    render(<GmailInboxView />);
    expect(await screen.findByText("3 messages")).toBeInTheDocument();
  });

  it("links each thread row to /gmail-inbox/[threadId] using a real, keyboard-accessible <a>", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({
      success: true,
      data: { status: "ready", threads: [{ id: "thread_abc123", subject: "Booking", snippet: null, latestMessageAt: null, messageCount: 1, unreadCount: 0 }] },
    });
    render(<GmailInboxView />);
    const link = await screen.findByRole("link", { name: /Booking/ });
    expect(link).toHaveAttribute("href", "/gmail-inbox/thread_abc123");
  });

  it("falls back to '(no subject)' rather than an empty row", async () => {
    vi.mocked(getMyGmailInboxAction).mockResolvedValue({
      success: true,
      data: { status: "ready", threads: [{ id: "thread_1", subject: null, snippet: null, latestMessageAt: null, messageCount: 1, unreadCount: 0 }] },
    });
    render(<GmailInboxView />);
    expect(await screen.findByText("(no subject)")).toBeInTheDocument();
  });
});
