import { Lock, Database, ShieldCheck, Crown } from "lucide-react";
import { LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";

interface StatusItem {
  icon: typeof Lock;
  label: string;
}

interface OwnerHomeHeaderProps {
  studioDate: string;
  greeting: string;
  contextualSentence: string;
  /** VISUAL-01 addendum — only truthfully renderable when `getDataMode() === "supabase"`; never shown as "connected" in mock mode. */
  isSupabaseConnected: boolean;
  /** VISUAL-01 addendum — only truthfully renderable when the authenticated member's own real role is literally "owner" (never merely "has the Owner dashboard experience", which `admin` also gets — see `resolveDashboardExperience`). */
  isFounder: boolean;
}

/**
 * VISUAL-01 — the founder-locked Owner Home top hierarchy: a small
 * uppercase "TODAY'S STUDIO · {date}" eyebrow, the dominant serif
 * greeting, a truthful calm contextual sentence, and a quiet system-status
 * metadata row. Deliberately a NEW, Owner-only component rather than a
 * change to the shared `PersonalizedWelcomeHeader` (still used unchanged
 * by Team) — this structure (eyebrow + contextual sentence + status row)
 * is Owner-specific per the founder's own explicit direction, and Team's
 * header must never pick up "Founder access" or any of this new markup.
 *
 * "Audit active" is deliberately never one of the four status items — the
 * founder explicitly rejected it (SOCIAL-21C closure addendum): the
 * current audit log service is mock-backed only
 * (`core/audit/index.ts` — "Mock-only this phase"), never truthfully
 * persistent, so it is never rendered here at all rather than shown as a
 * fabricated "active" state.
 *
 * Status items render as plain small icon + small muted text — never a
 * card/pill/button/colored badge — matching the founder's own "quiet
 * system metadata, not five badges" direction.
 */
export function OwnerHomeHeader({ studioDate, greeting, contextualSentence, isSupabaseConnected, isFounder }: OwnerHomeHeaderProps) {
  const statusItems: StatusItem[] = [
    { icon: Lock, label: "Secure session" },
    ...(isSupabaseConnected ? [{ icon: Database, label: "Supabase connected" }] : []),
    { icon: ShieldCheck, label: "RLS protected" },
    ...(isFounder ? [{ icon: Crown, label: "Founder access" }] : []),
  ];

  return (
    <div className="animate-fade-down">
      {/* GLOBAL-VISUAL-01 Round 4.3 Revision A — removed the sm:3.25rem (52px) step-up; the
          founder-approved prototype holds the greeting at a flat 2.75rem (44px). */}
      <p className="text-luxury-status font-medium tracking-[0.16em] text-luxury-coral uppercase">Today&rsquo;s Studio &middot; {studioDate}</p>
      <h1 className="mt-3 flex items-center gap-3 font-luxury-display text-[2.75rem] leading-[1.1] font-semibold text-luxury-text" style={{ textWrap: "balance" }}>
        {greeting}
        <LuxuryHeartIcon className="h-7 w-7 shrink-0 text-luxury-rose" aria-hidden="true" />
      </h1>
      <p className="mt-3 text-luxury-body text-luxury-text-muted">{contextualSentence}</p>

      <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="System status">
        {statusItems.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-1.5 text-luxury-status text-luxury-text-muted/90">
            <Icon className="h-3.5 w-3.5 shrink-0 text-luxury-text-muted/90" aria-hidden="true" strokeWidth={1.5} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
