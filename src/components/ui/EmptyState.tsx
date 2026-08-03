import type { ComponentType, ReactNode, SVGProps } from "react";
import { BloomIllustration, type BloomIllustrationVariant } from "@/components/ui/BloomIllustration";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * Checkpoint 19.2, Step 4 — a soft icon badge for modules that don't yet
   * have a matching Bloom Illustration variant. Superseded by `illustration`
   * when both are given.
   */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /**
   * Checkpoint 19.3, Step 3/10 — the richer Bloom Illustration System
   * treatment (see `BloomIllustration.tsx`): a soft blush backdrop with
   * thin rose line art reusing the official mark's own visual vocabulary.
   * Prefer this over `icon` wherever a matching variant exists.
   */
  illustration?: BloomIllustrationVariant;
  /** A quieter, non-CTA link/text placed below the primary action (Step 4's "Secondary Help"), e.g. "Learn how Leads work". */
  secondaryAction?: ReactNode;
}

export function EmptyState({ title, description, action, icon: Icon, illustration, secondaryAction }: EmptyStateProps) {
  return (
    <div className="animate-fade-up flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-tint px-6 py-16 text-center">
      {illustration ? (
        <BloomIllustration variant={illustration} className="mb-4" />
      ) : Icon ? (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-100">
          <Icon className="h-6 w-6 text-accent" aria-hidden="true" />
        </span>
      ) : null}
      <p className="font-serif text-base text-text/70">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
      {secondaryAction ? <div className="mt-2 text-xs text-text-muted">{secondaryAction}</div> : null}
    </div>
  );
}
