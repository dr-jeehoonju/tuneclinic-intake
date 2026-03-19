export type IntakeState =
  | "greeting"
  | "open_narrative"
  | "quick_collect"
  | "deep_gather"
  | "confirmation"
  | "structuring"
  | "complete"
  | "escalated"
  | "abandoned";

export type UrgencyLevel = "normal" | "elevated" | "urgent";

export type SafetyLevel = "clear" | "emergency" | "flag";

export interface QuickStep {
  id: string;
  question: string;
  type: "single" | "multi" | "text";
  options: { label: string; value: string }[];
  allowSkip?: boolean;
  skipLabel?: string;
  placeholder?: string;
}

export interface QuickCollectData {
  chief_complaint: string;
  patient_name: string;
  patient_phone: string;
  skin_concerns: string[];
  treatment_interests: string[];
  age_range: string;
  gender: string;
  previous_treatments: string;
  retinoid_use: string;
  pregnancy_status: string;
}

export interface IntakeSession {
  id: string;
  patient_id: string;
  current_state: IntakeState;
  exchange_count: number;
  fields_collected: string[];
  fields_missing: string[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  channel: "web" | "whatsapp" | "telegram";
}

export interface IntakeMessage {
  id: string;
  session_id: string;
  role: "patient" | "assistant" | "system";
  content_original: string;
  content_translated: string | null;
  detected_language: string | null;
  state_at_time: IntakeState;
  sequence_number: number;
  created_at: string;
}

export interface CompleteIntakeInput {
  chief_complaint: string;
  patient_name?: string;
  patient_phone?: string;
  skin_concerns: string[];
  treatment_interests?: string[];
  age_range?: string;
  gender?: "female" | "male" | "other" | "unknown";
  fitzpatrick_estimate?: "I" | "II" | "III" | "IV" | "V" | "VI" | "uncertain";
  current_skincare?: string;
  sun_exposure?: string;
  previous_treatments?: string;
  medications?: string;
  allergies?: string;
  pregnancy_status?: "not_pregnant" | "pregnant" | "breastfeeding" | "unknown";
  budget_range?: string;
  timeline?: string;
  fields_collected: string[];
  fields_missing?: string[];
  risk_flags: string[];
  urgency: UrgencyLevel;
}

export interface ChatResponse {
  reply: string;
  state: IntakeState;
  session_id: string;
  is_complete: boolean;
  is_escalated: boolean;
}
