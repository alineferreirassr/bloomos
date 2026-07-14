export const CONTACT_METHODS = ["email", "phone", "text", "whatsapp", "instagram"] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  email: "Email",
  phone: "Phone",
  text: "Text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};
