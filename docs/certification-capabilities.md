# Certification Capability Engine

v2.0 Checkpoint 26.1, Step 12. `core/capability/certificationCapabilityEngine.ts`'s `evaluateCertificationCapability(name, workerCertifications, now, requiredValidThroughDate, expiringSoonThresholdDays)` — classifies one required certification name against a worker's real `WorkerCertification[]` (Checkpoint 26). Never a second certification store.

## Five states

```ts
const CERTIFICATION_CAPABILITY_STATES = ["valid", "expired", "unverified", "expiring_soon", "missing"] as const;
```

Resolution order: not found → `missing`; found but `!verified` → `unverified` (regardless of expiration — an unverified certification never counts as capability, even if it hasn't lapsed); found, verified, never expires (`expiration_date: null`) → `valid`; found, verified, past its expiration → `expired`; found, verified, expires within the threshold (default 30 days) → `expiring_soon`; otherwise → `valid`.

## Only three of the five block eligibility

```ts
function isCertificationStateBlocking(state): boolean {
  return state === "expired" || state === "unverified" || state === "missing";
}
```

`expiring_soon` is a warning, never a hard block — exactly the spec's own Step 12 rule: "Expiring Soon should create a warning, not automatic ineligibility."

## The one exception: `required_valid_through_date`

When a `CapabilityRequirement` sets `required_valid_through_date` (Step 12's "unless the requirement explicitly says the certification must remain valid through a future work date"), a certification that's currently valid but would lapse *before* that date is classified `expired` for this specific requirement — it would genuinely not last through the work, so `expiring_soon` would understate the problem. Without a configured `required_valid_through_date`, an about-to-expire certification is only ever `expiring_soon`.

```ts
if (requiredValidThroughDate !== null && certification.expiration_date < requiredValidThroughDate) return { state: "expired", ... };
```

## Reused by both the Eligibility Engine and the Score Engine

`eligibilityEngine.ts` calls this once per required/preferred certification to build `blockingReasons`/`expiringSoonCertifications`; `capabilityScoreEngine.ts`'s `computeCertificationScore` calls the exact same function to derive per-certification credit (`valid`=1, `expiring_soon`=0.75, else 0) — one classification function, never duplicated logic between the two engines that both need it.
