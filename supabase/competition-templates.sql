-- Editable templates for the tasks the system prepares when a competition is coming up. Run after competition-tasks.sql.
-- Media heads and the super admin edit them from Tasks -> Assign -> Templates.
--   title / instructions can use {competition}, {date} and {location}.
--   days_offset: negative = before the competition starts, 0 = the day itself, positive = after. due_time is Manila time.
-- Changing a template only affects tasks the system prepares from now on; ones it already prepared are left alone.

create table if not exists website.competition_task_templates (
  key          text primary key default substr(gen_random_uuid()::text, 1, 8),
  title        text not null check (char_length(title) between 1 and 200),
  instructions text check (instructions is null or char_length(instructions) <= 2000),
  days_offset  integer not null default 0 check (days_offset between -60 and 60),
  due_time     time not null default '18:00',
  enabled      boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);

insert into website.competition_task_templates (key, title, instructions, days_offset, sort) values
  ('pubmat',   'Create the pubmat for {competition}',   'Design the announcement pubmat for {competition} ({date}). Include the date and venue ({location}).', -7, 1),
  ('gear',     'Prepare camera gear for {competition}', 'Charge batteries, clear memory cards and pack the cameras, lenses and tripods for {competition}.', -2, 2),
  ('coverage', 'Cover {competition}',                   'Photos and video of the team during {competition} ({date}). Upload everything to the shared Drive the same day.', 0, 3),
  ('recap',    'Post the recap of {competition}',       'Edit the best photos and clips and post the recap of {competition} with the results.', 2, 4)
on conflict (key) do nothing;

alter table website.competition_task_templates enable row level security;
revoke all on website.competition_task_templates from anon;
drop policy if exists "Templates: media head reads" on website.competition_task_templates;
drop policy if exists "Templates: media head writes" on website.competition_task_templates;
create policy "Templates: media head reads" on website.competition_task_templates for select to authenticated
  using (public.is_approved_admin() and public.is_media_head());
create policy "Templates: media head writes" on website.competition_task_templates for all to authenticated
  using (public.is_approved_admin() and public.is_media_head()) with check (public.is_approved_admin() and public.is_media_head());

create or replace function public.generate_competition_tasks() returns integer
language plpgsql security definer set search_path = public, website as $$
declare c record; k record; s date; n integer := 0; due timestamptz;
begin
  if auth.uid() is not null and not public.is_approved_admin() then return 0; end if;
  for c in select id, title, date, location from website.competitions loop
    s := public.parse_competition_start(c.date);
    continue when s is null or s < current_date or s > current_date + 30;
    for k in select * from website.competition_task_templates where enabled order by sort, created_at loop
      due := (((s + k.days_offset) + k.due_time) at time zone 'Asia/Manila');
      insert into website.task_suggestions (competition_id, template_key, title, instructions, due_at)
      values (
        c.id, k.key,
        replace(replace(replace(k.title, '{competition}', c.title), '{date}', coalesce(c.date, '')), '{location}', coalesce(c.location, 'the venue')),
        nullif(replace(replace(replace(coalesce(k.instructions, ''), '{competition}', c.title), '{date}', coalesce(c.date, '')), '{location}', coalesce(c.location, 'the venue')), ''),
        case when due > now() then due end
      )
      on conflict (competition_id, template_key) do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;
