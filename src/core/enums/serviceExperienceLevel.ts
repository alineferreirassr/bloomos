/** How much staff experience a ServiceVersion typically requires to execute well — feeds future Team Operations skill-matching and the AI risk engine ("expert-level Service, no experienced staff assigned"). */
export const SERVICE_EXPERIENCE_LEVELS = ["beginner", "intermediate", "expert"] as const;

export type ServiceExperienceLevel = (typeof SERVICE_EXPERIENCE_LEVELS)[number];

export const SERVICE_EXPERIENCE_LEVEL_LABELS: Record<ServiceExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};
