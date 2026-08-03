import Image from "next/image";
import { LuxuryMailIcon, LuxuryPhoneIcon } from "@/modules/dashboard/luxury/luxuryIcons";

export interface PlannerContactData {
  name: string;
  avatarUrl: string | null;
  email: string | null;
  /** No phone/WhatsApp field exists on a Team Member profile today — stays `null` until that field is added; the row is simply omitted rather than fabricated. See docs/client-dashboard-experience.md's Known limitations. */
  phone: string | null;
}

/** Checkpoint 19, Step 9 — the Client Dashboard's "Planner contact" card. Only ever renders channels that are real fields on the resolved Team Member; a missing phone number omits that row instead of inventing one. */
export function PlannerContactCard({ planner }: { planner: PlannerContactData }) {
  const initial = planner.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-luxury-blush">
        {planner.avatarUrl ? (
          <Image src={planner.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span className="font-luxury-display font-semibold text-luxury-blush-foreground">{initial}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">{planner.name}</p>
        <p className="text-luxury-small text-luxury-text-muted">Your Planner</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {planner.phone ? (
          <a href={`tel:${planner.phone}`} aria-label={`Call ${planner.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-luxury-blush text-luxury-rose transition-colors duration-150 hover:bg-luxury-rose hover:text-luxury-rose-foreground">
            <LuxuryPhoneIcon className="h-4 w-4" />
          </a>
        ) : null}
        {planner.email ? (
          <a href={`mailto:${planner.email}`} aria-label={`Email ${planner.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-luxury-blush text-luxury-rose transition-colors duration-150 hover:bg-luxury-rose hover:text-luxury-rose-foreground">
            <LuxuryMailIcon className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
