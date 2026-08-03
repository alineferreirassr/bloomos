/**
 * v2 Checkpoint 44 — the single, unified `WorkspaceBranding` shape this
 * checkpoint's own audit found missing. Every field here maps to exactly
 * one Settings Platform (Checkpoint 11) `SettingDefinition` — this type
 * introduces no new storage, just a consolidated read over settings that
 * previously lived scattered across `getLuxuryBranding.ts` and
 * `getClientDashboardData.ts`, each independently re-fetching its own
 * subset. See `core/branding/getWorkspaceBranding.ts`.
 */
export const DOCUMENT_TYPOGRAPHY_OPTIONS = ["serif-classic", "sans-modern", "serif-editorial"] as const;
export type DocumentTypography = (typeof DOCUMENT_TYPOGRAPHY_OPTIONS)[number];

export interface WorkspaceBranding {
  workspaceId: string;
  brandName: string;
  legalBusinessName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  typography: DocumentTypography;
  tagline: string;
  footerText: string;
  legalFooter: string;
  businessAddress: string;
  taxId: string;
  contactEmail: string;
  contactPhone: string;
  socialInstagram: string;
  socialFacebook: string;
  socialWebsite: string;
  termsUrl: string;
  privacyUrl: string;
}
