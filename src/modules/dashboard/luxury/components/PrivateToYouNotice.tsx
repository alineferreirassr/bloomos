import { LuxuryHeartIcon } from "@/modules/dashboard/luxury/luxuryIcons";

/** The one place this exact microcopy is written — reused by every personal wellness widget so the wording (and the privacy guarantee it describes) never drifts between cards. */
export function PrivateToYouNotice({ detail }: { detail: string }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-luxury-small text-luxury-text-muted">
      <LuxuryHeartIcon className="mt-0.5 h-3 w-3 shrink-0 text-luxury-rose" aria-hidden="true" />
      <span>
        <span className="font-medium text-luxury-text">Private to you.</span> {detail}
      </span>
    </p>
  );
}
