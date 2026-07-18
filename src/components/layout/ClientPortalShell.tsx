"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";

const NAV_ITEMS = [
  { href: "/client-access", label: "Overview" },
  { href: "/client-access/events", label: "My Events" },
  { href: "/client-access/contracts", label: "My Contracts" },
  { href: "/client-access/invoices", label: "My Invoices" },
  { href: "/client-access/documents", label: "My Documents" },
] as const;

/** Exact match for the Overview route (it's also the prefix of every other route), longest-prefix match for everything else. */
function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/client-access") return pathname === "/client-access";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The Client Portal's own shell — deliberately not `AppShell` (no internal
 * Sidebar, no Team navigation, no internal Dashboard). A client account
 * must never enter the internal Team Portal shell; see
 * docs/permissions.md. Branding reads "Amoré Bloom Client Portal", never
 * the bare Workspace name or the internal owner/non-owner variants.
 * Navigation is identical for every client (no permission gating needed —
 * unlike the internal Sidebar, there's no role/permission concept here).
 */
export function ClientPortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const result = await signOut();
    setLoggingOut(false);
    if (result.success) router.push("/sign-in");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Image src="/brand/amore-bloom-logo.png" alt="Amoré Bloom" width={640} height={426} priority className="h-8 w-auto" />
            <span className="text-xs tracking-[0.06em] text-text-muted uppercase">Client Portal</span>
          </div>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Client Portal navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  isActiveRoute(pathname, item.href) ? "bg-accent/10 font-medium text-accent" : "text-text hover:bg-accent/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/client-access/account"
              className={`rounded-md px-3 py-1.5 text-sm ${
                isActiveRoute(pathname, "/client-access/account") ? "bg-accent/10 font-medium text-accent" : "text-text hover:bg-accent/5"
              }`}
            >
              Account
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleLogout} disabled={loggingOut} className="hidden sm:inline-flex">
              {loggingOut ? "Signing out…" : "Sign out"}
            </Button>
            <button
              type="button"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setMobileOpen((open) => !open)}
              className="rounded-md border border-border px-2.5 py-1.5 text-sm text-text sm:hidden"
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav className="border-t border-border px-4 py-2 sm:hidden" aria-label="Client Portal mobile navigation">
            <ul className="space-y-1">
              {[...NAV_ITEMS, { href: "/client-access/account", label: "Account" }].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-md px-3 py-2 text-sm ${
                      isActiveRoute(pathname, item.href) ? "bg-accent/10 font-medium text-accent" : "text-text hover:bg-accent/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-text hover:bg-accent/5"
                >
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
