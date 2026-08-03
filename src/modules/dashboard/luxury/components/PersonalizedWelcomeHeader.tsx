import type { ReactNode } from "react";
import { LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import type { WelcomeCopy } from "@/core/dashboard/buildWelcomeCopy";

interface PersonalizedWelcomeHeaderProps {
  copy: WelcomeCopy;
  actions?: ReactNode;
}

/** Checkpoint 19, Step 5 — the shared "Good morning, {name} ♡ / {subtitle}" header every one of the three dashboards opens with, paired with the top-right action row (date selector, notifications, messages, profile) each dashboard supplies. Checkpoint 19.2, Step 2 — the first stage of each dashboard's staggered entrance (a gentle fade-down, no delay), shared across all three since this one component is the "Greeting" step for each. */
export function PersonalizedWelcomeHeader({ copy, actions }: PersonalizedWelcomeHeaderProps) {
  return (
    <div className="animate-fade-down flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 font-luxury-display text-luxury-display font-semibold text-luxury-text" style={{ textWrap: "balance" }}>
          {copy.greeting}
          <LuxuryHeartIcon className="h-6 w-6 shrink-0 text-luxury-rose" aria-hidden="true" />
        </h1>
        <p className="mt-1.5 text-luxury-body text-luxury-text-muted">{copy.subtitle}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}
