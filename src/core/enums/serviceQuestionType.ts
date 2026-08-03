/** The input shape a ServiceQuestionnaireQuestion expects back from a client — deliberately small, matching what the future Client Portal questionnaire UI can render without a rich form-builder. */
export const SERVICE_QUESTION_TYPES = ["short_text", "long_text", "single_choice", "multi_choice", "boolean", "date"] as const;

export type ServiceQuestionType = (typeof SERVICE_QUESTION_TYPES)[number];

export const SERVICE_QUESTION_TYPE_LABELS: Record<ServiceQuestionType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  single_choice: "Single Choice",
  multi_choice: "Multiple Choice",
  boolean: "Yes / No",
  date: "Date",
};
