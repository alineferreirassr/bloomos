import type { DocumentTypography, WorkspaceBranding } from "@/types/branding";

/** Font stacks per `DocumentTypography` choice — web-safe only, no external font loading (documents/PDFs must render without a network fetch). */
const TYPOGRAPHY_FONT_STACKS: Record<DocumentTypography, { heading: string; body: string }> = {
  "serif-classic": { heading: "Georgia, 'Times New Roman', serif", body: "Georgia, 'Times New Roman', serif" },
  "sans-modern": { heading: "'Helvetica Neue', Arial, sans-serif", body: "'Helvetica Neue', Arial, sans-serif" },
  "serif-editorial": { heading: "'Times New Roman', Georgia, serif", body: "Arial, 'Helvetica Neue', sans-serif" },
};

export interface DocumentBrandTheme {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  headingFontStack: string;
  bodyFontStack: string;
  footerLines: string[];
  socialLine: string | null;
  legalLine: string | null;
}

/**
 * v2 Checkpoint 44 — the one function every document/PDF renderer,
 * merge-field resolver, and client-facing surface calls to theme its
 * output from a `WorkspaceBranding` read. Never a second, independent
 * "apply branding" implementation — the Step 0 audit found this exact
 * duplication risk across `settingsMergeFields.ts`, the per-template
 * footer content types, and `getLuxuryBranding.ts`; this function is the
 * single seam those (and the new PDF renderer) all compose through.
 *
 * Deliberately produces a flat, presentation-ready theme rather than
 * handing back the raw `WorkspaceBranding` — a renderer needs "the footer
 * text to print," not "go figure out which of 6 fields make up a footer."
 */
export function applyBrandingToDocument(branding: WorkspaceBranding): DocumentBrandTheme {
  const fontStack = TYPOGRAPHY_FONT_STACKS[branding.typography];

  const footerLines: string[] = [];
  if (branding.footerText) footerLines.push(branding.footerText);
  const contactParts = [branding.contactEmail, branding.contactPhone].filter((part) => part.length > 0);
  if (contactParts.length > 0) footerLines.push(contactParts.join(" · "));
  if (branding.businessAddress) footerLines.push(branding.businessAddress);

  const socialParts = [branding.socialWebsite, branding.socialInstagram, branding.socialFacebook].filter((part) => part.length > 0);
  const socialLine = socialParts.length > 0 ? socialParts.join(" · ") : null;

  const legalParts: string[] = [];
  if (branding.legalFooter) legalParts.push(branding.legalFooter);
  if (branding.taxId) legalParts.push(`Tax ID: ${branding.taxId}`);
  const linkParts = [branding.termsUrl ? `Terms: ${branding.termsUrl}` : null, branding.privacyUrl ? `Privacy: ${branding.privacyUrl}` : null].filter((part): part is string => part !== null);
  if (linkParts.length > 0) legalParts.push(linkParts.join(" · "));
  const legalLine = legalParts.length > 0 ? legalParts.join(" — ") : null;

  return {
    brandName: branding.legalBusinessName || branding.brandName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    headingFontStack: fontStack.heading,
    bodyFontStack: fontStack.body,
    footerLines,
    socialLine,
    legalLine,
  };
}
