"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Sidebar/MobileNav identity avatar — the official Amoré Bloom logo, falling
 * back to "AB" initials only if the image fails to load.
 *
 * GLOBAL-VISUAL-01 Round 4.5 — founder correction: the logo artwork already
 * contains its own circular composition, so clipping it into a second
 * `rounded-full` frame produced a visible "circle inside a circle." The
 * circular frame is now applied ONLY to the text fallback (where it's
 * actually needed — "AB" initials need a shape to read as a chip); the real
 * logo renders unclipped, at its own natural transparency/aspect ratio, no
 * added round border or background plate.
 */
export function WorkspaceAvatar() {
  const [imageFailed, setImageFailed] = useState(false);

  if (imageFailed) {
    return (
      <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent/10">
        <span className="font-serif text-[13px] font-semibold text-accent">AB</span>
      </div>
    );
  }

  return (
    <div className="relative h-[30px] w-[30px] shrink-0">
      <Image
        src="/brand/amore-bloom-app-logo.png"
        alt="Amoré Bloom"
        fill
        sizes="30px"
        className="object-contain"
        onError={() => setImageFailed(true)}
      />
    </div>
  );
}
