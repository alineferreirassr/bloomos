import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import type { ServiceVersionStatus } from "@/core/enums/serviceVersionStatus";

describe("VersionBadge", () => {
  it("renders 'Draft' for a draft version regardless of versionNumber", () => {
    render(<VersionBadge status="draft" versionNumber={null} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders 'Published v[number]' with no qualifier for the current published version", () => {
    render(<VersionBadge status="published" versionNumber={3} isCurrent />);
    expect(screen.getByText("Published v3")).toBeInTheDocument();
  });

  it("distinguishes a historical published version via visible text, not tone alone", () => {
    render(<VersionBadge status="published" versionNumber={2} isCurrent={false} />);
    expect(screen.getByText("Published v2 (previous)")).toBeInTheDocument();
  });

  it("defaults isCurrent to false when omitted", () => {
    render(<VersionBadge status="published" versionNumber={1} />);
    expect(screen.getByText("Published v1 (previous)")).toBeInTheDocument();
  });

  it("throws rather than silently rendering a blank badge for an unknown status", () => {
    expect(() => render(<VersionBadge status={"bogus" as ServiceVersionStatus} versionNumber={1} />)).toThrow(/unknown status/i);
  });
});
