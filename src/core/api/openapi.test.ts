import { describe, expect, it } from "vitest";
import { OPENAPI_DOCUMENT } from "@/core/api/openapi";
import { API_SCOPES } from "@/types/apiScope";
import { WEBHOOK_EVENT_TYPES } from "@/types/webhookEvent";

describe("OPENAPI_DOCUMENT", () => {
  it("declares OpenAPI 3.1 with a title, version, and description", () => {
    expect(OPENAPI_DOCUMENT.openapi).toBe("3.1.0");
    expect(OPENAPI_DOCUMENT.info.title).toBeTruthy();
    expect(OPENAPI_DOCUMENT.info.version).toBeTruthy();
    expect(OPENAPI_DOCUMENT.info.description.length).toBeGreaterThan(20);
  });

  it("declares the Bearer API Key security scheme", () => {
    const scheme = OPENAPI_DOCUMENT.components.securitySchemes.ApiKeyAuth as { type: string; scheme: string };
    expect(scheme.type).toBe("http");
    expect(scheme.scheme).toBe("bearer");
  });

  it("lists every endpoint this checkpoint actually built — one path per CRM/Finance/Documents/Workflow/Analytics/Portal route", () => {
    const paths = Object.keys(OPENAPI_DOCUMENT.paths);
    expect(paths).toContain("/clients");
    expect(paths).toContain("/invoices");
    expect(paths).toContain("/templates");
    expect(paths).toContain("/workflows");
    expect(paths).toContain("/analytics/summary");
    expect(paths).toContain("/portal/users");
    expect(paths.length).toBeGreaterThanOrEqual(30);
  });

  it("every operation declares a real ApiScope in x-required-scope, and that scope's own description in its own description text", () => {
    for (const [path, item] of Object.entries(OPENAPI_DOCUMENT.paths)) {
      const scope = item.get["x-required-scope"];
      expect(API_SCOPES, `${path} declares an unknown scope`).toContain(scope);
      expect(item.get.description, `${path} description should mention its own required scope`).toContain(scope);
    }
  });

  it("every operation declares a 200 response and the standard 401/403/500 error responses", () => {
    for (const [path, item] of Object.entries(OPENAPI_DOCUMENT.paths)) {
      expect(item.get.responses, path).toHaveProperty("200");
      expect(item.get.responses, path).toHaveProperty("401");
      expect(item.get.responses, path).toHaveProperty("403");
      expect(item.get.responses, path).toHaveProperty("500");
    }
  });

  it("every path parameter (e.g. {id}) has a matching declared parameter with in: 'path' and required: true", () => {
    for (const [path, item] of Object.entries(OPENAPI_DOCUMENT.paths)) {
      const pathParamNames = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const name of pathParamNames) {
        const declared = item.get.parameters?.find((p) => p.name === name);
        expect(declared, `${path} is missing a declared parameter for {${name}}`).toBeTruthy();
        expect(declared?.in).toBe("path");
        expect(declared?.required).toBe(true);
      }
    }
  });

  it("every schema referenced via $ref in a response actually exists in components.schemas", () => {
    const schemaNames = new Set(Object.keys(OPENAPI_DOCUMENT.components.schemas));
    const refs = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(collect);
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
          if (key === "$ref" && typeof nested === "string") refs.add(nested.replace("#/components/schemas/", ""));
          else collect(nested);
        }
      }
    };
    collect(OPENAPI_DOCUMENT.paths);
    expect(refs.size).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(schemaNames, `$ref to an undeclared schema: ${ref}`).toContain(ref);
    }
  });

  it("declares the Webhook Signature security scheme", () => {
    const scheme = OPENAPI_DOCUMENT.components.securitySchemes.WebhookSignature as { type: string; in: string; name: string };
    expect(scheme.type).toBe("apiKey");
    expect(scheme.in).toBe("header");
    expect(scheme.name).toBe("x-bloomos-signature");
  });

  it("declares one webhooks entry per catalog event, each a POST with a requestBody, an example, and a 200 response", () => {
    const webhookNames = Object.keys(OPENAPI_DOCUMENT.webhooks);
    expect(webhookNames.sort()).toEqual([...WEBHOOK_EVENT_TYPES].sort());

    for (const [type, item] of Object.entries(OPENAPI_DOCUMENT.webhooks)) {
      expect(item.post.requestBody.required, type).toBe(true);
      const body = item.post.requestBody.content["application/json"];
      expect(body.schema, type).toBeTruthy();
      expect(body.example.event, type).toBe(type);
      expect(item.post.responses, type).toHaveProperty("200");
    }
  });

  it("every webhooks payload schema is the exact object the Webhook Event Registry itself declares — never a hand-duplicated copy", async () => {
    const { listWebhookEvents } = await import("@/core/webhooks/eventRegistry");
    for (const definition of listWebhookEvents()) {
      const schema = OPENAPI_DOCUMENT.webhooks[definition.type].post.requestBody.content["application/json"].schema as { properties: { payload: unknown } };
      expect(schema.properties.payload).toBe(definition.payloadSchema);
    }
  });
});
