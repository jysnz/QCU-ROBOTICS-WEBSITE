import React from 'react';
import { DynamicFieldProps, FieldValue, FormOption, FormQuestion, QUESTION_TYPES, QuestionType } from './types';

const FieldShell = ({
  question,
  error,
  children,
}: {
  question: FormQuestion;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <label htmlFor={question.id} className="block text-sm font-semibold text-slate-100">
      {question.label}
      {question.is_required ? <span className="ml-1 text-red-400">*</span> : null}
    </label>
    {question.description ? <p className="text-xs text-slate-400">{question.description}</p> : null}
    {children}
    {error ? <p className="text-xs text-red-300">{error}</p> : null}
  </div>
);

const inputBaseClassName =
  'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-red-400 focus:outline-none';

const normalizeStringValue = (value: FieldValue): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
};

const normalizeArrayValue = (value: FieldValue): string[] => {
  if (Array.isArray(value)) return value;
  return [];
};

const resolveNumberStep = (question: FormQuestion): string => {
  const step = question.validation_rules?.step;
  if (typeof step === 'number') return String(step);
  if (typeof step === 'string') return step;
  return '1';
};

const renderChoiceOption = ({
  option,
  checked,
  name,
  onToggle,
}: {
  option: FormOption;
  checked: boolean;
  name: string;
  onToggle: () => void;
}) => (
  <label key={option.id} className="flex items-center gap-2 rounded-md border border-slate-700/70 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
    <input
      type={name === 'checkbox' ? 'checkbox' : 'radio'}
      name={name}
      checked={checked}
      onChange={onToggle}
      className="h-4 w-4 accent-red-500"
    />
    <span>{option.label}</span>
  </label>
);

const ShortTextField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <input
      id={question.id}
      type="text"
      value={normalizeStringValue(value)}
      placeholder={question.placeholder ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    />
  </FieldShell>
);

const LongTextField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <textarea
      id={question.id}
      rows={4}
      value={normalizeStringValue(value)}
      placeholder={question.placeholder ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    />
  </FieldShell>
);

const EmailField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <input
      id={question.id}
      type="email"
      value={normalizeStringValue(value)}
      placeholder={question.placeholder ?? 'name@example.com'}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    />
  </FieldShell>
);

const PhoneField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <input
      id={question.id}
      type="tel"
      value={normalizeStringValue(value)}
      placeholder={question.placeholder ?? '+63 900 000 0000'}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    />
  </FieldShell>
);

const UrlField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <input
      id={question.id}
      type="url"
      value={normalizeStringValue(value)}
      placeholder={question.placeholder ?? 'https://'}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    />
  </FieldShell>
);

const MultipleChoiceField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => {
  const selected = normalizeStringValue(value);
  return (
    <FieldShell question={question} error={error}>
      <div className="space-y-2">
        {(question.options ?? []).map((option) =>
          renderChoiceOption({
            option,
            checked: selected === option.id,
            name: question.id,
            onToggle: () => onChange(question.id, option.id),
          })
        )}
      </div>
      {disabled ? null : (
        <button
          type="button"
          className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          onClick={() => onChange(question.id, '')}
        >
          Clear selection
        </button>
      )}
    </FieldShell>
  );
};

const CheckboxGroupField = ({ question, value, onChange, error }: DynamicFieldProps) => {
  const selected = normalizeArrayValue(value);
  const toggle = (optionId: string) => {
    const nextValue = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
    onChange(question.id, nextValue);
  };

  return (
    <FieldShell question={question} error={error}>
      <div className="space-y-2">
        {(question.options ?? []).map((option) =>
          renderChoiceOption({
            option,
            checked: selected.includes(option.id),
            name: 'checkbox',
            onToggle: () => toggle(option.id),
          })
        )}
      </div>
    </FieldShell>
  );
};

const DropdownField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <select
      id={question.id}
      value={normalizeStringValue(value)}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    >
      <option value="">Select an option</option>
      {(question.options ?? []).map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </FieldShell>
);

const DateField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <input
      id={question.id}
      type="date"
      value={normalizeStringValue(value)}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    />
  </FieldShell>
);

const NumberField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <input
      id={question.id}
      type="number"
      value={normalizeStringValue(value)}
      placeholder={question.placeholder ?? ''}
      step={resolveNumberStep(question)}
      disabled={disabled}
      onChange={(event) => onChange(question.id, event.target.value)}
      className={inputBaseClassName}
    />
  </FieldShell>
);

const FileField = ({ question, onChange, error, disabled }: DynamicFieldProps) => (
  <FieldShell question={question} error={error}>
    <input
      id={question.id}
      type="file"
      disabled={disabled}
      multiple={Boolean(question.validation_rules?.allow_multiple)}
      onChange={(event) => onChange(question.id, event.target.files)}
      className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-red-500"
    />
  </FieldShell>
);

const BooleanField = ({ question, value, onChange, error, disabled }: DynamicFieldProps) => {
  const checked = value === true;
  return (
    <FieldShell question={question} error={error}>
      <label className="flex items-center gap-3 rounded-md border border-slate-700/70 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
        <input
          id={question.id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(question.id, event.target.checked)}
          className="h-4 w-4 accent-red-500"
        />
        <span>{question.placeholder ?? 'Yes, I agree'}</span>
      </label>
    </FieldShell>
  );
};

const UnsupportedField = ({ question }: DynamicFieldProps) => (
  <FieldShell question={question}>
    <p className="rounded-md border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      Unsupported field type: {question.type}
    </p>
  </FieldShell>
);

export type DynamicFieldComponent = (props: DynamicFieldProps) => React.JSX.Element;

export const questionTypeRegistry: Record<string, DynamicFieldComponent> = {
  [QUESTION_TYPES.SHORT_TEXT]: ShortTextField,
  [QUESTION_TYPES.LONG_TEXT]: LongTextField,
  [QUESTION_TYPES.EMAIL]: EmailField,
  [QUESTION_TYPES.PHONE]: PhoneField,
  [QUESTION_TYPES.URL]: UrlField,
  [QUESTION_TYPES.MULTIPLE_CHOICE]: MultipleChoiceField,
  [QUESTION_TYPES.CHECKBOX_GROUP]: CheckboxGroupField,
  [QUESTION_TYPES.DROPDOWN]: DropdownField,
  [QUESTION_TYPES.DATE]: DateField,
  [QUESTION_TYPES.NUMBER]: NumberField,
  [QUESTION_TYPES.FILE]: FileField,
  [QUESTION_TYPES.BOOLEAN]: BooleanField,
};

export const getFieldComponentByType = (type: QuestionType | string): DynamicFieldComponent => {
  return questionTypeRegistry[type] ?? UnsupportedField;
};
