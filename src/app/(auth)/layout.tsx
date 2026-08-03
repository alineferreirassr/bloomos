import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Deliberately outside `(app)`/`AppShell` — no sidebar, no top bar. This is
 * a minimal foundation-phase layout, not the final polished Auth UI.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/brand/amore-bloom-app-logo.png"
            alt="Amoré Bloom"
            width={670}
            height={670}
            priority
            className="h-auto w-32"
          />
          <div className="mt-2 text-[11px] tracking-[0.06em] text-text/55 uppercase">
            Luxury Proposal &amp; Event Studio
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
