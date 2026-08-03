import type { SettingDefinition, SettingsSectionDefinition } from "@/types/settings";

export const brandingSection: SettingsSectionDefinition = {
  id: "branding",
  label: "Branding",
  description: "How this Workspace presents itself — logo and accent color.",
  icon: "Palette",
  order: 20,
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
};

export const logoUrlSetting: SettingDefinition = {
  id: "branding.logo-url",
  sectionId: "branding",
  category: null,
  label: "Logo URL",
  description: "Shown in the sidebar and on any client-facing document. Leave blank to use the default BloomOS mark.",
  keywords: ["logo", "image", "brand mark"],
  type: "string",
  defaultValue: "/brand/amore-bloom-app-logo.png",
  required: false,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

export const brandColorSetting: SettingDefinition = {
  id: "branding.brand-color",
  sectionId: "branding",
  category: null,
  label: "Brand Color",
  description: "The accent color used across the interface for this Workspace.",
  keywords: ["color", "accent", "brand color", "theme"],
  type: "color",
  defaultValue: "#b68235",
  required: true,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

/** Checkpoint 19, Step 10 — consumed by `getLuxuryBranding.ts` to theme the Luxury Dashboard shell (sidebar tagline + each experience's own inspirational card). The spec's own broader branding list (business name, background tone, font preference, owner signature) is declared as scope for a future pass — `workspace.name`/`workspaceDisplayName` already cover "business name," and the rest have no real consumer yet; see docs/luxury-design-system.md's Known limitations. */
export const taglineSetting: SettingDefinition = {
  id: "branding.tagline",
  sectionId: "branding",
  category: null,
  label: "Tagline",
  description: "Shown beneath the logo in the sidebar.",
  keywords: ["tagline", "slogan", "sidebar"],
  type: "string",
  defaultValue: "Luxury Proposal & Event Studio",
  required: false,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

export const ownerInspirationalMessageSetting: SettingDefinition = {
  id: "branding.owner-inspirational-message",
  sectionId: "branding",
  category: null,
  label: "Owner Dashboard message",
  description: "The short inspirational line shown in the Owner Dashboard's sidebar.",
  keywords: ["owner", "dashboard", "message", "inspiration"],
  type: "string",
  defaultValue: "You're building unforgettable moments.",
  required: false,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

export const teamInspirationalMessageSetting: SettingDefinition = {
  id: "branding.team-inspirational-message",
  sectionId: "branding",
  category: null,
  label: "Team Dashboard message",
  description: "The short inspirational line shown in the Team Dashboard's sidebar.",
  keywords: ["team", "dashboard", "message", "inspiration"],
  type: "string",
  defaultValue: "We create the moments they'll never forget.",
  required: false,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

export const clientWelcomeMessageSetting: SettingDefinition = {
  id: "branding.client-welcome-message",
  sectionId: "branding",
  category: null,
  label: "Client Portal welcome message",
  description: "Shown at the bottom of the Client Dashboard.",
  keywords: ["client", "portal", "welcome", "message"],
  type: "string",
  defaultValue: "Every detail is planned with love, so you can live the moment.",
  required: false,
  visibility: "visible",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  version: "v1",
};

function makeBrandingSetting(overrides: Pick<SettingDefinition, "id" | "label" | "description" | "keywords" | "type" | "defaultValue" | "required" | "options">): SettingDefinition {
  return {
    sectionId: "branding",
    category: null,
    visibility: "visible",
    requiredPermissions: ["workspace.manage"],
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    ...overrides,
  };
}

/**
 * v2 Checkpoint 44 — the fields `docs/v2-checkpoint-43.md`'s audit found
 * genuinely missing from Checkpoint 19's original branding set: a
 * secondary color, a typography choice, a document footer, social links,
 * and legal/terms/privacy links. These, together with the 6 settings
 * above, are every field `getWorkspaceBranding()`
 * (`core/branding/getWorkspaceBranding.ts`) reads — the single, unified
 * `WorkspaceBranding` this checkpoint introduces, replacing the
 * fragmented "each consumer re-fetches its own subset" pattern the audit
 * found (`getLuxuryBranding.ts` and `getClientDashboardData.ts` each
 * independently calling `getResolvedSettingValue()`).
 */
export const secondaryColorSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.secondary-color",
  label: "Secondary Color",
  description: "A supporting accent color for documents and client-facing surfaces — used alongside the primary Brand Color.",
  keywords: ["color", "secondary", "accent"],
  type: "color",
  defaultValue: "#2f2a24",
  required: false,
});

export const typographySetting: SettingDefinition = makeBrandingSetting({
  id: "branding.typography",
  label: "Document Typography",
  description: "The typeface pairing used when rendering a client-facing document or PDF.",
  keywords: ["font", "typography", "typeface"],
  type: "select",
  options: [
    { label: "Serif — Classic", value: "serif-classic" },
    { label: "Sans — Modern", value: "sans-modern" },
    { label: "Serif — Editorial", value: "serif-editorial" },
  ],
  defaultValue: "serif-classic",
  required: false,
});

export const footerTextSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.footer-text",
  label: "Document Footer",
  description: "Shown at the bottom of every generated document and PDF, beneath the legal footer.",
  keywords: ["footer", "document", "pdf"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const socialInstagramSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.social-instagram",
  label: "Instagram",
  description: "Shown on documents and the Client Portal when set.",
  keywords: ["social", "instagram"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const socialFacebookSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.social-facebook",
  label: "Facebook",
  description: "Shown on documents and the Client Portal when set.",
  keywords: ["social", "facebook"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const socialWebsiteSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.social-website",
  label: "Website",
  description: "Shown on documents and the Client Portal when set.",
  keywords: ["social", "website", "url"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const contactEmailSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.contact-email",
  label: "Contact Email",
  description: "Shown on documents as the client's point of contact.",
  keywords: ["contact", "email"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const contactPhoneSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.contact-phone",
  label: "Contact Phone",
  description: "Shown on documents as the client's point of contact.",
  keywords: ["contact", "phone"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const legalFooterSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.legal-footer",
  label: "Legal Footer",
  description: "A copyright or legal notice shown at the bottom of every generated document and PDF.",
  keywords: ["legal", "copyright", "footer"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const termsUrlSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.terms-url",
  label: "Terms of Service URL",
  description: "Linked from documents and the Client Portal when set.",
  keywords: ["terms", "legal", "link"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const privacyUrlSetting: SettingDefinition = makeBrandingSetting({
  id: "branding.privacy-url",
  label: "Privacy Policy URL",
  description: "Linked from documents and the Client Portal when set.",
  keywords: ["privacy", "legal", "link"],
  type: "string",
  defaultValue: "",
  required: false,
});

export const brandingSettings: SettingDefinition[] = [
  logoUrlSetting,
  brandColorSetting,
  taglineSetting,
  ownerInspirationalMessageSetting,
  teamInspirationalMessageSetting,
  clientWelcomeMessageSetting,
  secondaryColorSetting,
  typographySetting,
  footerTextSetting,
  socialInstagramSetting,
  socialFacebookSetting,
  socialWebsiteSetting,
  contactEmailSetting,
  contactPhoneSetting,
  legalFooterSetting,
  termsUrlSetting,
  privacyUrlSetting,
];
