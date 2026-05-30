export const QUESTION_TYPES = {
  SHORT_TEXT: 'short_text',
  LONG_TEXT: 'long_text',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  MULTIPLE_CHOICE: 'multiple_choice',
  CHECKBOX_GROUP: 'checkbox_group',
  DROPDOWN: 'dropdown',
  DATE: 'date',
  NUMBER: 'number',
  FILE: 'file',
  BOOLEAN: 'boolean',
} as const;

export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];

export interface FormOption {
  id: string;
  question_id: string;
  label: string;
  value: string;
  sort_order: number;
}

export interface FormQuestion {
  id: string;
  form_id: string;
  question_key: string;
  label: string;
  description: string | null;
  type: QuestionType | string;
  is_required: boolean;
  sort_order: number;
  placeholder: string | null;
  default_value: string | null;
  validation_rules: Record<string, unknown> | null;
  options?: FormOption[];
}

export interface TeamRegistrationForm {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  questions: FormQuestion[];
}

export interface RegistrationPayload {
  teamSlug: string;
  form: TeamRegistrationForm;
}

export type FieldValue = string | number | boolean | string[] | FileList | null;

export type ResponseValueMap = Record<string, FieldValue>;

export interface DynamicFieldProps {
  question: FormQuestion;
  value: FieldValue;
  error?: string;
  disabled?: boolean;
  onChange: (questionId: string, value: FieldValue) => void;
}
