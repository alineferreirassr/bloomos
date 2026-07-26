/** Distinguishes the two kinds of row a ServiceCapabilityRequirement can be — merged from what were originally two byte-for-byte identical tables (ServiceSkillRequirement/ServiceEquipmentRequirement) during the pre-migration domain review, once the only real difference turned out to be this one label. */
export const SERVICE_CAPABILITY_TYPES = ["skill", "equipment"] as const;

export type ServiceCapabilityType = (typeof SERVICE_CAPABILITY_TYPES)[number];

export const SERVICE_CAPABILITY_TYPE_LABELS: Record<ServiceCapabilityType, string> = {
  skill: "Skill",
  equipment: "Equipment",
};
