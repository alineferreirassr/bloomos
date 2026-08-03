import { getSettingsManager } from "@/core/settings/manager";
import { registerSettingsSections } from "@/modules/settings/registerSettingsSections";
import { DOCUMENT_TYPOGRAPHY_OPTIONS, type DocumentTypography, type WorkspaceBranding } from "@/types/branding";

registerSettingsSections();

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asTypography(value: unknown): DocumentTypography {
  return typeof value === "string" && (DOCUMENT_TYPOGRAPHY_OPTIONS as readonly string[]).includes(value) ? (value as DocumentTypography) : "serif-classic";
}

/**
 * v2 Checkpoint 44 — the single, unified branding read. Every field comes
 * from the Settings Platform (Checkpoint 11) via `getResolvedSettingValue`
 * — a stored per-workspace override if one exists, else the Setting's own
 * registered default — never a second storage location. This replaces the
 * fragmented pattern the Step 0 audit found: `getLuxuryBranding.ts` and
 * `getClientDashboardData.ts` each independently re-fetched their own
 * subset of these same settings. Both now call this function instead (see
 * their own updated doc comments).
 *
 * Takes a `workspaceId` directly rather than resolving a session, since
 * this is called from server-side rendering contexts (PDF generation,
 * merge-field resolution, email templates) that have a workspace but not
 * necessarily an active member session.
 */
export async function getWorkspaceBranding(workspaceId: string): Promise<WorkspaceBranding> {
  const manager = getSettingsManager();
  const [
    name,
    legalBusinessName,
    logoUrl,
    brandColor,
    secondaryColor,
    typography,
    tagline,
    footerText,
    legalFooter,
    businessAddress,
    taxId,
    contactEmail,
    contactPhone,
    socialInstagram,
    socialFacebook,
    socialWebsite,
    termsUrl,
    privacyUrl,
  ] = await Promise.all([
    manager.getResolvedSettingValue(workspaceId, "workspace.name"),
    manager.getResolvedSettingValue(workspaceId, "workspace.legal-business-name"),
    manager.getResolvedSettingValue(workspaceId, "branding.logo-url"),
    manager.getResolvedSettingValue(workspaceId, "branding.brand-color"),
    manager.getResolvedSettingValue(workspaceId, "branding.secondary-color"),
    manager.getResolvedSettingValue(workspaceId, "branding.typography"),
    manager.getResolvedSettingValue(workspaceId, "branding.tagline"),
    manager.getResolvedSettingValue(workspaceId, "branding.footer-text"),
    manager.getResolvedSettingValue(workspaceId, "branding.legal-footer"),
    manager.getResolvedSettingValue(workspaceId, "workspace.business-address"),
    manager.getResolvedSettingValue(workspaceId, "workspace.tax-id"),
    manager.getResolvedSettingValue(workspaceId, "branding.contact-email"),
    manager.getResolvedSettingValue(workspaceId, "branding.contact-phone"),
    manager.getResolvedSettingValue(workspaceId, "branding.social-instagram"),
    manager.getResolvedSettingValue(workspaceId, "branding.social-facebook"),
    manager.getResolvedSettingValue(workspaceId, "branding.social-website"),
    manager.getResolvedSettingValue(workspaceId, "branding.terms-url"),
    manager.getResolvedSettingValue(workspaceId, "branding.privacy-url"),
  ]);

  const brandName = asString(name, "BloomOS");

  return {
    workspaceId,
    brandName,
    legalBusinessName: asString(legalBusinessName, brandName),
    logoUrl: typeof logoUrl === "string" && logoUrl.trim().length > 0 ? logoUrl : null,
    primaryColor: asString(brandColor, "#b68235"),
    secondaryColor: asString(secondaryColor, "#2f2a24"),
    typography: asTypography(typography),
    tagline: asString(tagline),
    footerText: asString(footerText),
    legalFooter: asString(legalFooter),
    businessAddress: asString(businessAddress),
    taxId: asString(taxId),
    contactEmail: asString(contactEmail),
    contactPhone: asString(contactPhone),
    socialInstagram: asString(socialInstagram),
    socialFacebook: asString(socialFacebook),
    socialWebsite: asString(socialWebsite),
    termsUrl: asString(termsUrl),
    privacyUrl: asString(privacyUrl),
  };
}
