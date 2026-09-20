"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { recordMediaKitCtaClickedAction } from "@/modules/mediaKit/recordMediaKitCtaClickedAction";

interface PublicMediaKitCtaButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  slug: string;
  ctaId: string;
  children: ReactNode;
}

/**
 * MEDIAKIT-05 — wraps any public CTA anchor (hero, contact section,
 * secondary link) with fire-and-forget `cta_clicked` tracking. Never
 * awaited, never blocks navigation — a tracking failure must never keep a
 * real visitor from reaching the inquiry form or an external link.
 */
export function PublicMediaKitCtaButton({ slug, ctaId, children, onClick, ...anchorProps }: PublicMediaKitCtaButtonProps) {
  return (
    <a
      {...anchorProps}
      onClick={(event) => {
        void recordMediaKitCtaClickedAction(slug, ctaId);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
