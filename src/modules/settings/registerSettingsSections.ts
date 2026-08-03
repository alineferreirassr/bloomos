import { registerSetting } from "@/core/settings/registry";
import { registerSettingsSection } from "@/core/settings/sectionRegistry";
import { generalSection, generalSettings } from "@/modules/settings/sections/generalSection";
import { workspaceSection, workspaceSettings } from "@/modules/settings/sections/workspaceSection";
import { brandingSection, brandingSettings } from "@/modules/settings/sections/brandingSection";
import { aiSection, aiSettings } from "@/modules/settings/sections/aiSection";
import { skillsSection, skillsSettings } from "@/modules/settings/sections/skillsSection";
import { memorySection, memorySettings } from "@/modules/settings/sections/memorySection";
import { automationSection, automationSettings } from "@/modules/settings/sections/automationSection";
import { workflowSection, workflowSettings } from "@/modules/settings/sections/workflowSection";
import { crmSection, crmSettings } from "@/modules/settings/sections/crmSection";
import { financeSection, financeSettings } from "@/modules/settings/sections/financeSection";
import { notificationsSection, notificationsSettings } from "@/modules/settings/sections/notificationsSection";
import { securitySection, securitySettings } from "@/modules/settings/sections/securitySection";
import { developerSection, developerSettings } from "@/modules/settings/sections/developerSection";
import { aboutSection, aboutSettings } from "@/modules/settings/sections/aboutSection";

let registered = false;

const sections = [
  generalSection,
  workspaceSection,
  brandingSection,
  aiSection,
  skillsSection,
  memorySection,
  automationSection,
  workflowSection,
  crmSection,
  financeSection,
  notificationsSection,
  securitySection,
  developerSection,
  aboutSection,
];

const settings = [
  ...generalSettings,
  ...workspaceSettings,
  ...brandingSettings,
  ...aiSettings,
  ...skillsSettings,
  ...memorySettings,
  ...automationSettings,
  ...workflowSettings,
  ...crmSettings,
  ...financeSettings,
  ...notificationsSettings,
  ...securitySettings,
  ...developerSettings,
  ...aboutSettings,
];

/**
 * Registers all 14 Step 3 Sections and every Setting each module contributes.
 * Idempotent, the same module-level guard `registerWorkflowNodes()` already
 * uses. Per Step 20's own Developer Experience guarantee, a future module
 * needs only its own section file (definition + settings) plus one import
 * and one array entry here — the Settings UI itself never changes.
 */
export function registerSettingsSections(): void {
  if (registered) return;
  for (const section of sections) {
    registerSettingsSection(section);
  }
  for (const setting of settings) {
    registerSetting(setting);
  }
  registered = true;
}

/** Test-only: clears the idempotency guard so a test that also resets the underlying registries (`resetSettingsRegistry`/`resetSettingsSectionRegistry`) can call `registerSettingsSections()` again and see it actually re-populate. */
export function resetSettingsSectionsRegistration(): void {
  registered = false;
}
