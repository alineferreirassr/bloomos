/**
 * A client's actual answer to one ServiceQuestionnaireQuestion, for one
 * specific booking. The Service owns the QUESTION (question_id points at the
 * pinned ServiceVersion's own question row, stable for the life of this
 * EventService); this row owns only the ANSWER — exactly the "Events should
 * not define questionnaires" boundary from the architecture review. Exactly
 * one of the four response_* fields is populated, matching the question's
 * own `question_type`.
 */
export interface EventServiceQuestionnaireResponse {
  id: string;
  workspace_id: string;
  event_service_id: string;
  question_id: string;
  response_text: string | null;
  response_options: string[] | null;
  response_boolean: boolean | null;
  response_date: string | null;
  created_at: string;
  updated_at: string;
}
