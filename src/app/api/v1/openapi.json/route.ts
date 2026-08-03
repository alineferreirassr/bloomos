import { NextResponse } from "next/server";
import { OPENAPI_DOCUMENT } from "@/core/api/openapi";

/**
 * Checkpoint 16, Step 10 — `GET /api/v1/openapi.json`. Deliberately
 * unauthenticated, unlike every other `/api/v1/*` route — an OpenAPI
 * discovery document is meant to be fetchable by tooling (Swagger UI,
 * codegen) before a caller has ever seen an API Key, the same convention
 * every public REST API's own `/openapi.json`/`/swagger.json` follows.
 * Static content, so no `force-dynamic` override is needed here.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(OPENAPI_DOCUMENT);
}
