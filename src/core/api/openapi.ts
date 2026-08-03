import { API_SCOPE_DESCRIPTIONS, type ApiScope } from "@/types/apiScope";
import { registerBuiltinWebhookEvents } from "@/modules/webhooks/registerBuiltinWebhookEvents";
import { listWebhookEvents } from "@/core/webhooks/eventRegistry";
import { WEBHOOK_SIGNATURE_HEADER } from "@/lib/webhooks/signature";

registerBuiltinWebhookEvents();

/**
 * Checkpoint 16, Step 10 — a hand-curated OpenAPI 3.1 document, not an
 * auto-discovery registry that walks the `app/api/v1` route tree. Every
 * `/api/v1/*` route this checkpoint built is listed here explicitly, the
 * same "one source of truth someone actually reads and reviews" tradeoff
 * `docs/public-api.md` itself makes — an auto-generated spec would silently
 * drift the moment a route file's own query-param parsing changed without
 * a matching edit here, which is worse than a spec that requires a
 * deliberate edit to stay accurate.
 *
 * Scopes aren't expressed via OpenAPI's own `security`/OAuth2 flows (this
 * checkpoint's own Non-Goal excludes OAuth) — each operation instead
 * carries a `x-required-scope` extension naming the one `ApiScope` it
 * checks, plus the same requirement spelled out in its `description`.
 */

type JsonSchema = Record<string, unknown>;

interface OpenApiParameter {
  name: string;
  in: "query" | "path";
  required?: boolean;
  description: string;
  schema: JsonSchema;
  example?: unknown;
}

interface OpenApiResponse {
  description: string;
  content?: { "application/json": { schema: JsonSchema } };
}

interface OpenApiOperation {
  summary: string;
  description: string;
  tags: string[];
  "x-required-scope": ApiScope;
  parameters?: OpenApiParameter[];
  responses: Record<string, OpenApiResponse>;
}

interface OpenApiWebhookOperation {
  summary: string;
  description: string;
  tags: string[];
  requestBody: { required: true; content: { "application/json": { schema: JsonSchema; example: JsonSchema } } };
  responses: Record<string, OpenApiResponse>;
}

interface OpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  security: Record<string, never[]>[];
  paths: Record<string, Record<"get", OpenApiOperation>>;
  /**
   * Checkpoint 17, Step 12 — OpenAPI 3.1's own native `webhooks` keyword
   * (introduced in 3.1 specifically for documenting outbound, server-to-
   * subscriber traffic like this). Deliberately NOT a `paths` entry —
   * these describe what BloomOS sends TO a subscriber's own URL, the
   * opposite direction from every `paths` entry above. Built once from
   * `listWebhookEvents()` (`buildWebhooksSection()` below), never
   * hand-duplicated per event.
   */
  webhooks: Record<string, Record<"post", OpenApiWebhookOperation>>;
  components: {
    securitySchemes: Record<string, JsonSchema>;
    schemas: Record<string, JsonSchema>;
  };
}

const ERROR_RESPONSE: OpenApiResponse["content"] = { "application/json": { schema: { $ref: "#/components/schemas/Error" } } };

const STANDARD_ERRORS: Record<string, OpenApiResponse> = {
  "401": { description: "Missing, invalid, or revoked API Key.", content: ERROR_RESPONSE },
  "403": { description: "The API Key lacks the scope this endpoint requires.", content: ERROR_RESPONSE },
  "429": { description: "Too many requests.", content: ERROR_RESPONSE },
  "500": { description: "Something went wrong processing the request.", content: ERROR_RESPONSE },
};

function ref(schema: string): JsonSchema {
  return { $ref: `#/components/schemas/${schema}` };
}

function paginatedResponse(itemSchema: string, description: string): OpenApiResponse {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            data: { type: "array", items: ref(itemSchema) },
            meta: ref("PaginationMeta"),
          },
          required: ["data"],
        },
      },
    },
  };
}

function itemResponse(schema: JsonSchema, description: string): OpenApiResponse {
  return {
    description,
    content: { "application/json": { schema: { type: "object", properties: { data: schema }, required: ["data"] } } },
  };
}

const PAGE_PARAM: OpenApiParameter = { name: "page", in: "query", description: "1-indexed page number.", schema: { type: "integer", minimum: 1, default: 1 } };
const PER_PAGE_PARAM: OpenApiParameter = { name: "per_page", in: "query", description: "Items per page (max 100).", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } };

function sortParam(fields: readonly string[]): OpenApiParameter {
  return {
    name: "sort",
    in: "query",
    description: `Sort field. Prefix with "-" for descending. One of: ${fields.join(", ")}.`,
    schema: { type: "string" },
    example: `-${fields[fields.length - 1]}`,
  };
}

function idParam(description: string): OpenApiParameter {
  return { name: "id", in: "path", required: true, description, schema: { type: "string" } };
}

function windowParam(): OpenApiParameter {
  return { name: "window", in: "query", description: 'Trend window: "today", "7d", "30d", "90d", or "year". Defaults to "30d".', schema: { type: "string", enum: ["today", "7d", "30d", "90d", "year"] } };
}

function scopeDescription(scope: ApiScope): string {
  return `Requires the \`${scope}\` scope. ${API_SCOPE_DESCRIPTIONS[scope]}`;
}

const CATEGORY_TAG_NAMES: Record<string, string> = { crm: "CRM", finance: "Finance", documents: "Documents", workflow: "Workflow", portal: "Portal", analytics: "Analytics" };

/** Checkpoint 17, Step 12 — one `webhooks` entry per registered `WebhookEventDefinition`, never hand-duplicated per event. Each entry's `payload` schema is the exact same `WebhookEventDefinition.payloadSchema` the Webhook Event Registry already declares (`core/webhooks/eventRegistry.ts`) — this function only wraps it in the shared envelope shape, never redefines it. */
function buildWebhooksSection(): OpenApiDocument["webhooks"] {
  const section: OpenApiDocument["webhooks"] = {};
  for (const definition of listWebhookEvents()) {
    section[definition.type] = {
      post: {
        summary: `${definition.name} (v${definition.version})`,
        description: `${definition.description} Delivered to every enabled Webhook Endpoint subscribed to \`${definition.type}\`, signed via the \`${WEBHOOK_SIGNATURE_HEADER}\` header — see docs/webhooks.md for verification examples.`,
        tags: [CATEGORY_TAG_NAMES[definition.category] ?? definition.category],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string", description: "This delivery's own id — stable across retries of the same attempt sequence." },
                  timestamp: { type: "string" },
                  workspace: { type: "string" },
                  version: { type: "integer", const: definition.version },
                  event: { type: "string", const: definition.type },
                  resource: { type: "object", properties: { type: { type: "string" }, id: { type: "string" } } },
                  metadata: { type: "object" },
                  payload: definition.payloadSchema,
                },
                required: ["id", "timestamp", "workspace", "version", "event", "resource", "metadata", "payload"],
              },
              example: {
                id: "whevt_00000000-0000-0000-0000-000000000000",
                timestamp: "2026-01-01T00:00:00.000Z",
                workspace: "ws_amore_bloom",
                version: definition.version,
                event: definition.type,
                resource: { type: definition.category, id: "example_id" },
                metadata: {},
                payload: {},
              },
            },
          },
        },
        responses: {
          "200": { description: "Any 2xx response marks the delivery successful. A non-2xx status or a timeout triggers a retry per the Retry Engine's exponential backoff policy — see docs/webhooks.md's own Retry policy section." },
        },
      },
    };
  }
  return section;
}

export const OPENAPI_DOCUMENT: OpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "BloomOS Public API",
    version: "1.0.0",
    description:
      "A read-only, versioned REST API exposing BloomOS CRM, Finance, Documents, Workflow, Analytics, and Client Portal data to trusted third-party applications. Authenticate with a workspace-scoped API Key; every endpoint additionally validates a scope. See docs/public-api.md for the full guide. Also publishes outbound Webhooks (see the `webhooks` section below) — signed with HMAC-SHA256, retried with exponential backoff, and manageable from the Developer Console. See docs/webhooks.md and docs/webhook-events.md.",
  },
  servers: [{ url: "/api/v1", description: "Current version" }],
  tags: [
    { name: "CRM", description: "Clients, Events, Proposals, Search." },
    { name: "Finance", description: "Invoices, Receipts, Outstanding Balance, Transactions." },
    { name: "Documents", description: "Templates, Documents, Versions, Downloads." },
    { name: "Workflow", description: "Workflow list/details, Simulation history, Templates. Never execution." },
    { name: "Analytics", description: "Metrics, Dashboard summaries, KPI Cards, Executive Summary." },
    { name: "Portal", description: "Client Portal Users, Timeline, Checklist, Messages metadata, Notifications." },
  ],
  security: [{ ApiKeyAuth: [] }],
  webhooks: buildWebhooksSection(),
  paths: {
    "/clients": {
      get: {
        summary: "List Clients",
        description: scopeDescription("crm.read"),
        tags: ["CRM"],
        "x-required-scope": "crm.read",
        parameters: [
          { name: "search", in: "query", description: "Free-text match against name/email/phone.", schema: { type: "string" } },
          { name: "status", in: "query", description: "Filter by internal status, or \"all\".", schema: { type: "string" } },
          { name: "include_archived", in: "query", description: "Include archived Clients.", schema: { type: "boolean", default: false } },
          sortParam(["name", "created_at"]),
          PAGE_PARAM,
          PER_PAGE_PARAM,
        ],
        responses: { "200": paginatedResponse("Client", "A page of Clients."), ...STANDARD_ERRORS },
      },
    },
    "/clients/{id}": {
      get: {
        summary: "Get a Client",
        description: scopeDescription("crm.read"),
        tags: ["CRM"],
        "x-required-scope": "crm.read",
        parameters: [idParam("The Client id.")],
        responses: { "200": itemResponse(ref("Client"), "The Client."), "404": { description: "No Client with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/events": {
      get: {
        summary: "List Events",
        description: scopeDescription("crm.read"),
        tags: ["CRM"],
        "x-required-scope": "crm.read",
        parameters: [
          { name: "search", in: "query", description: "Free-text match against title/location.", schema: { type: "string" } },
          { name: "status", in: "query", description: "Filter by status, or \"all\".", schema: { type: "string" } },
          { name: "client_id", in: "query", description: "Narrow to one Client's Events.", schema: { type: "string" } },
          { name: "date_from", in: "query", description: "ISO date lower bound (inclusive) on event_date.", schema: { type: "string", format: "date" } },
          { name: "date_to", in: "query", description: "ISO date upper bound (inclusive) on event_date.", schema: { type: "string", format: "date" } },
          { name: "include_archived", in: "query", description: "Include archived Events.", schema: { type: "boolean", default: false } },
          sortParam(["title", "event_date", "created_at"]),
          PAGE_PARAM,
          PER_PAGE_PARAM,
        ],
        responses: { "200": paginatedResponse("Event", "A page of Events."), ...STANDARD_ERRORS },
      },
    },
    "/events/{id}": {
      get: {
        summary: "Get an Event",
        description: scopeDescription("crm.read"),
        tags: ["CRM"],
        "x-required-scope": "crm.read",
        parameters: [idParam("The Event id.")],
        responses: { "200": itemResponse(ref("Event"), "The Event."), "404": { description: "No Event with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/proposals": {
      get: {
        summary: "List Proposals",
        description: `${scopeDescription("crm.read")} Without \`event_id\`, returns the Workspace's recent Proposals.`,
        tags: ["CRM"],
        "x-required-scope": "crm.read",
        parameters: [{ name: "event_id", in: "query", description: "Narrow to one Event's Proposals.", schema: { type: "string" } }, PAGE_PARAM, PER_PAGE_PARAM],
        responses: { "200": paginatedResponse("Proposal", "A page of Proposals."), ...STANDARD_ERRORS },
      },
    },
    "/proposals/{id}": {
      get: {
        summary: "Get a Proposal",
        description: scopeDescription("crm.read"),
        tags: ["CRM"],
        "x-required-scope": "crm.read",
        parameters: [idParam("The Proposal id.")],
        responses: { "200": itemResponse(ref("Proposal"), "The Proposal."), "404": { description: "No Proposal with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/search": {
      get: {
        summary: "Search Clients and Events",
        description: `${scopeDescription("crm.read")} Composes the same \`search\` filters as \`/clients\`/\`/events\`, capped at 20 results per type.`,
        tags: ["CRM"],
        "x-required-scope": "crm.read",
        parameters: [{ name: "q", in: "query", required: true, description: "The search query.", schema: { type: "string" } }],
        responses: {
          "200": itemResponse({ type: "object", properties: { clients: { type: "array", items: ref("Client") }, events: { type: "array", items: ref("Event") } } }, "Matching Clients and Events."),
          "400": { description: "Missing or empty ?q=.", content: ERROR_RESPONSE },
          ...STANDARD_ERRORS,
        },
      },
    },
    "/invoices": {
      get: {
        summary: "List Invoices",
        description: scopeDescription("finance.read"),
        tags: ["Finance"],
        "x-required-scope": "finance.read",
        parameters: [
          { name: "status", in: "query", description: "Filter by invoice status, or \"all\".", schema: { type: "string" } },
          { name: "client_id", in: "query", description: "Narrow to one Client's Invoices.", schema: { type: "string" } },
          { name: "event_id", in: "query", description: "Narrow to one Event's Invoices.", schema: { type: "string" } },
          { name: "overdue_only", in: "query", description: "Only overdue Invoices.", schema: { type: "boolean", default: false } },
          { name: "include_archived", in: "query", description: "Include archived Invoices.", schema: { type: "boolean", default: false } },
          sortParam(["issue_date", "due_date", "total_minor", "created_at"]),
          PAGE_PARAM,
          PER_PAGE_PARAM,
        ],
        responses: { "200": paginatedResponse("Invoice", "A page of Invoices."), ...STANDARD_ERRORS },
      },
    },
    "/invoices/{id}": {
      get: {
        summary: "Get an Invoice",
        description: scopeDescription("finance.read"),
        tags: ["Finance"],
        "x-required-scope": "finance.read",
        parameters: [idParam("The Invoice id.")],
        responses: { "200": itemResponse(ref("Invoice"), "The Invoice."), "404": { description: "No Invoice with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/receipts": {
      get: {
        summary: "List Receipts",
        description: scopeDescription("finance.read"),
        tags: ["Finance"],
        "x-required-scope": "finance.read",
        parameters: [
          { name: "invoice_id", in: "query", description: "Narrow to one Invoice's Receipts.", schema: { type: "string" } },
          { name: "client_id", in: "query", description: "Narrow to one Client's Receipts.", schema: { type: "string" } },
          PAGE_PARAM,
          PER_PAGE_PARAM,
        ],
        responses: { "200": paginatedResponse("Receipt", "A page of Receipts."), ...STANDARD_ERRORS },
      },
    },
    "/finance/outstanding-balance": {
      get: {
        summary: "Get the Workspace's outstanding balance",
        description: scopeDescription("finance.read"),
        tags: ["Finance"],
        "x-required-scope": "finance.read",
        responses: {
          "200": itemResponse(
            { type: "object", properties: { outstanding_receivables_minor: { type: "integer" }, overdue_receivables_minor: { type: "integer" }, deposits_pending_minor: { type: "integer" } } },
            "Outstanding balance figures, in minor currency units.",
          ),
          ...STANDARD_ERRORS,
        },
      },
    },
    "/transactions": {
      get: {
        summary: "List Transactions",
        description: `${scopeDescription("finance.read")} Refunds are a \`payment_type\` on the same record, not a separate endpoint.`,
        tags: ["Finance"],
        "x-required-scope": "finance.read",
        parameters: [
          { name: "status", in: "query", description: "Filter by payment status, or \"all\".", schema: { type: "string" } },
          { name: "client_id", in: "query", description: "Narrow to one Client's Transactions.", schema: { type: "string" } },
          { name: "invoice_id", in: "query", description: "Narrow to one Invoice's Transactions.", schema: { type: "string" } },
          { name: "refunds_only", in: "query", description: "Only refund transactions.", schema: { type: "boolean", default: false } },
          sortParam(["transaction_date", "amount_minor"]),
          PAGE_PARAM,
          PER_PAGE_PARAM,
        ],
        responses: { "200": paginatedResponse("Transaction", "A page of Transactions."), ...STANDARD_ERRORS },
      },
    },
    "/templates": {
      get: {
        summary: "List Document Templates",
        description: scopeDescription("documents.read"),
        tags: ["Documents"],
        "x-required-scope": "documents.read",
        parameters: [PAGE_PARAM, PER_PAGE_PARAM],
        responses: { "200": paginatedResponse("Template", "A page of Templates."), ...STANDARD_ERRORS },
      },
    },
    "/templates/{id}": {
      get: {
        summary: "Get a Document Template",
        description: scopeDescription("documents.read"),
        tags: ["Documents"],
        "x-required-scope": "documents.read",
        parameters: [idParam("The Template id.")],
        responses: { "200": itemResponse(ref("Template"), "The Template."), "404": { description: "No Template with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/documents": {
      get: {
        summary: "List Documents",
        description: `${scopeDescription("documents.read")} Returns a summary shape (identity + metadata) — never the full \`content\` block array. Use \`/documents/{id}\` for the full record.`,
        tags: ["Documents"],
        "x-required-scope": "documents.read",
        parameters: [PAGE_PARAM, PER_PAGE_PARAM],
        responses: { "200": paginatedResponse("DocumentSummary", "A page of Document summaries."), ...STANDARD_ERRORS },
      },
    },
    "/documents/{id}": {
      get: {
        summary: "Get a Document",
        description: `${scopeDescription("documents.read")} The full record, including \`content\`.`,
        tags: ["Documents"],
        "x-required-scope": "documents.read",
        parameters: [idParam("The Document id.")],
        responses: { "200": itemResponse(ref("Document"), "The Document."), "404": { description: "No Document with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/documents/{id}/versions": {
      get: {
        summary: "List a Document's versions",
        description: scopeDescription("documents.read"),
        tags: ["Documents"],
        "x-required-scope": "documents.read",
        parameters: [idParam("The Document id.")],
        responses: { "200": itemResponse({ type: "array", items: ref("DocumentVersion") }, "The Document's version history."), ...STANDARD_ERRORS },
      },
    },
    "/documents/{id}/versions/{version}": {
      get: {
        summary: "Get one Document version",
        description: scopeDescription("documents.read"),
        tags: ["Documents"],
        "x-required-scope": "documents.read",
        parameters: [idParam("The Document id."), { name: "version", in: "path", required: true, description: "The version number.", schema: { type: "integer" } }],
        responses: {
          "200": itemResponse(ref("DocumentVersion"), "The Document version."),
          "400": { description: "The version segment isn't a whole number.", content: ERROR_RESPONSE },
          "404": { description: "No such Document version.", content: ERROR_RESPONSE },
          ...STANDARD_ERRORS,
        },
      },
    },
    "/documents/{id}/download": {
      get: {
        summary: "Download a Document as plain text",
        description: `${scopeDescription("documents.read")} Returns JSON (\`{data: {id, title, text}}\`), not a raw file stream — this API never generates a PDF.`,
        tags: ["Documents"],
        "x-required-scope": "documents.read",
        parameters: [idParam("The Document id.")],
        responses: {
          "200": itemResponse({ type: "object", properties: { id: { type: "string" }, title: { type: "string" }, text: { type: "string" } } }, "The Document's plain-text export."),
          "404": { description: "No Document with that id.", content: ERROR_RESPONSE },
          ...STANDARD_ERRORS,
        },
      },
    },
    "/workflows": {
      get: {
        summary: "List Workflows",
        description: `${scopeDescription("workflow.read")} Never a way to execute a Workflow through this API.`,
        tags: ["Workflow"],
        "x-required-scope": "workflow.read",
        parameters: [PAGE_PARAM, PER_PAGE_PARAM],
        responses: { "200": paginatedResponse("Workflow", "A page of Workflows."), ...STANDARD_ERRORS },
      },
    },
    "/workflows/{id}": {
      get: {
        summary: "Get a Workflow",
        description: scopeDescription("workflow.read"),
        tags: ["Workflow"],
        "x-required-scope": "workflow.read",
        parameters: [idParam("The Workflow id.")],
        responses: { "200": itemResponse(ref("Workflow"), "The Workflow."), "404": { description: "No Workflow with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/workflows/{id}/simulations": {
      get: {
        summary: "List a Workflow's Simulation history",
        description: scopeDescription("workflow.read"),
        tags: ["Workflow"],
        "x-required-scope": "workflow.read",
        parameters: [idParam("The Workflow id.")],
        responses: { "200": itemResponse({ type: "array", items: ref("WorkflowSimulationRun") }, "The Workflow's Simulation run history."), ...STANDARD_ERRORS },
      },
    },
    "/workflow-templates": {
      get: {
        summary: "List Workflow Templates",
        description: `${scopeDescription("workflow.read")} Built-in Templates are global — not scoped per Workspace.`,
        tags: ["Workflow"],
        "x-required-scope": "workflow.read",
        responses: { "200": itemResponse({ type: "array", items: ref("WorkflowTemplate") }, "Every built-in Workflow Template."), ...STANDARD_ERRORS },
      },
    },
    "/workflow-templates/{id}": {
      get: {
        summary: "Get a Workflow Template",
        description: scopeDescription("workflow.read"),
        tags: ["Workflow"],
        "x-required-scope": "workflow.read",
        parameters: [idParam("The Workflow Template id.")],
        responses: { "200": itemResponse(ref("WorkflowTemplate"), "The Workflow Template."), "404": { description: "No Workflow Template with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/analytics/metrics": {
      get: {
        summary: "List raw Metric snapshots",
        description: scopeDescription("analytics.read"),
        tags: ["Analytics"],
        "x-required-scope": "analytics.read",
        parameters: [windowParam()],
        responses: { "200": itemResponse({ type: "array", items: ref("MetricSnapshot") }, "Every visible Metric snapshot for the requested window."), ...STANDARD_ERRORS },
      },
    },
    "/analytics/summary": {
      get: {
        summary: "Get the Analytics Dashboard summary",
        description: `${scopeDescription("analytics.read")} The same grouped-by-category + curated Overview shape ("KPI Cards") the internal Executive Dashboard reads.`,
        tags: ["Analytics"],
        "x-required-scope": "analytics.read",
        parameters: [windowParam()],
        responses: { "200": itemResponse(ref("AnalyticsDashboardData"), "The Analytics Dashboard summary."), ...STANDARD_ERRORS },
      },
    },
    "/analytics/executive-summary": {
      get: {
        summary: "Get the AI Executive Summary",
        description: scopeDescription("analytics.read"),
        tags: ["Analytics"],
        "x-required-scope": "analytics.read",
        parameters: [windowParam()],
        responses: {
          "200": itemResponse(ref("AnalyticsExecutiveSummary"), "The AI-generated narrative Executive Summary."),
          "400": { description: "Bloom AI declined to generate a summary.", content: ERROR_RESPONSE },
          ...STANDARD_ERRORS,
        },
      },
    },
    "/portal/users": {
      get: {
        summary: "List Client Portal Users",
        description: scopeDescription("portal.read"),
        tags: ["Portal"],
        "x-required-scope": "portal.read",
        parameters: [PAGE_PARAM, PER_PAGE_PARAM],
        responses: { "200": paginatedResponse("PortalUser", "A page of Client Portal accounts."), ...STANDARD_ERRORS },
      },
    },
    "/portal/users/{id}/timeline": {
      get: {
        summary: "Get a Portal User's Timeline",
        description: scopeDescription("portal.read"),
        tags: ["Portal"],
        "x-required-scope": "portal.read",
        parameters: [idParam("The Client Portal account id.")],
        responses: { "200": itemResponse({ type: "array", items: ref("TimelineEntry") }, "The account's Timeline feed."), "404": { description: "No Portal account with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/portal/users/{id}/checklist": {
      get: {
        summary: "Get a Portal User's Checklist",
        description: scopeDescription("portal.read"),
        tags: ["Portal"],
        "x-required-scope": "portal.read",
        parameters: [idParam("The Client Portal account id.")],
        responses: { "200": itemResponse({ type: "array", items: ref("ChecklistItem") }, "The account's client-visible Checklist items."), "404": { description: "No Portal account with that id.", content: ERROR_RESPONSE }, ...STANDARD_ERRORS },
      },
    },
    "/portal/messages": {
      get: {
        summary: "List Message threads",
        description: `${scopeDescription("portal.read")} Metadata only — subject, last message time, unread count. Never message bodies.`,
        tags: ["Portal"],
        "x-required-scope": "portal.read",
        parameters: [PAGE_PARAM, PER_PAGE_PARAM],
        responses: { "200": paginatedResponse("MessageThread", "A page of Message thread metadata."), ...STANDARD_ERRORS },
      },
    },
    "/portal/notifications": {
      get: {
        summary: "List Client Portal Notifications",
        description: scopeDescription("portal.read"),
        tags: ["Portal"],
        "x-required-scope": "portal.read",
        parameters: [{ name: "unread_only", in: "query", description: "Only unread Notifications.", schema: { type: "boolean", default: false } }, PAGE_PARAM, PER_PAGE_PARAM],
        responses: { "200": paginatedResponse("Notification", "A page of Client Portal Notifications."), ...STANDARD_ERRORS },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "bloom_sk_...",
        description: "An API Key's secret, issued once at creation or rotation via the Developer Console. Send as `Authorization: Bearer <secret>`.",
      },
      WebhookSignature: {
        type: "apiKey",
        in: "header",
        name: WEBHOOK_SIGNATURE_HEADER,
        description:
          'Every webhook request carries this header, shaped `t=<unix seconds>,v1=<hex HMAC-SHA256 digest>` — the digest of `"<t>.<raw JSON body>"`, keyed by the Webhook Endpoint\'s own secret (issued once at creation or rotation via the Developer Console). See docs/webhooks.md for verification examples in multiple languages.',
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", enum: ["unauthorized", "forbidden", "not_found", "invalid_request", "rate_limited", "internal_error"] },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      PaginationMeta: {
        type: "object",
        properties: { page: { type: "integer" }, perPage: { type: "integer" }, total: { type: "integer" }, totalPages: { type: "integer" } },
        required: ["page", "perPage", "total", "totalPages"],
      },
      Client: {
        type: "object",
        description: "Excludes every field types/client.ts marks internal-only (allergies, accessibility needs, do-not-call, surprise-event confidentiality, emergency contacts).",
        properties: {
          id: { type: "string" }, first_name: { type: "string" }, last_name: { type: "string" }, email: { type: "string" }, phone: { type: ["string", "null"] },
          instagram: { type: ["string", "null"] }, preferred_contact_method: { type: "string" }, partner_name: { type: ["string", "null"] }, relationship_status: { type: ["string", "null"] },
          address: { type: ["string", "null"] }, city: { type: ["string", "null"] }, state: { type: ["string", "null"] }, zip_code: { type: ["string", "null"] }, source: { type: ["string", "null"] },
          tags: { type: "array", items: { type: "string" } }, status: { type: "string" }, is_returning: { type: "boolean" }, is_vip: { type: "boolean" }, wedding_date: { type: ["string", "null"] },
          created_at: { type: "string" }, updated_at: { type: "string" }, archived_at: { type: ["string", "null"] },
        },
      },
      Event: {
        type: "object",
        description: "Excludes internal_summary, confidentiality_notes, and surprise_event.",
        properties: {
          id: { type: "string" }, client_id: { type: "string" }, title: { type: "string" }, event_type: { type: "string" }, status: { type: "string" }, lifecycle_stage: { type: "string" },
          event_date: { type: ["string", "null"] }, start_time: { type: ["string", "null"] }, end_time: { type: ["string", "null"] }, timezone: { type: ["string", "null"] },
          location_name: { type: ["string", "null"] }, address: { type: ["string", "null"] }, city: { type: ["string", "null"] }, state: { type: ["string", "null"] }, zip_code: { type: ["string", "null"] },
          guest_count: { type: ["integer", "null"] }, budget_min: { type: ["number", "null"] }, budget_max: { type: ["number", "null"] }, package_name: { type: ["string", "null"] },
          theme: { type: ["string", "null"] }, color_palette: { type: ["string", "null"] }, priority: { type: "string" },
          created_at: { type: "string" }, updated_at: { type: "string" }, archived_at: { type: ["string", "null"] }, completed_at: { type: ["string", "null"] }, cancelled_at: { type: ["string", "null"] },
        },
      },
      Proposal: { type: "object", description: "The internal Proposal record, unchanged.", properties: { id: { type: "string" }, event_id: { type: "string" }, workspace_id: { type: "string" }, status: { type: "string" }, created_at: { type: "string" } } },
      Invoice: { type: "object", description: "The internal Invoice record, unchanged.", properties: { id: { type: "string" }, client_id: { type: "string" }, event_id: { type: ["string", "null"] }, status: { type: "string" }, total_minor: { type: "integer" }, balance_minor: { type: "integer" }, currency: { type: "string" }, issue_date: { type: "string" }, due_date: { type: ["string", "null"] } } },
      Receipt: { type: "object", properties: { id: { type: "string" }, invoice_id: { type: "string" }, client_id: { type: "string" }, title: { type: "string" }, generated_at: { type: "string" } } },
      Transaction: { type: "object", description: "The internal Payment record, unchanged.", properties: { id: { type: "string" }, invoice_id: { type: "string" }, payment_type: { type: "string" }, status: { type: "string" }, amount_minor: { type: "integer" }, currency: { type: "string" }, transaction_date: { type: "string" } } },
      Template: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, documentTypeId: { type: "string" }, updatedAt: { type: "string" } } },
      DocumentSummary: { type: "object", properties: { id: { type: "string" }, templateId: { type: "string" }, documentTypeId: { type: "string" }, status: { type: "string" }, metadata: { type: "object" }, currentVersion: { type: "integer" }, createdAt: { type: "string" }, updatedAt: { type: "string" } } },
      Document: { type: "object", properties: { id: { type: "string" }, templateId: { type: "string" }, documentTypeId: { type: "string" }, status: { type: "string" }, metadata: { type: "object" }, content: { type: "array", items: { type: "object" } }, currentVersion: { type: "integer" }, createdAt: { type: "string" }, updatedAt: { type: "string" } } },
      DocumentVersion: { type: "object", properties: { documentId: { type: "string" }, version: { type: "integer" }, content: { type: "array", items: { type: "object" } }, createdAt: { type: "string" } } },
      Workflow: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, status: { type: "string" }, workspaceId: { type: "string" }, updatedAt: { type: "string" } } },
      WorkflowSimulationRun: { type: "object", properties: { id: { type: "string" }, workflow_id: { type: "string" }, path_count: { type: "integer" }, issue_count: { type: "integer" }, run_at: { type: "string" } } },
      WorkflowTemplate: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" } } },
      MetricSnapshot: {
        type: "object",
        properties: {
          metric: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, category: { type: "string" }, unit: { type: "string" }, icon: { type: "string" } } },
          result: { type: "object", properties: { value: { type: "number" }, previousValue: { type: ["number", "null"] }, changePercent: { type: ["number", "null"] }, trend: { type: "string" }, series: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } } } } } },
        },
      },
      AnalyticsDashboardData: { type: "object", properties: { windowKey: { type: "string" }, byCategory: { type: "object" }, overview: { type: "array", items: ref("MetricSnapshot") } } },
      AnalyticsExecutiveSummary: { type: "object", properties: { headline: { type: "string" }, highlights: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } } } },
      PortalUser: { type: "object", description: "Excludes auth_user_id (an internal Supabase Auth identifier).", properties: { id: { type: "string" }, client_id: { type: "string" }, email: { type: "string" }, status: { type: "string" }, invited_by: { type: "string" }, accepted_at: { type: ["string", "null"] }, suspended_at: { type: ["string", "null"] }, revoked_at: { type: ["string", "null"] }, last_access_at: { type: ["string", "null"] }, created_at: { type: "string" }, updated_at: { type: "string" } } },
      TimelineEntry: { type: "object", properties: { id: { type: "string" }, kind: { type: "string" }, title: { type: "string" }, occurred_at: { type: "string" } } },
      ChecklistItem: { type: "object", properties: { id: { type: "string" }, event_id: { type: "string" }, title: { type: "string" }, status: { type: "string" }, due_date: { type: ["string", "null"] }, completed_at: { type: ["string", "null"] } } },
      MessageThread: { type: "object", properties: { id: { type: "string" }, workspace_id: { type: "string" }, client_account_id: { type: "string" }, subject: { type: "string" }, last_message_at: { type: "string" }, unread_count: { type: "integer" } } },
      Notification: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, body: { type: "string" }, read_at: { type: ["string", "null"] }, created_at: { type: "string" } } },
    },
  },
};
