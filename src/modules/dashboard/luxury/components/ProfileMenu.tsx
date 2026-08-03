"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signOut } from "@/lib/auth/actions";
import { LuxuryChevronDownIcon } from "@/modules/dashboard/luxury/luxuryIcons";

interface ProfileMenuProps {
  name: string;
  roleLabel: string;
  avatarUrl?: string | null;
}

/** Same click-outside/Escape-to-close shape `ActionMenu.tsx` already established for a small dropdown — a new component here only because it renders identity (avatar/name/role) instead of a list of actions, and always ends with the same real `signOut()` Server Action every other sign-out entry point in this app calls. */
export function ProfileMenu({ name, roleLabel, avatarUrl }: ProfileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    if (result.success) router.push("/sign-in");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors duration-150 hover:bg-luxury-blush focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]"
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-luxury-blush">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="36px" className="object-cover" />
          ) : (
            <span className="font-luxury-display text-sm font-semibold text-luxury-blush-foreground">{initial}</span>
          )}
        </span>
        <LuxuryChevronDownIcon className={`hidden h-4 w-4 text-luxury-text-muted transition-transform duration-150 sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 rounded-luxury-md bg-luxury-surface p-3 shadow-luxury-md">
          <p className="truncate font-luxury-display text-sm font-semibold text-luxury-text">{name}</p>
          <p className="text-luxury-small text-luxury-text-muted">{roleLabel}</p>
          <div className="mt-3 flex flex-col gap-1 border-t border-luxury-border pt-3">
            <a href="/account" role="menuitem" className="rounded-luxury-sm px-2 py-1.5 text-luxury-small text-luxury-text transition-colors duration-150 hover:bg-luxury-blush">
              Account settings
            </a>
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={handleSignOut}
              className="rounded-luxury-sm px-2 py-1.5 text-left text-luxury-small text-luxury-critical transition-colors duration-150 hover:bg-luxury-blush disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
