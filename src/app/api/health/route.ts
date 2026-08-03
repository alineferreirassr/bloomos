import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

/**
 * A real, working health check — not just an interface. Deliberately
 * unauthenticated (a load balancer/uptime monitor has no session) and
 * deliberately cheap (no database round-trip) — this reports "the app
 * process is up," not "every downstream dependency is healthy," which is
 * a different, heavier check this route doesn't attempt.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: packageJson.version,
    timestamp: new Date().toISOString(),
  });
}
