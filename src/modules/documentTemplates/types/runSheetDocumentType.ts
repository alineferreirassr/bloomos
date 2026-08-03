import type { DocumentTypeDefinition } from "@/types/documentPlatform";

export const runSheetDocumentType: DocumentTypeDefinition = {
  id: "run-sheet",
  label: "Run Sheet",
  description: "A minute-by-minute Event schedule for the operations team.",
  icon: "CalendarClock",
  suggestedMergeFieldKeys: ["workspace_name", "event_title", "event_date", "event_location"],
  requiredPermissions: ["documents.create"],
  featureFlag: null,
  minimumRole: null,
};
