import type { ReactNode } from "react";

/**
 * Deliberately outside `(app)`/`AppShell` — no sidebar, no top bar. This is
 * a minimal foundation-phase layout, not the final polished Auth UI.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="font-serif text-xl font-semibold tracking-[0.01em] text-text">BloomOS</div>
          <div className="mt-1 text-[11px] tracking-[0.06em] text-text/55 uppercase">Amoré Bloom</div>
        </div>
        {children}
      </div>
    </div>
  );
}
