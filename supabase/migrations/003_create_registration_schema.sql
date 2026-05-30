-- Minimal dynamic registration schema focused on form responses only.

create extension if not exists pgcrypto;

create table if not exists public.registration_forms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.registration_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.registration_forms(id) on delete cascade,
  question_key text not null,
  type text not null,
  label text not null,
  description text,
  is_required boolean not null default false,
  sort_order integer not null,
  placeholder text,
  validation_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (form_id, question_key),
  unique (form_id, sort_order),
  constraint registration_questions_type_chk check (
    type in (
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
      'boolean'
    )
  )
);

create table if not exists public.registration_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.registration_questions(id) on delete cascade,
  label text not null,
  value text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (question_id, sort_order)
);

create table if not exists public.registration_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.registration_forms(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.registration_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.registration_submissions(id) on delete cascade,
  question_id uuid not null references public.registration_questions(id) on delete cascade,
  option_id uuid references public.registration_question_options(id) on delete set null,
  text_value text,
  number_value numeric,
  boolean_value boolean,
  date_value date,
  json_value jsonb,
  created_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

create index if not exists idx_registration_questions_form on public.registration_questions(form_id, sort_order);
create index if not exists idx_registration_question_options_question on public.registration_question_options(question_id, sort_order);
create index if not exists idx_registration_submissions_form on public.registration_submissions(form_id, submitted_at desc);
create index if not exists idx_registration_responses_submission on public.registration_responses(submission_id);
create index if not exists idx_registration_responses_question on public.registration_responses(question_id);

alter table public.registration_forms enable row level security;
alter table public.registration_questions enable row level security;
alter table public.registration_question_options enable row level security;
alter table public.registration_submissions enable row level security;
alter table public.registration_responses enable row level security;

grant select on public.registration_forms to anon, authenticated;
grant select on public.registration_questions to anon, authenticated;
grant select on public.registration_question_options to anon, authenticated;
grant insert on public.registration_questions to anon, authenticated;
grant insert on public.registration_question_options to anon, authenticated;
grant insert on public.registration_submissions to anon, authenticated;
grant insert on public.registration_responses to anon, authenticated;

create policy "read active registration forms"
on public.registration_forms
for select
to anon, authenticated
using (is_active = true);

create policy "read questions for active forms"
on public.registration_questions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.registration_forms f
    where f.id = registration_questions.form_id
      and f.is_active = true
  )
);

create policy "read options for active forms"
on public.registration_question_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.registration_questions q
    join public.registration_forms f on f.id = q.form_id
    where q.id = registration_question_options.question_id
      and f.is_active = true
  )
);

create policy "insert registration questions"
on public.registration_questions
for insert
to anon, authenticated
with check (true);

create policy "insert registration question options"
on public.registration_question_options
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.registration_questions q
    where q.id = registration_question_options.question_id
  )
);

create policy "insert submissions"
on public.registration_submissions
for insert
to anon, authenticated
with check (true);

create policy "insert responses"
on public.registration_responses
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.registration_submissions s
    where s.id = registration_responses.submission_id
  )
);

-- ---------------------------------------------------------------------------
-- Sample seed data (idempotent)
-- ---------------------------------------------------------------------------

insert into public.registration_forms (slug, title, description, is_active)
values (
  'qcu-robotics-join-team',
  'QCU Robotics Join Team Form',
  'Sample dynamic form used to test all supported question types.',
  true
)
on conflict (slug) do update
set title = excluded.title,
    description = excluded.description,
    is_active = excluded.is_active;

with target_form as (
  select id
  from public.registration_forms
  where slug = 'qcu-robotics-join-team'
)
insert into public.registration_questions (
  form_id,
  question_key,
  type,
  label,
  description,
  is_required,
  sort_order,
  placeholder,
  validation_rules
)
select
  tf.id,
  q.question_key,
  q.type,
  q.label,
  q.description,
  q.is_required,
  q.sort_order,
  q.placeholder,
  q.validation_rules::jsonb
from target_form tf
cross join (
  values
    ('full_name', 'short_text', 'Full Name', 'Your legal full name', true, 1, 'Juan Dela Cruz', '{"min_length":2,"max_length":120}'),
    ('bio', 'long_text', 'Why do you want to join?', 'Short motivation statement', true, 2, 'Tell us about your goals in robotics', '{"min_length":30,"max_length":1200}'),
    ('email_address', 'email', 'Email Address', 'We will contact you here', true, 3, 'name@example.com', '{}'),
    ('phone_number', 'phone', 'Phone Number', 'Include country code', true, 4, '+63 900 000 0000', '{}'),
    ('portfolio_url', 'url', 'Portfolio / GitHub URL', 'Optional profile link', false, 5, 'https://github.com/yourname', '{}'),
    ('preferred_track', 'multiple_choice', 'Preferred Track', 'Choose one main track', true, 6, null, '{}'),
    ('tools_used', 'checkbox_group', 'Tools You Have Used', 'Select all that apply', false, 7, null, '{"min_selected":1}'),
    ('year_level', 'dropdown', 'Year Level', 'Current year level', true, 8, null, '{}'),
    ('availability_date', 'date', 'Available Start Date', 'When can you start?', true, 9, null, '{}'),
    ('hours_per_week', 'number', 'Hours Per Week', 'Estimated weekly availability', true, 10, '8', '{"min":1,"max":40,"step":1}'),
    ('resume_file', 'file', 'Resume (PDF)', 'Upload your resume', false, 11, null, '{"max_size_mb":10,"allowed_types":["application/pdf"]}'),
    ('agree_terms', 'boolean', 'I agree to the team policies', 'You must agree before submitting', true, 12, 'I agree', '{}')
) as q(question_key, type, label, description, is_required, sort_order, placeholder, validation_rules)
on conflict (form_id, question_key) do update
set type = excluded.type,
    label = excluded.label,
    description = excluded.description,
    is_required = excluded.is_required,
    sort_order = excluded.sort_order,
    placeholder = excluded.placeholder,
    validation_rules = excluded.validation_rules;

insert into public.registration_question_options (question_id, label, value, sort_order)
select
  q.id,
  o.label,
  o.value,
  o.sort_order
from public.registration_forms f
join public.registration_questions q on q.form_id = f.id
join (
  values
    ('preferred_track', 'Mechanical', 'mechanical', 1),
    ('preferred_track', 'Programming', 'programming', 2),
    ('preferred_track', 'Electronics', 'electronics', 3),
    ('preferred_track', 'Research and Documentation', 'research_docs', 4),

    ('tools_used', 'Arduino', 'arduino', 1),
    ('tools_used', 'C/C++', 'cpp', 2),
    ('tools_used', 'Python', 'python', 3),
    ('tools_used', 'CAD (Fusion 360 / SolidWorks)', 'cad', 4),
    ('tools_used', 'PCB Design', 'pcb', 5),

    ('year_level', '1st Year', '1st_year', 1),
    ('year_level', '2nd Year', '2nd_year', 2),
    ('year_level', '3rd Year', '3rd_year', 3),
    ('year_level', '4th Year', '4th_year', 4)
) as o(question_key, label, value, sort_order)
  on o.question_key = q.question_key
where f.slug = 'qcu-robotics-join-team'
on conflict (question_id, sort_order) do update
set label = excluded.label,
    value = excluded.value;

-- ---------------------------------------------------------------------------
-- Starter template: add your own question to an existing form
-- ---------------------------------------------------------------------------
-- 1) Replace form slug and values below.
-- 2) For multiple_choice, checkbox_group, or dropdown, insert options after.
--
-- with target_form as (
--   select id from public.registration_forms where slug = 'qcu-robotics-join-team'
-- )
-- insert into public.registration_questions (
--   form_id, question_key, type, label, description, is_required, sort_order, placeholder, validation_rules
-- )
-- select
--   target_form.id,
--   'new_question_key',
--   'short_text',
--   'New Question Label',
--   'Optional helper text',
--   false,
--   99,
--   'Optional placeholder',
--   '{}'::jsonb
-- from target_form;
