import { describe, expect, it } from "vitest";
import { isAuthRoute, isProtectedRoute, resolveRouteProtectionDecision } from "@/lib/middleware/routeProtection";

describe("isProtectedRoute", () => {
  it.each(["/dashboard", "/account", "/leads", "/clients", "/events", "/contracts", "/finance", "/documents", "/team", "/client-access"])(
    "treats %s as protected",
    (pathname) => {
      expect(isProtectedRoute(pathname)).toBe(true);
    },
  );

  it("treats nested paths under a protected prefix as protected", () => {
    expect(isProtectedRoute("/documents/folders/docfolder_1")).toBe(true);
    expect(isProtectedRoute("/clients/client_1/edit")).toBe(true);
  });

  it("does not treat the root or unlisted paths as protected", () => {
    expect(isProtectedRoute("/")).toBe(false);
    expect(isProtectedRoute("/sign-in")).toBe(false);
    expect(isProtectedRoute("/anything-else")).toBe(false);
  });

  it("does not false-positive on a route that merely starts with the same characters", () => {
    expect(isProtectedRoute("/documentsxyz")).toBe(false);
  });
});

describe("isAuthRoute", () => {
  it.each(["/sign-in", "/reset-password", "/update-password", "/auth/callback", "/invitations", "/client-invitations"])(
    "treats %s as an auth route",
    (pathname) => {
      expect(isAuthRoute(pathname)).toBe(true);
    },
  );

  it("does not treat protected routes as auth routes", () => {
    expect(isAuthRoute("/dashboard")).toBe(false);
  });
});

describe("resolveRouteProtectionDecision", () => {
  it("always allows in mock mode, even for a protected route with no session", () => {
    const decision = resolveRouteProtectionDecision({ pathname: "/documents", dataMode: "mock", hasSession: false });
    expect(decision).toEqual({ action: "allow" });
  });

  it("allows a protected route in supabase mode when a session exists", () => {
    const decision = resolveRouteProtectionDecision({ pathname: "/documents", dataMode: "supabase", hasSession: true });
    expect(decision).toEqual({ action: "allow" });
  });

  it("redirects to /sign-in for a protected route in supabase mode with no session", () => {
    const decision = resolveRouteProtectionDecision({ pathname: "/documents", dataMode: "supabase", hasSession: false });
    expect(decision).toEqual({ action: "redirect", to: "/sign-in?redirectTo=%2Fdocuments" });
  });

  it("preserves the exact original pathname in redirectTo for a nested route", () => {
    const decision = resolveRouteProtectionDecision({
      pathname: "/documents/folders/docfolder_1",
      dataMode: "supabase",
      hasSession: false,
    });
    expect(decision).toEqual({ action: "redirect", to: "/sign-in?redirectTo=%2Fdocuments%2Ffolders%2Fdocfolder_1" });
  });

  it("never redirects the sign-in route itself, avoiding a redirect loop", () => {
    const decision = resolveRouteProtectionDecision({ pathname: "/sign-in", dataMode: "supabase", hasSession: false });
    expect(decision).toEqual({ action: "allow" });
  });

  it("never redirects the auth callback route", () => {
    const decision = resolveRouteProtectionDecision({ pathname: "/auth/callback", dataMode: "supabase", hasSession: false });
    expect(decision).toEqual({ action: "allow" });
  });

  it("allows an unprotected route in supabase mode with no session", () => {
    const decision = resolveRouteProtectionDecision({ pathname: "/", dataMode: "supabase", hasSession: false });
    expect(decision).toEqual({ action: "allow" });
  });
});
