export type BloomIllustrationVariant =
  | "leads"
  | "events"
  | "inventory"
  | "documents"
  | "vendors"
  | "payments"
  | "messages"
  | "generic";

interface BloomIllustrationProps {
  variant?: BloomIllustrationVariant;
  className?: string;
}

/**
 * Checkpoint 19.3, Step 3 — the Bloom Illustration System. A small set of
 * dependency-free, hand-drawn-style inline SVGs (thin rose-stroke line art
 * over a soft blush backdrop, sparkle accents) reusing the exact visual
 * vocabulary of the official Amoré Bloom mark itself (a heart, a camera,
 * sparkles) rather than a generic clip-art library — the same "no external
 * asset pipeline exists here" constraint `RevenueTrendChart` already
 * established for charts. Deliberately simpler than full illustrated
 * artwork (a handful of shared shapes recombined per variant, not bespoke
 * art per empty state) — see docs/bloom-design-language.md for the full
 * rationale and known limitations of this scope.
 */
export function BloomIllustration({ variant = "generic", className = "" }: BloomIllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`h-24 w-24 ${className}`}
      aria-hidden="true"
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="60" cy="60" r="52" fill="var(--color-accent-100)" stroke="none" />
      <path d="M40 43 l4 -4 M76 43 l4 -4 M40 87 l4 4 M80 87 l-4 4" opacity="0.55" />
      {variant === "leads" ? (
        <>
          <path d="M60 44c-9-11-26-3-24 9 2 12 24 24 24 24s22-12 24-24c2-12-15-20-24-9z" />
          <circle cx="60" cy="52" r="3.2" fill="var(--color-accent)" stroke="none" />
        </>
      ) : variant === "events" ? (
        <>
          <rect x="36" y="42" width="48" height="38" rx="4" />
          <path d="M36 54h48M46 38v8M74 38v8" />
          <circle cx="60" cy="66" r="3" fill="var(--color-accent)" stroke="none" />
        </>
      ) : variant === "inventory" ? (
        <>
          <path d="M40 48l20-10 20 10-20 10z" />
          <path d="M40 48v22l20 10 20-10V48M60 58v22" />
        </>
      ) : variant === "documents" ? (
        <>
          <path d="M44 36h22l10 10v38H44z" />
          <path d="M66 36v10h10M50 58h20M50 66h20M50 74h12" />
        </>
      ) : variant === "vendors" ? (
        <>
          <rect x="38" y="52" width="30" height="20" rx="2" />
          <path d="M68 58h10l6 8v6H68z" />
          <circle cx="48" cy="76" r="4" />
          <circle cx="76" cy="76" r="4" />
        </>
      ) : variant === "payments" ? (
        <>
          <rect x="38" y="46" width="44" height="30" rx="4" />
          <path d="M38 56h44" />
          <circle cx="50" cy="66" r="3" fill="var(--color-accent)" stroke="none" />
        </>
      ) : variant === "messages" ? (
        <>
          <path d="M38 46h44a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H54l-10 8v-8h-6a4 4 0 0 1-4-4V50a4 4 0 0 1 4-4z" />
          <path d="M46 58h28M46 66h18" />
        </>
      ) : (
        <>
          <path d="M60 44c-9-11-26-3-24 9 2 12 24 24 24 24s22-12 24-24c2-12-15-20-24-9z" />
        </>
      )}
    </svg>
  );
}
