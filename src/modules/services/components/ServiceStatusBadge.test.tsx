import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceStatusBadge } from "@/modules/services/components/ServiceStatusBadge";
import { SERVICE_STATUSES, SERVICE_STATUS_LABELS, type ServiceStatus } from "@/core/enums/serviceStatus";

describe("ServiceStatusBadge", () => {
  it.each(SERVICE_STATUSES)("renders the correct visible label for '%s'", (status) => {
    render(<ServiceStatusBadge status={status} />);
    expect(screen.getByText(SERVICE_STATUS_LABELS[status])).toBeInTheDocument();
  });

  it("throws rather than silently rendering a blank badge for an unknown status", () => {
    expect(() => render(<ServiceStatusBadge status={"bogus" as ServiceStatus} />)).toThrow(/unknown status/i);
  });
});
