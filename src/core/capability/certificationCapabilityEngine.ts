import type { WorkerCertification } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26.1, Step 12 — Certification Intelligence. Pure
 * classification of one required certification name against a worker's
 * real `WorkerCertification[]` (Checkpoint 26) — never a second
 * certification store.
 */
export const CERTIFICATION_CAPABILITY_STATES = ["valid", "expired", "unverified", "expiring_soon", "missing"] as const;
export type CertificationCapabilityState = (typeof CERTIFICATION_CAPABILITY_STATES)[number];

export interface CertificationCapabilityResult {
  certificationName: string;
  state: CertificationCapabilityState;
  daysUntilExpiration: number | null;
}

export const DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS = 30;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * `requiredValidThroughDate` implements Step 12's "must remain valid
 * through a future work date": a certification that's currently valid
 * but expires before that date is classified `"expired"` for THIS
 * requirement specifically — it would genuinely lapse before the work
 * happens — never silently treated as fine because "not expired yet."
 * Without a `requiredValidThroughDate`, an about-to-expire certification
 * is only `"expiring_soon"` — a warning, never a hard block, exactly as
 * the spec requires.
 */
export function evaluateCertificationCapability(
  certificationName: string,
  workerCertifications: WorkerCertification[],
  now: string,
  requiredValidThroughDate: string | null,
  expiringSoonThresholdDays = DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
): CertificationCapabilityResult {
  const certification = workerCertifications.find((c) => c.name === certificationName);
  if (!certification) return { certificationName, state: "missing", daysUntilExpiration: null };
  if (!certification.verified) return { certificationName, state: "unverified", daysUntilExpiration: null };
  if (certification.expiration_date === null) return { certificationName, state: "valid", daysUntilExpiration: null };

  const daysUntilExpiration = daysBetween(now, certification.expiration_date);
  if (certification.expiration_date <= now) return { certificationName, state: "expired", daysUntilExpiration };
  if (requiredValidThroughDate !== null && certification.expiration_date < requiredValidThroughDate) return { certificationName, state: "expired", daysUntilExpiration };
  if (daysUntilExpiration <= expiringSoonThresholdDays) return { certificationName, state: "expiring_soon", daysUntilExpiration };
  return { certificationName, state: "valid", daysUntilExpiration };
}

/** Only `"expired"`, `"unverified"`, and `"missing"` block eligibility — `"expiring_soon"` is a warning-only state, per Step 12. */
export function isCertificationStateBlocking(state: CertificationCapabilityState): boolean {
  return state === "expired" || state === "unverified" || state === "missing";
}
