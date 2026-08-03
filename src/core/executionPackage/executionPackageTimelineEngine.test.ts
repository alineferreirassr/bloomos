import { describe, expect, it } from "vitest";
import { packageCreatedEvent, packageUpdatedEvent, packageValidatedEvent, packageApprovedEvent, packageArchivedEvent, snapshotCreatedEvent, versionCreatedEvent } from "@/core/executionPackage/executionPackageTimelineEngine";

describe("executionPackageTimelineEngine", () => {
  it("builds a package_created event", () => {
    expect(packageCreatedEvent("Amoré Wedding")).toEqual({ type: "package_created", description: 'Execution package "Amoré Wedding" created.' });
  });

  it("builds a package_updated event", () => {
    expect(packageUpdatedEvent("Amoré Wedding").type).toBe("package_updated");
  });

  it("builds a package_validated event reflecting validity", () => {
    expect(packageValidatedEvent("Amoré Wedding", true).description).toContain("no blocking issues");
    expect(packageValidatedEvent("Amoré Wedding", false).description).toContain("blocking issues found");
  });

  it("builds a package_approved event", () => {
    expect(packageApprovedEvent("Amoré Wedding").type).toBe("package_approved");
  });

  it("builds a package_archived event", () => {
    expect(packageArchivedEvent("Amoré Wedding").type).toBe("package_archived");
  });

  it("builds a snapshot_created event", () => {
    expect(snapshotCreatedEvent("Amoré Wedding").type).toBe("snapshot_created");
  });

  it("builds a version_created event with the version number in its description", () => {
    const event = versionCreatedEvent("Amoré Wedding", 2);
    expect(event.type).toBe("version_created");
    expect(event.description).toContain("Version 2");
  });
});
