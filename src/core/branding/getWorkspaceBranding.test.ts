import { afterEach, describe, expect, it } from "vitest";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import { applyBrandingToDocument } from "@/core/branding/applyBrandingToDocument";
import { getSettingsManager } from "@/core/settings/manager";
import { resetSettingsStore } from "@/lib/data/core/settings/mockRepository";

const WORKSPACE_ID = "ws_branding_test";

afterEach(() => {
  resetSettingsStore();
});

describe("getWorkspaceBranding", () => {
  it("resolves every field from the registered Settings defaults when nothing is overridden", async () => {
    const branding = await getWorkspaceBranding(WORKSPACE_ID);
    expect(branding.workspaceId).toBe(WORKSPACE_ID);
    expect(branding.primaryColor).toBe("#b68235");
    expect(branding.secondaryColor).toBe("#2f2a24");
    expect(branding.typography).toBe("serif-classic");
    expect(branding.logoUrl).toBe("/brand/amore-bloom-app-logo.png");
    expect(branding.footerText).toBe("");
    expect(branding.legalFooter).toBe("");
    expect(branding.termsUrl).toBe("");
  });

  it("falls back to the display name for legalBusinessName when unset", async () => {
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "workspace.name", "Amoré Bloom Studio", "tester");
    const branding = await getWorkspaceBranding(WORKSPACE_ID);
    expect(branding.brandName).toBe("Amoré Bloom Studio");
    expect(branding.legalBusinessName).toBe("Amoré Bloom Studio");
  });

  it("reads a real per-workspace override instead of the default", async () => {
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.secondary-color", "#123456", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "workspace.legal-business-name", "Amoré Bloom LLC", "tester");
    const branding = await getWorkspaceBranding(WORKSPACE_ID);
    expect(branding.secondaryColor).toBe("#123456");
    expect(branding.legalBusinessName).toBe("Amoré Bloom LLC");
  });

  it("treats a blank logo URL override as unset (null)", async () => {
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.logo-url", "   ", "tester");
    const branding = await getWorkspaceBranding(WORKSPACE_ID);
    expect(branding.logoUrl).toBeNull();
  });
});

describe("applyBrandingToDocument", () => {
  it("builds footer lines only from fields that are actually set", async () => {
    const branding = await getWorkspaceBranding(WORKSPACE_ID);
    const theme = applyBrandingToDocument(branding);
    expect(theme.footerLines).toEqual([]);
    expect(theme.socialLine).toBeNull();
    expect(theme.legalLine).toBeNull();
  });

  it("assembles contact, address, social, and legal lines when set", async () => {
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.footer-text", "Thank you for choosing us.", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.contact-email", "hello@amorebloom.test", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.contact-phone", "+1 555 0100", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "workspace.business-address", "123 Bloom St", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.social-website", "amorebloom.test", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.legal-footer", "© 2026 Amoré Bloom", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "workspace.tax-id", "12-3456789", "tester");
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.terms-url", "amorebloom.test/terms", "tester");

    const branding = await getWorkspaceBranding(WORKSPACE_ID);
    const theme = applyBrandingToDocument(branding);

    expect(theme.footerLines).toEqual(["Thank you for choosing us.", "hello@amorebloom.test · +1 555 0100", "123 Bloom St"]);
    expect(theme.socialLine).toBe("amorebloom.test");
    expect(theme.legalLine).toBe("© 2026 Amoré Bloom — Tax ID: 12-3456789 — Terms: amorebloom.test/terms");
  });

  it("uses the legal business name when set, else the brand name", async () => {
    const defaultTheme = applyBrandingToDocument(await getWorkspaceBranding(WORKSPACE_ID));
    expect(defaultTheme.brandName).toBe("BloomOS");

    await getSettingsManager().setSettingValue(WORKSPACE_ID, "workspace.legal-business-name", "Amoré Bloom LLC", "tester");
    const namedTheme = applyBrandingToDocument(await getWorkspaceBranding(WORKSPACE_ID));
    expect(namedTheme.brandName).toBe("Amoré Bloom LLC");
  });

  it("picks the correct font stack per typography choice", async () => {
    await getSettingsManager().setSettingValue(WORKSPACE_ID, "branding.typography", "sans-modern", "tester");
    const theme = applyBrandingToDocument(await getWorkspaceBranding(WORKSPACE_ID));
    expect(theme.headingFontStack).toContain("Helvetica");
  });
});
