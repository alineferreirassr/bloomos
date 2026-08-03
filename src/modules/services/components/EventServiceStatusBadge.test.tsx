import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventServiceStatusBadge } from "@/modules/services/components/EventServiceStatusBadge";
import { EVENT_SERVICE_STATUSES, EVENT_SERVICE_STATUS_LABELS, type EventServiceStatus } from "@/core/enums/eventServiceStatus";

describe("EventServiceStatusBadge", () => {
  it.each(EVENT_SERVICE_STATUSES)("renders the correct visible label for '%s'", (status) => {
    render(<EventServiceStatusBadge status={status} />);
    expect(screen.getByText(EVENT_SERVICE_STATUS_LABELS[status])).toBeInTheDocument();
  });

  it("throws rather than silently rendering a blank badge for an unknown status", () => {
    expect(() => render(<EventServiceStatusBadge status={"bogus" as EventServiceStatus} />)).toThrow(/unknown status/i);
  });
});
