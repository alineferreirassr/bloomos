import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const reviewRequestDocumentType: DocumentTypeDefinition = {
  id: "review-request",
  label: "Review Request",
  description: "Asks a Client for a testimonial or public review — timed off the Client Journey's own progress, not sent blind.",
  icon: "Star",
  suggestedMergeFieldKeys: ["client_name", "event_title", "journey_progress_percent", "brand_website"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};
