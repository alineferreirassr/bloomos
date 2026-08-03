import { describe, expect, it } from "vitest";
import { evaluateCertificationCapability, isCertificationStateBlocking } from "@/core/capability/certificationCapabilityEngine";
import type { WorkerCertification } from "@/types/workforce";

const NOW = "2026-07-30T00:00:00.000Z";

function makeCert(overrides: Partial<WorkerCertification> = {}): WorkerCertification {
  return { id: "cert_1", name: "OSHA 30", issuer: "OSHA", issued_date: "2024-01-01T00:00:00.000Z", expiration_date: "2027-01-01T00:00:00.000Z", verified: true, ...overrides };
}

describe("evaluateCertificationCapability", () => {
  it("is missing when the worker holds no certification with that name", () => {
    expect(evaluateCertificationCapability("OSHA 30", [], NOW, null).state).toBe("missing");
  });

  it("is unverified when held but not verified, regardless of expiration", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ verified: false })], NOW, null);
    expect(result.state).toBe("unverified");
  });

  it("is valid when verified and never expires", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ expiration_date: null })], NOW, null);
    expect(result.state).toBe("valid");
  });

  it("is expired when the expiration date has passed", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ expiration_date: "2026-01-01T00:00:00.000Z" })], NOW, null);
    expect(result.state).toBe("expired");
  });

  it("is expiring_soon within the default 30-day threshold", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ expiration_date: "2026-08-10T00:00:00.000Z" })], NOW, null);
    expect(result.state).toBe("expiring_soon");
    expect(result.daysUntilExpiration).toBe(11);
  });

  it("is valid beyond the expiring-soon threshold", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ expiration_date: "2027-01-01T00:00:00.000Z" })], NOW, null);
    expect(result.state).toBe("valid");
  });

  it("respects a custom expiring-soon threshold", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ expiration_date: "2026-08-10T00:00:00.000Z" })], NOW, null, 5);
    expect(result.state).toBe("valid");
  });

  it("becomes expired when it would lapse before a required-valid-through date, even though it's currently valid", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ expiration_date: "2026-09-01T00:00:00.000Z" })], NOW, "2026-12-01T00:00:00.000Z");
    expect(result.state).toBe("expired");
  });

  it("stays valid when it remains valid through the required-through date", () => {
    const result = evaluateCertificationCapability("OSHA 30", [makeCert({ expiration_date: "2027-01-01T00:00:00.000Z" })], NOW, "2026-12-01T00:00:00.000Z");
    expect(result.state).toBe("valid");
  });
});

describe("isCertificationStateBlocking", () => {
  it("blocks expired, unverified, and missing; never blocks valid or expiring_soon", () => {
    expect(isCertificationStateBlocking("expired")).toBe(true);
    expect(isCertificationStateBlocking("unverified")).toBe(true);
    expect(isCertificationStateBlocking("missing")).toBe(true);
    expect(isCertificationStateBlocking("valid")).toBe(false);
    expect(isCertificationStateBlocking("expiring_soon")).toBe(false);
  });
});
