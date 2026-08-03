import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkspaceHeader } from "@/modules/services/components/WorkspaceHeader";
import { makeEventService, makeEvent, makeClient } from "@/modules/services/testUtils";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { ServiceVersion } from "@/types/serviceVersion";

function version(overrides: Partial<ServiceVersion> = {}): ServiceVersion {
  return {
    id: "version_1",
    service_id: "service_1",
    workspace_id: "ws",
    version_number: 3,
    status: "published",
    name_snapshot: "Photography",
    description_snapshot: null,
    base_price_minor: 100000,
    currency: "USD",
    setup_duration_minutes: null,
    breakdown_duration_minutes: null,
    difficulty_score: null,
    experience_level_required: null,
    weather_sensitivity: "none",
    surprise_friendly: false,
    estimated_profit_minor: null,
    change_summary: null,
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "owner",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function team(overrides: Partial<EventServiceTeamRequirement> = {}): EventServiceTeamRequirement {
  return {
    id: "team_1",
    workspace_id: "ws",
    event_service_id: "es_1",
    role_label: "Coordinator",
    quantity: 1,
    note: null,
    assigned_member_id: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("WorkspaceHeader", () => {
  it("renders Event, Client, Status, Scheduled time, Assigned version, Assigned team, and Completion", () => {
    render(
      <WorkspaceHeader
        eventService={makeEventService({ status: "confirmed" })}
        event={makeEvent({ id: "event_9", title: "Amelia's Wedding", event_date: "2026-06-15", start_time: "16:00" })}
        client={makeClient({ id: "client_9", first_name: "Amelia", last_name: "Carter" })}
        version={version({ version_number: 2 })}
        team={[team({ assigned_member_id: "member_1" }), team({ id: "team_2", assigned_member_id: null })]}
        fulfillmentSummary={{ resolved: 3, total: 5 }}
        actions={<button type="button">Quick action</button>}
      />,
    );

    expect(screen.getByRole("link", { name: "Amelia's Wedding" })).toHaveAttribute("href", "/events/event_9");
    expect(screen.getByRole("link", { name: "Amelia Carter" })).toHaveAttribute("href", "/clients/client_9");
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(new Date("2026-06-15").toLocaleDateString().replace(/\//g, "\\/")))).toBeInTheDocument();
    expect(screen.getByText(/16:00/)).toBeInTheDocument();
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 assigned")).toBeInTheDocument();
    expect(screen.getByText("3 of 5")).toBeInTheDocument();
  });

  it("renders the actions slot content inline (the header's 'Quick actions')", () => {
    render(
      <WorkspaceHeader
        eventService={makeEventService()}
        event={makeEvent()}
        client={makeClient()}
        version={version()}
        team={[]}
        fulfillmentSummary={{ resolved: 0, total: 0 }}
        actions={<button type="button">Start Service</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Start Service" })).toBeInTheDocument();
  });

  it("never renders a 'Health' stat — no assignment-scoped health value exists in the domain", () => {
    render(
      <WorkspaceHeader
        eventService={makeEventService()}
        event={makeEvent()}
        client={makeClient()}
        version={version()}
        team={[]}
        fulfillmentSummary={{ resolved: 0, total: 0 }}
        actions={null}
      />,
    );
    expect(screen.queryByText("Health")).not.toBeInTheDocument();
  });

  it("says 'No roles required' when the assigned version needs no team", () => {
    render(
      <WorkspaceHeader
        eventService={makeEventService()}
        event={makeEvent()}
        client={makeClient()}
        version={version()}
        team={[]}
        fulfillmentSummary={{ resolved: 0, total: 0 }}
        actions={null}
      />,
    );
    expect(screen.getByText("No roles required")).toBeInTheDocument();
  });
});
