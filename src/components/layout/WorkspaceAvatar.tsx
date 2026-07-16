"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Sidebar/MobileNav identity avatar — the official Amoré Bloom logo inside
 * the existing 30px circular container, falling back to "AB" initials only
 * if the image fails to load. Extracted as one shared component since
 * Sidebar and MobileNav render byte-identical markup for this element.
 */
export function WorkspaceAvatar() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10">
      {imageFailed ? (
        <span className="font-serif text-[13px] font-semibold text-accent">AB</span>
      ) : (
        <Image
          src="/brand/amore-bloom-logo.png"
          alt="Amoré Bloom"
          fill
          sizes="30px"
          className="object-contain p-0.5"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  );
}
