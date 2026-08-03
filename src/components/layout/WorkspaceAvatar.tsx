"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Sidebar/MobileNav identity avatar — the official Amoré Bloom logo inside
 * a 30px circular frame, falling back to "AB" initials only if the image
 * fails to load. No background tint sits behind the real logo (only the
 * text fallback gets one, so it still reads as a chip) — the transparent
 * artwork shows directly against the sidebar's own background, never a
 * white/beige/colored box. A small inset (~2.5px each side) keeps the mark
 * at roughly 80% of the frame rather than touching the circular clip edge.
 * Extracted as one shared component since Sidebar and MobileNav render
 * byte-identical markup for this element.
 */
export function WorkspaceAvatar() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={`relative flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full ${imageFailed ? "bg-accent/10" : ""}`}
    >
      {imageFailed ? (
        <span className="font-serif text-[13px] font-semibold text-accent">AB</span>
      ) : (
        <Image
          src="/brand/amore-bloom-app-logo.png"
          alt="Amoré Bloom"
          fill
          sizes="30px"
          className="object-contain p-[2.5px]"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
