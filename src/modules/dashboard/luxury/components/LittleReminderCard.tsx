import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { LuxuryBellIcon } from "@/modules/dashboard/luxury/luxuryIcons";

export interface LittleReminderData {
  title: string;
  body: string;
}

/**
 * Sourced from the real Notification Platform (the caller's own unread,
 * `recipient_member_id`-targeted notifications — see
 * `getTeamDashboardData.ts`), never fabricated placeholder content. This is
 * NOT a private wellness widget — Founder/Admin already own the write side
 * of this data by design (they're the ones sending reminders); it's simply
 * styled to feel as light and personal as the cards next to it.
 */
export function LittleReminderCard({ reminder, compact = false }: { reminder: LittleReminderData | null; compact?: boolean }) {
  const iconSize = compact ? "h-6 w-6" : "h-8 w-8";
  const iconGlyphSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const titleSpacing = compact ? "mt-1.5" : "mt-3";
  return (
    <LuxuryCard padding={compact ? "compact" : "default"}>
      <div className="flex items-center gap-2">
        <span className={`flex ${iconSize} shrink-0 items-center justify-center rounded-luxury-md bg-luxury-blush text-luxury-rose`}>
          <LuxuryBellIcon className={iconGlyphSize} />
        </span>
        <p className="text-luxury-small font-semibold text-luxury-rose">Little Reminder ♡</p>
      </div>
      {reminder ? (
        <>
          <p className={`${titleSpacing} text-luxury-body font-semibold text-luxury-text`}>{reminder.title}</p>
          <p className="mt-0.5 text-luxury-small text-luxury-text-muted">{reminder.body}</p>
        </>
      ) : (
        <p className={`${titleSpacing} text-luxury-small text-luxury-text-muted`}>Small steps still move you forward.</p>
      )}
    </LuxuryCard>
  );
}
