import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"brand"` Merge Field domain (v2 Checkpoint 44) — the unified
 * `WorkspaceBranding` read (`core/branding/getWorkspaceBranding.ts`, this
 * checkpoint's own Step 1), exposed as Merge Fields so any Template can
 * reference the workspace's own logo/colors/footer without a Template
 * author needing to know the Settings Platform exists. Distinct from the
 * pre-existing `"settings"` domain's own narrower `brand_color` field
 * (kept as-is for compatibility) — this domain is the full, consolidated
 * set.
 */
export const brandMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "brand_name", label: "Brand Name", description: "The Workspace's own legal or display name.", domain: "brand", valueType: "string", required: false },
  { key: "brand_logo_url", label: "Brand Logo URL", description: "The Workspace's own configured logo.", domain: "brand", valueType: "string", required: false },
  { key: "brand_primary_color", label: "Brand Primary Color", description: "The Workspace's own configured primary color.", domain: "brand", valueType: "string", required: false },
  { key: "brand_secondary_color", label: "Brand Secondary Color", description: "The Workspace's own configured secondary color.", domain: "brand", valueType: "string", required: false },
  { key: "brand_footer_text", label: "Brand Footer Text", description: "The Workspace's own configured document footer.", domain: "brand", valueType: "string", required: false },
  { key: "brand_legal_footer", label: "Brand Legal Footer", description: "The Workspace's own configured legal/copyright footer.", domain: "brand", valueType: "string", required: false },
  { key: "brand_website", label: "Brand Website", description: "The Workspace's own configured website.", domain: "brand", valueType: "string", required: false },
];

export function registerBrandMergeFields(): void {
  for (const definition of brandMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("brand_name", async (context) => {
    const branding = await getWorkspaceBranding(context.workspaceId);
    return branding.legalBusinessName || branding.brandName;
  });

  registerMergeResolver("brand_logo_url", async (context) => {
    const branding = await getWorkspaceBranding(context.workspaceId);
    return branding.logoUrl;
  });

  registerMergeResolver("brand_primary_color", async (context) => {
    const branding = await getWorkspaceBranding(context.workspaceId);
    return branding.primaryColor;
  });

  registerMergeResolver("brand_secondary_color", async (context) => {
    const branding = await getWorkspaceBranding(context.workspaceId);
    return branding.secondaryColor;
  });

  registerMergeResolver("brand_footer_text", async (context) => {
    const branding = await getWorkspaceBranding(context.workspaceId);
    return branding.footerText || null;
  });

  registerMergeResolver("brand_legal_footer", async (context) => {
    const branding = await getWorkspaceBranding(context.workspaceId);
    return branding.legalFooter || null;
  });

  registerMergeResolver("brand_website", async (context) => {
    const branding = await getWorkspaceBranding(context.workspaceId);
    return branding.socialWebsite || null;
  });
}
