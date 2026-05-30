import { createClient } from '@supabase/supabase-js';

const ALLOWED_TYPES = new Set([
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
]);

const OPTION_TYPES = new Set(['multiple_choice', 'checkbox_group', 'dropdown']);

type QuestionOptionInput = {
  label: string;
  value?: string;
  sort_order?: number;
};

type CreateQuestionBody = {
  form_id?: string;
  form_slug?: string;
  question_key?: string;
  type?: string;
  label?: string;
  description?: string | null;
  is_required?: boolean;
  sort_order?: number;
  placeholder?: string | null;
  validation_rules?: Record<string, unknown>;
  options?: QuestionOptionInput[];
};

type SupabaseLikeClient = {
  from: (table: string) => any;
};

const json = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

const unauthorized = () => json({ error: 'Unauthorized' }, 401);

const getEnvValue = (...names: Array<string | undefined>) => {
  for (const name of names) {
    if (!name) continue;
    const value = process.env[name];
    if (value) return value;
  }

  return null;
};

const getBearerToken = (authHeader: string | null) => {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

const createPublicClient = () => {
  const url = getEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const validatePayload = (body: CreateQuestionBody) => {
  if (!body.form_id && !body.form_slug) {
    return 'Either form_id or form_slug is required.';
  }

  if (!body.question_key || body.question_key.trim().length < 2) {
    return 'question_key is required and must have at least 2 characters.';
  }

  if (!body.label || body.label.trim().length < 2) {
    return 'label is required and must have at least 2 characters.';
  }

  if (!body.type || !ALLOWED_TYPES.has(body.type)) {
    return 'type is required and must be one of the supported question types.';
  }

  if (typeof body.sort_order !== 'number' || !Number.isInteger(body.sort_order)) {
    return 'sort_order is required and must be an integer.';
  }

  if (body.validation_rules != null) {
    const isObject =
      typeof body.validation_rules === 'object' &&
      !Array.isArray(body.validation_rules) &&
      body.validation_rules !== null;

    if (!isObject) {
      return 'validation_rules must be a JSON object.';
    }
  }

  if (OPTION_TYPES.has(body.type)) {
    if (!Array.isArray(body.options) || body.options.length === 0) {
      return 'options is required for multiple_choice, checkbox_group, and dropdown.';
    }

    for (let i = 0; i < body.options.length; i += 1) {
      const option = body.options[i];
      if (!option.label || option.label.trim().length === 0) {
        return `options[${i}].label is required.`;
      }
      if (option.sort_order != null && !Number.isInteger(option.sort_order)) {
        return `options[${i}].sort_order must be an integer when provided.`;
      }
    }
  }

  return null;
};

const resolveFormId = async (
  supabase: SupabaseLikeClient,
  formId: string | undefined,
  formSlug: string | undefined
) => {
  if (formId) return formId;
  if (!formSlug) return null;

  const { data, error } = await supabase
    .from('registration_forms')
    .select('id')
    .eq('slug', formSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (typeof data.id !== 'string') {
    return null;
  }

  return data.id;
};

export async function POST(request: Request) {
  try {
    const supabase = createPublicClient();
    if (!supabase) {
      return json(
        {
          error: 'Server is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        },
        500
      );
    }

    const body = (await request.json()) as CreateQuestionBody;

    const validationError = validatePayload(body);
    if (validationError) {
      return json({ error: validationError }, 400);
    }

    const formId = await resolveFormId(supabase, body.form_id, body.form_slug);
    if (!formId) {
      return json({ error: 'Form not found for provided form_id/form_slug.' }, 404);
    }

    const questionInsert = {
      form_id: formId,
      question_key: body.question_key!.trim(),
      type: body.type!,
      label: body.label!.trim(),
      description: body.description ?? null,
      is_required: body.is_required ?? false,
      sort_order: body.sort_order!,
      placeholder: body.placeholder ?? null,
      validation_rules: body.validation_rules ?? {},
    };

    const { data: question, error: questionError } = await supabase
      .from('registration_questions')
      .insert(questionInsert)
      .select('*')
      .single();

    if (questionError || !question) {
      const message = questionError?.message ?? 'Could not create question.';
      const status = message.toLowerCase().includes('duplicate') ? 409 : 500;
      return json({ error: message }, status);
    }

    let insertedOptions: Array<Record<string, unknown>> = [];

    if (OPTION_TYPES.has(body.type!)) {
      const options = (body.options ?? []).map((option, idx) => ({
        question_id: question.id,
        label: option.label.trim(),
        value: (option.value ?? option.label).trim(),
        sort_order: option.sort_order ?? idx + 1,
      }));

      const { data: optionsData, error: optionsError } = await supabase
        .from('registration_question_options')
        .insert(options)
        .select('*');

      if (optionsError) {
        await supabase.from('registration_questions').delete().eq('id', question.id);
        return json({ error: optionsError.message }, 500);
      }

      insertedOptions = optionsData ?? [];
    }

    return json(
      {
        message: 'Question created successfully.',
        question,
        options: insertedOptions,
      },
      201
    );
  } catch {
    return json({ error: 'Unexpected server error.' }, 500);
  }
}

export async function GET() {
  return json(
    {
      endpoint: '/api/registration/questions',
      method: 'POST',
      description: 'Create a new registration question for a form.',
      requiredHeaders: {
        'Content-Type': 'application/json',
      },
      bodyShape: {
        form_id: 'string (optional if form_slug is provided)',
        form_slug: 'string (optional if form_id is provided)',
        question_key: 'string',
        type: 'short_text | long_text | email | phone | url | multiple_choice | checkbox_group | dropdown | date | number | file | boolean',
        label: 'string',
        description: 'string | null',
        is_required: 'boolean',
        sort_order: 'number',
        placeholder: 'string | null',
        validation_rules: 'object',
        options: '[{ label, value?, sort_order? }] for multiple_choice, checkbox_group, dropdown',
      },
    },
    200
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: 'POST, OPTIONS',
    },
  });
}
