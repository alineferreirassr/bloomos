# Client Onboarding

**Status: v2 Checkpoint 44, Steps 10-11.** A client-facing onboarding experience in the Client Portal — composed entirely from the existing Client Journey Platform (Checkpoint 32), never a second journey/checklist/progress engine.

## Why this exists

The checkpoint's own instruction ("reutilizando Journey, checklist e progress components existentes") ruled out building anything new here. The Client Journey Platform already tracks stage, requirements, progress, and next-best-actions for every Client — Onboarding is a narrower, onboarding-scoped *view* of that same data, not a new subsystem.

## Read model (`modules/clientPortal/getClientPortalOnboarding.ts`)

```ts
const ONBOARDING_STAGES: JourneyStage[] = ["welcome", "portal_activated", "planning"];

interface ClientPortalOnboarding {
  inOnboarding: boolean;           // false once the Client has moved past `planning` (or hasn't reached `welcome` yet)
  currentStageLabel: string;
  progressPercentage: number;
  currentStageProgress: number;
  checklist: { id, title, completed, detail }[];  // the current stage's own JourneyRequirementResult[], reused as-is
  nextStepLabel: string | null;
}
```

`getClientPortalOnboardingAction()` calls `buildClientJourney()` — the exact same function the Journey Experience page and the Merge Field Engine's own journey domain (Step 2) already call — and reprojects `journey.requirements`/`journey.progress`/`journey.nextBestActions` into this narrower shape. No new business logic: if the underlying Journey Engine's stage/requirement/progress computation changes, Onboarding reflects it automatically, the same "client-safe projection, never the raw object" pattern `getClientPortalJourneySummary.ts` already established.

The `welcome → portal_activated → planning` window is deliberately the three stages immediately after `deposit_paid` and immediately before `ready_for_service` in `JOURNEY_STEPS` (`types/clientJourney.ts`) — the natural "getting set up" phase of a Client's journey, not an arbitrary new stage set.

## UI

`ClientPortalOnboardingView.tsx` (`modules/clientPortal/components/`) renders a `ProgressBar` for `progressPercentage`, the current stage's checklist as completed/pending items, and the next-best-action label — reusing the Client Portal's own `Card`/`ProgressBar`/`EmptyState` primitives, no new visual components. When `inOnboarding` is `false`, the view shows a quiet "not applicable" state rather than stale onboarding content from a stage the Client has already moved past.

## Integration (Step 11)

Wired into `ClientPortalShell.tsx`'s own `NAV_ITEMS` as **Getting Started**, placed right after Overview and before Journey — and into a new route at `/client-access/onboarding` (`app/(client-portal)/client-access/onboarding/page.tsx`), matching the exact async-server-component pattern every other Client Portal page already uses.

## Testing

`getClientPortalOnboarding.test.ts` covers the stage-window boundary (in vs. out of onboarding), checklist projection, and next-step resolution; `ClientPortalShell.test.tsx` and `layout.test.tsx` confirm the new nav entry renders without regressing the existing five.
