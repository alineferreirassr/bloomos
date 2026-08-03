import type { ServiceQuestionType } from "@/core/enums/serviceQuestionType";

/** One question a Service wants asked of the client when booked — the Service owns the QUESTION, the client's ANSWER lives separately on EventServiceQuestionnaireResponse (types/eventServiceQuestionnaireResponse.ts), never on this row. `options` is only meaningful for `single_choice`/`multi_choice`. */
export interface ServiceQuestionnaireQuestion {
  id: string;
  workspace_id: string;
  service_version_id: string;
  question_text: string;
  question_type: ServiceQuestionType;
  is_required: boolean;
  options: string[] | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
