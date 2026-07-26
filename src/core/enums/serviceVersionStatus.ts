/**
 * Every Service has exactly one "draft" ServiceVersion (the mutable working
 * copy all template edits target) and zero or more "published" versions
 * (immutable forever once reached — see core/workflows/serviceWorkflow.ts's
 * publishServiceVersion). An EventService may only ever pin to a
 * "published" version, never to a "draft" one, so an in-progress catalog
 * edit can never leak into a live booking before it's deliberately published.
 */
export type ServiceVersionStatus = "draft" | "published";
