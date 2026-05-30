'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getFieldComponentByType } from './fieldRegistry';
import { FieldValue, FormQuestion, ResponseValueMap, TeamRegistrationForm } from './types';

interface DynamicRegistrationFormProps {
  teamSlug: string;
  open: boolean;
  onClose: () => void;
}

const isQuestionFilled = (question: FormQuestion, value: FieldValue): boolean => {
  if (value == null) return false;
  if (question.type === 'checkbox_group') return Array.isArray(value) && value.length > 0;
  if (question.type === 'file') return value instanceof FileList && value.length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return true;
  return String(value).trim().length > 0;
};

const normalizeQuestions = (form: TeamRegistrationForm): TeamRegistrationForm => {
  const sortedQuestions = [...(form.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  return {
    ...form,
    questions: sortedQuestions.map((question) => ({
      ...question,
      options: [...(question.options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    })),
  };
};

const buildDefaultValues = (questions: FormQuestion[]): ResponseValueMap => {
  return questions.reduce<ResponseValueMap>((acc, question) => {
    if (question.type === 'checkbox_group') {
      acc[question.id] = [];
    } else if (question.type === 'boolean') {
      acc[question.id] = false;
    } else {
      acc[question.id] = question.default_value ?? '';
    }
    return acc;
  }, {});
};

const DynamicRegistrationForm = ({ teamSlug, open, onClose }: DynamicRegistrationFormProps) => {
  const [form, setForm] = useState<TeamRegistrationForm | null>(null);
  const [values, setValues] = useState<ResponseValueMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!open) return;

    const fetchForm = async () => {
      setStatus('loading');
      setMessage('');

      const { data, error } = await supabase
        .from('team_registration_forms')
        .select(`
          id,
          team_id,
          title,
          description,
          is_active,
          questions:registration_questions (
            id,
            form_id,
            question_key,
            label,
            description,
            type,
            is_required,
            sort_order,
            placeholder,
            default_value,
            validation_rules,
            options:registration_question_options (
              id,
              question_id,
              label,
              value,
              sort_order
            )
          ),
          teams!inner (slug)
        `)
        .eq('teams.slug', teamSlug)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setStatus('error');
        setMessage('Unable to load registration form right now.');
        return;
      }

      const normalized = normalizeQuestions(data as unknown as TeamRegistrationForm);
      setForm(normalized);
      setValues(buildDefaultValues(normalized.questions));
      setStatus('idle');
    };

    fetchForm();
  }, [open, teamSlug]);

  const questionCount = useMemo(() => form?.questions.length ?? 0, [form]);

  const onValueChange = (questionId: string, nextValue: FieldValue) => {
    setValues((prev) => ({ ...prev, [questionId]: nextValue }));
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const { [questionId]: _, ...rest } = prev;
      return rest;
    });
  };

  const validate = (): boolean => {
    if (!form) return false;
    const nextErrors: Record<string, string> = {};

    for (const question of form.questions) {
      if (!question.is_required) continue;
      if (!isQuestionFilled(question, values[question.id])) {
        nextErrors[question.id] = 'This field is required.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const uploadFileIfNeeded = async (submissionId: string, questionId: string, value: FieldValue) => {
    if (!(value instanceof FileList) || value.length === 0) return [];

    const uploadedFiles: Array<{ path: string; size: number; mime_type: string }> = [];

    for (const file of Array.from(value)) {
      const storagePath = `${submissionId}/${questionId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('registration-files').upload(storagePath, file);

      if (error) throw error;

      uploadedFiles.push({
        path: storagePath,
        size: file.size,
        mime_type: file.type,
      });
    }

    return uploadedFiles;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !validate()) return;

    setStatus('submitting');
    setMessage('');

    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .insert({
        form_id: form.id,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (submissionError || !submission) {
      setStatus('error');
      setMessage('Could not save your registration. Please try again.');
      return;
    }

    try {
      const responseRows: Array<Record<string, unknown>> = [];

      for (const question of form.questions) {
        const value = values[question.id];
        const base = {
          submission_id: submission.id,
          question_id: question.id,
        };

        if (question.type === 'file') {
          const uploadedFiles = await uploadFileIfNeeded(submission.id, question.id, value);
          responseRows.push({ ...base, json_value: uploadedFiles });
          continue;
        }

        if (question.type === 'number') {
          const castNumber = value === '' || value == null ? null : Number(value);
          responseRows.push({ ...base, number_value: Number.isFinite(castNumber) ? castNumber : null });
          continue;
        }

        if (question.type === 'date') {
          responseRows.push({ ...base, date_value: typeof value === 'string' && value ? value : null });
          continue;
        }

        if (question.type === 'multiple_choice' || question.type === 'dropdown') {
          responseRows.push({ ...base, option_id: typeof value === 'string' && value ? value : null });
          continue;
        }

        if (question.type === 'checkbox_group') {
          responseRows.push({ ...base, json_value: Array.isArray(value) ? value : [] });
          continue;
        }

        if (question.type === 'boolean') {
          responseRows.push({ ...base, boolean_value: value === true });
          continue;
        }

        responseRows.push({ ...base, text_value: typeof value === 'string' ? value : value == null ? null : String(value) });
      }

      const { error: responsesError } = await supabase.from('form_responses').insert(responseRows);

      if (responsesError) {
        throw responsesError;
      }

      setStatus('success');
      setMessage('Registration submitted successfully.');
    } catch {
      setStatus('error');
      setMessage('Something went wrong while saving your responses.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700/70 bg-slate-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-700/70 pb-4">
          <div>
            <h3 className="text-xl font-semibold text-white">{form?.title ?? 'Team Registration'}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {form?.description ?? 'Complete this form so we can review your registration.'}
            </p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{questionCount} questions</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Close registration form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === 'loading' ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading registration form...</span>
          </div>
        ) : null}

        {status === 'error' && !form ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{message}</div>
        ) : null}

        {form ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {form.questions.map((question) => {
              const Field = getFieldComponentByType(question.type);
              return (
                <Field
                  key={question.id}
                  question={question}
                  value={values[question.id]}
                  error={errors[question.id]}
                  disabled={status === 'submitting' || status === 'success'}
                  onChange={onValueChange}
                />
              );
            })}

            {message ? (
              <div
                className={`rounded-lg p-3 text-sm ${
                  status === 'success'
                    ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : status === 'error'
                      ? 'border border-red-500/40 bg-red-500/10 text-red-200'
                      : 'border border-slate-700/80 bg-slate-800/70 text-slate-300'
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-700/70 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'submitting' || status === 'success'}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 px-5 py-2 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {status === 'success' ? 'Submitted' : 'Submit Registration'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
};

export default DynamicRegistrationForm;
