'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, DatabaseZap, Plus, Trash2 } from 'lucide-react';

type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'url'
  | 'multiple_choice'
  | 'checkbox_group'
  | 'dropdown'
  | 'date'
  | 'number'
  | 'file'
  | 'boolean';

type OptionDraft = {
  label: string;
  value: string;
  sort_order: number;
};

type AdminFormState = {
  formSlug: string;
  label: string;
  questionKey: string;
  type: QuestionType;
  isRequired: boolean;
  sortOrder: string;
  description: string;
  options: OptionDraft[];
};

const QUESTION_TYPES: QuestionType[] = [
  'short_text',
  'long_text',
  'email',
  'phone',
  'url',
  'multiple_choice',
  'checkbox_group',
  'dropdown',
  'date',
  'number',
  'file',
  'boolean',
];

const OPTION_TYPES = new Set<QuestionType>(['multiple_choice', 'checkbox_group', 'dropdown']);

const DEFAULT_OPTIONS: OptionDraft[] = [
  { label: 'Option 1', value: 'option_1', sort_order: 1 },
  { label: 'Option 2', value: 'option_2', sort_order: 2 },
];

const defaultState: AdminFormState = {
  formSlug: 'qcu-robotics-join-team',
  label: '',
  questionKey: '',
  type: 'short_text',
  isRequired: false,
  sortOrder: '1',
  description: '',
  options: DEFAULT_OPTIONS,
};

const cardClassName = 'rounded-2xl border border-slate-800 bg-slate-950/70 shadow-2xl shadow-black/20';
const inputClassName =
  'w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-red-500 focus:outline-none';
const labelClassName = 'text-sm font-medium text-slate-200';

const isChoiceType = (type: QuestionType) => OPTION_TYPES.has(type);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeOption = (option: OptionDraft, index: number) => ({
  label: option.label.trim(),
  value: (option.value || option.label).trim(),
  sort_order: Number.isNaN(Number(option.sort_order)) ? index + 1 : Number(option.sort_order),
});

export default function RegistrationQuestionAdminPage() {
  const [form, setForm] = useState<AdminFormState>(defaultState);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [savedQuestion, setSavedQuestion] = useState('');

  const needsOptions = isChoiceType(form.type);

  const questionSummary = useMemo(() => {
    if (!needsOptions) return 'This question does not need choices.';
    return `You have ${form.options.length} choices.`;
  }, [needsOptions, form.options.length]);

  const updateField = <K extends keyof AdminFormState>(key: K, value: AdminFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateLabel = (value: string) => {
    setForm((prev) => {
      const nextKey = prev.questionKey && prev.questionKey !== slugify(prev.label) ? prev.questionKey : slugify(value);
      return {
        ...prev,
        label: value,
        questionKey: nextKey,
      };
    });
  };

  const addOption = () => {
    setForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        {
          label: `Option ${prev.options.length + 1}`,
          value: `option_${prev.options.length + 1}`,
          sort_order: prev.options.length + 1,
        },
      ],
    }));
  };

  const updateOption = (index: number, key: keyof OptionDraft, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [key]: value } : option
      ),
    }));
  };

  const removeOption = (index: number) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, optionIndex) => optionIndex !== index),
    }));
  };

  const onTypeChange = (type: QuestionType) => {
    setForm((prev) => ({
      ...prev,
      type,
      options: isChoiceType(type) ? prev.options : [],
    }));
  };

  const resetForm = () => {
    setForm(defaultState);
    setStatus('idle');
    setMessage('');
    setSavedQuestion('');
  };

  const submitQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');
    setSavedQuestion('');

    const payload = {
      form_slug: form.formSlug || undefined,
      question_key: form.questionKey.trim() || slugify(form.label),
      type: form.type,
      label: form.label.trim(),
      description: form.description.trim() || null,
      is_required: form.isRequired,
      sort_order: Number(form.sortOrder),
      validation_rules: {},
      ...(needsOptions
        ? {
            options: form.options.map((option, index) => normalizeOption(option, index)),
          }
        : {}),
    };

    try {
      const response = await fetch('/api/registration/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { message?: string; error?: string; question?: { label?: string } };

      if (!response.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Unable to create question.');
        return;
      }

      setStatus('success');
      setMessage(data.message ?? 'Question created successfully.');
      setSavedQuestion(data.question?.label ?? form.label);
    } catch {
      setStatus('error');
      setMessage('Network error while creating the question.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl shadow-black/30">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-200">
            <DatabaseZap className="h-3.5 w-3.5" />
            Question Builder
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">Add a new question</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Fill in the question text, choose the answer style, and save. It works like a simple form builder.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form onSubmit={submitQuestion} className={`${cardClassName} p-6`}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className={labelClassName} htmlFor="formSlug">Form</label>
                <input
                  id="formSlug"
                  className={inputClassName}
                  value={form.formSlug}
                  onChange={(e) => updateField('formSlug', e.target.value)}
                  placeholder="qcu-robotics-join-team"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className={labelClassName} htmlFor="label">Question text</label>
                <input
                  id="label"
                  className={inputClassName}
                  value={form.label}
                  onChange={(e) => updateLabel(e.target.value)}
                  placeholder="What is your full name?"
                />
              </div>

              <div className="space-y-2">
                <label className={labelClassName} htmlFor="type">Answer type</label>
                <select
                  id="type"
                  className={inputClassName}
                  value={form.type}
                  onChange={(e) => onTypeChange(e.target.value as QuestionType)}
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className={labelClassName} htmlFor="sortOrder">Order</label>
                <input
                  id="sortOrder"
                  type="number"
                  className={inputClassName}
                  value={form.sortOrder}
                  onChange={(e) => updateField('sortOrder', e.target.value)}
                  min="1"
                />
              </div>

              <div className="flex items-center gap-3 md:col-span-2">
                <input
                  id="isRequired"
                  type="checkbox"
                  checked={form.isRequired}
                  onChange={(e) => updateField('isRequired', e.target.checked)}
                  className="h-4 w-4 accent-red-500"
                />
                <label className={labelClassName} htmlFor="isRequired">Required question</label>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className={labelClassName} htmlFor="description">Description</label>
                <input
                  id="description"
                  className={inputClassName}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Optional short note for people filling out the form"
                />
              </div>
            </div>

            {needsOptions ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Choices</h2>
                    <p className="text-sm text-slate-400">Add the options people can select.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                  >
                    <Plus className="h-4 w-4" />
                    Add choice
                  </button>
                </div>

                <div className="space-y-3">
                  {form.options.map((option, index) => (
                    <div key={`${option.label}-${index}`} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-[1fr_1fr_auto]">
                      <div className="space-y-2">
                        <label className={labelClassName}>Choice text</label>
                        <input
                          className={inputClassName}
                          value={option.label}
                          onChange={(e) => updateOption(index, 'label', e.target.value)}
                          placeholder="Example: Mechanical"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClassName}>Saved value</label>
                        <input
                          className={inputClassName}
                          value={option.value}
                          onChange={(e) => updateOption(index, 'value', e.target.value)}
                          placeholder="mechanical"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="space-y-2">
                          <label className={labelClassName}>Order</label>
                          <input
                            type="number"
                            className={inputClassName}
                            value={option.sort_order}
                            onChange={(e) => updateOption(index, 'sort_order', Number(e.target.value))}
                            min="1"
                            style={{ width: 120 }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="rounded-xl border border-slate-700 p-3 text-slate-300 hover:bg-slate-800 hover:text-white"
                          aria-label="Remove choice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'submitting' ? 'Saving...' : 'Create question'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Reset
              </button>
            </div>

            {message ? (
              <div
                className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${
                  status === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                    : 'border-red-500/30 bg-red-500/10 text-red-100'
                }`}
              >
                {status === 'success' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                )}
                <span>{message}</span>
              </div>
            ) : null}

            {savedQuestion ? (
              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                Saved question: <span className="text-slate-100">{savedQuestion}</span>
              </div>
            ) : null}
          </form>

          <aside className={`${cardClassName} p-6`}>
            <h2 className="text-lg font-semibold">Preview</h2>
            <p className="mt-2 text-sm text-slate-400">A simple summary of the question you are building.</p>

            <div className="mt-5 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Question</p>
                <p className="mt-1 text-base font-semibold text-white">{form.label || 'Untitled question'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Type</p>
                <p className="mt-1 text-sm text-slate-300">{form.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Required</p>
                <p className="mt-1 text-sm text-slate-300">{form.isRequired ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Choices</p>
                <p className="mt-1 text-sm text-slate-300">{needsOptions ? `${form.options.length} choices added` : 'Not needed'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Question key</p>
                <p className="mt-1 text-sm text-slate-300">{form.questionKey || slugify(form.label) || 'auto-generated'}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
