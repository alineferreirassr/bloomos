import Image from "next/image";

export type BloomAvatarSize = "sm" | "md" | "lg";

interface BloomAvatarProps {
  /** Full display name — used for initials AND alt text. Never omit even when a photo is supplied, since the fallback must always be able to render something real. */
  name: string;
  photoUrl?: string | null;
  size?: BloomAvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<BloomAvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-lg",
  lg: "h-16 w-16 text-2xl",
};

/**
 * Checkpoint 19.3, Step 9 — the one shared person/entity avatar for every
 * Classical page (Account, Client, Vendor, Inventory contact, Team). Before
 * this, at least three non-interoperable inline recipes existed across the
 * app (a serif/1-letter/text-lg variant in Account views, a non-serif/
 * 2-letter/text-sm variant in Client/Vendor/Inventory detail views, and no
 * shared `getInitials` logic anywhere) — see docs/bloom-design-language.md
 * for the audit. This component is deliberately Classical-token only
 * (bg-accent-100/text-accent, serif initials); the three approved Luxury
 * Dashboards keep their own existing blush-toned avatar treatment in
 * `ProfileMenu`/`PlannerContactCard`/`ActivityFeedList` completely
 * untouched, per this checkpoint's own "do not redesign approved layouts"
 * rule — the two token families were always meant to stay distinct.
 */
export function BloomAvatar({ name, photoUrl, size = "md", className = "" }: BloomAvatarProps) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  return (
    <span
      role="img"
      aria-label={name}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-100 font-serif font-semibold text-accent ${SIZE_CLASSES[size]} ${className}`}
    >
      {photoUrl ? (
        <Image src={photoUrl} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
