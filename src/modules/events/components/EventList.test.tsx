import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventListTable } from "@/modules/events/components/EventListTable";
import { EventListCards } from "@/modules/events/components/EventListCards";
import { makeEvent } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import type { EventListRow } from "@/modules/events/components/EventsListView";

const rows: EventListRow[] = [
  {
    event: makeEvent({
      id: "event_a",
      title: "Malibu Sunset Proposal",
      status: "confirmed",
      priority: "high",
      event_date: "2026-08-22",
    }),
    client: makeClient({ id: "client_a", first_name: "Jordan", last_name: "Ellis" }),
    checklistCompleted: 2,
    checklistTotal: 4,
    nextAction: "Order florals",
  },
  {
    event: makeEvent({
      id: "event_b",
      title: "Sonoma Vineyard Picnic",
      status: "draft",
      priority: "low",
      event_date: null,
    }),
    client: makeClient({ id: "client_b", first_name: "Isabella", last_name: "Cruz" }),
    checklistCompleted: 0,
    checklistTotal: 0,
    nextAction: "Complete the event details to move it out of draft",
  },
];

describe("EventListTable (desktop)", () => {
  it("renders every event's title, client, status, and checklist progress", () => {
    render(<EventListTable rows={rows} />);
    expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    expect(screen.getByText("Jordan Ellis")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();

    expect(screen.getByText("Sonoma Vineyard Picnic")).toBeInTheDocument();
    expect(screen.getByText("Isabella Cruz")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});

describe("EventListCards (mobile)", () => {
  it("renders every event's title, client, and next action", () => {
    render(<EventListCards rows={rows} />);
    expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument();
    expect(screen.getByText("Jordan Ellis")).toBeInTheDocument();
    expect(screen.getByText("Order florals")).toBeInTheDocument();

    expect(screen.getByText("Sonoma Vineyard Picnic")).toBeInTheDocument();
    expect(screen.getByText("Isabella Cruz")).toBeInTheDocument();
  });
});
