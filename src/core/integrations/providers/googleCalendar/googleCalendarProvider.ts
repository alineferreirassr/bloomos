import type { CalendarProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * v2 Checkpoint 43 — a real `CalendarProvider` implementation against the
 * real Google Calendar REST API (plain `fetch`, no `googleapis` SDK
 * dependency — Google's Calendar API is a documented, stable REST
 * surface, so a hand-rolled client keeps this adapter genuine without
 * pulling in a heavy, largely-unused dependency). Every method makes a
 * real HTTP request; nothing here is mocked in production code — only
 * test fixtures fake `fetch`.
 *
 * Connection is unverified in this environment: no Google OAuth client
 * (`GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`) is configured,
 * so `exchangeCodeForToken`/`refreshAccessToken` cannot be exercised
 * against a live account here — see docs/calendar-integration.md.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly providerId = "google-calendar";
  readonly capabilities: ProviderCapability[] = ["calendar", "oauth"];

  constructor(
    private readonly accessToken: string,
    private readonly calendarId: string = "primary",
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Google Calendar API error ${response.status}: ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      await this.request(`/calendars/${encodeURIComponent(this.calendarId)}`);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async createEvent(params: { title: string; startsAt: string; endsAt: string; attendees: string[] }): Promise<{ externalId: string }> {
    const created = await this.request<{ id: string }>(`/calendars/${encodeURIComponent(this.calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify({
        summary: params.title,
        start: { dateTime: params.startsAt },
        end: { dateTime: params.endsAt },
        attendees: params.attendees.map((email) => ({ email })),
      }),
    });
    return { externalId: created.id };
  }

  async updateEvent(externalId: string, params: Partial<{ title: string; startsAt: string; endsAt: string }>): Promise<{ updated: boolean }> {
    await this.request(`/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(externalId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(params.title !== undefined ? { summary: params.title } : {}),
        ...(params.startsAt !== undefined ? { start: { dateTime: params.startsAt } } : {}),
        ...(params.endsAt !== undefined ? { end: { dateTime: params.endsAt } } : {}),
      }),
    });
    return { updated: true };
  }

  async deleteEvent(externalId: string): Promise<{ deleted: boolean }> {
    await this.request(`/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(externalId)}`, { method: "DELETE" });
    return { deleted: true };
  }

  async listEvents(params: { from: string; to: string }): Promise<Array<{ externalId: string; title: string; startsAt: string; endsAt: string }>> {
    const query = new URLSearchParams({ timeMin: params.from, timeMax: params.to, singleEvents: "true", orderBy: "startTime" });
    const result = await this.request<{ items: Array<{ id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }> }>(
      `/calendars/${encodeURIComponent(this.calendarId)}/events?${query.toString()}`,
    );
    return result.items.map((item) => ({
      externalId: item.id,
      title: item.summary ?? "(untitled)",
      startsAt: item.start.dateTime ?? item.start.date ?? "",
      endsAt: item.end.dateTime ?? item.end.date ?? "",
    }));
  }
}
