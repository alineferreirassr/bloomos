import Image from "next/image";

export interface ActivityFeedItemData {
  id: string;
  actorName: string;
  actorAvatarUrl: string | null;
  text: string;
  relativeTimeLabel: string;
  unread?: boolean;
}

/** The shared "avatar + name/text + relative time" feed row behind both TeamActivityCard (Team Updates) and RecentMessagesCard (Recent Messages) — one list component, two thin named wrappers below, never two near-duplicate implementations. */
export function ActivityFeedList({ items }: { items: ActivityFeedItemData[] }) {
  return (
    <ul className="space-y-3.5">
      {items.map((item) => {
        const initial = item.actorName.trim().charAt(0).toUpperCase() || "?";
        return (
          <li key={item.id} className="flex items-start gap-3">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-luxury-blush">
              {item.actorAvatarUrl ? (
                <Image src={item.actorAvatarUrl} alt="" fill sizes="32px" className="object-cover" />
              ) : (
                <span className="text-xs font-semibold text-luxury-blush-foreground">{initial}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-luxury-body text-luxury-text">
                <span className="font-semibold">{item.actorName}</span> {item.text}
              </span>
              <span className="text-luxury-small text-luxury-text-muted">{item.relativeTimeLabel}</span>
            </span>
            {item.unread ? <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-luxury-rose" /> : null}
          </li>
        );
      })}
    </ul>
  );
}
