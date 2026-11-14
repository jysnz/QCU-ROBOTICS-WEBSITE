-- Media head role + tasks the system suggests when a competition is coming up. Run after tasks.sql.
--
--  * website.admin_roles: 'super_admin' (can name media heads) and 'media_head' (is prompted to assign competition tasks).
--  * website.task_suggestions: tasks the system creates for each competition starting within 30 days. They wait for the
--    media head, who picks the teammates and due date; assigning one turns it into a normal task.
--  * public.generate_competition_tasks(): reads website.competitions (its date is free text, e.g. "January 27-29, 2026"),
--    runs daily through pg_cron and also whenever a media head or super admin opens /admin.

create table if not exists website.admin_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('super_admin', 'media_head')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- The first super admin. Change this id (or insert more rows here in the SQL editor) to move the role.
insert into website.admin_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'delacruz.jayson.delafuente@gmail.com'
on conflict (user_id) do update set role = 'super_admin';

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public, website as $$
  select exists (select 1 from website.admin_roles where user_id = auth.uid() and role = 'super_admin');
$$;
create or replace function public.is_media_head() returns boolean
language sql stable security definer set search_path = public, website as $$
  select exists (select 1 from website.admin_roles where user_id = auth.uid() and role in ('super_admin', 'media_head'));
$$;
revoke all on function public.is_super_admin(), public.is_media_head() from public, anon;
grant execute on function public.is_super_admin(), public.is_media_head() to authenticated;

alter table website.admin_roles enable row level security;
revoke all on website.admin_roles from anon;
drop policy if exists "Roles: admins read" on website.admin_roles;
drop policy if exists "Roles: super admin names media heads" on website.admin_roles;
drop policy if exists "Roles: super admin removes media heads" on website.admin_roles;
create policy "Roles: admins read" on website.admin_roles for select to authenticated using (public.is_approved_admin());
create policy "Roles: super admin names media heads" on website.admin_roles for insert to authenticated
  with check (public.is_super_admin() and role = 'media_head' and public.is_approved_user(user_id));
create policy "Roles: super admin removes media heads" on website.admin_roles for delete to authenticated
  using (public.is_super_admin() and role = 'media_head');

create table if not exists website.task_suggestions (
  id             uuid primary key default gen_random_uuid(),
  competition_id bigint not null references website.competitions(id) on delete cascade,
  template_key   text not null,
  title          text not null,
  instructions   text,
  due_at         timestamptz,
  status         text not null default 'pending' check (status in ('pending', 'assigned', 'dismissed')),
  task_id        uuid references website.tasks(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (competition_id, template_key)
);
alter table website.task_suggestions enable row level security;
revoke all on website.task_suggestions from anon;
revoke insert, update, delete on website.task_suggestions from authenticated;
grant update (status, task_id) on website.task_suggestions to authenticated;
drop policy if exists "Suggestions: media head reads" on website.task_suggestions;
drop policy if exists "Suggestions: media head updates" on website.task_suggestions;
create policy "Suggestions: media head reads" on website.task_suggestions for select to authenticated
  using (public.is_approved_admin() and public.is_media_head());
create policy "Suggestions: media head updates" on website.task_suggestions for update to authenticated
  using (public.is_approved_admin() and public.is_media_head()) with check (public.is_media_head());

-- "January 27-29, 2026" / "April 25-27, 2026" / "May 2025" -> first day mentioned (day 1 when only a month is given).
create or replace function public.parse_competition_start(d text) returns date
language plpgsql immutable set search_path = public as $$
declare m text[];
begin
  m := regexp_match(coalesce(d, ''), '([A-Za-z]{3,9})\.?\s+(\d{1,2})?(?:\s*[-–]\s*\d{1,2})?,?\s*(\d{4})');
  if m is null then return null; end if;
  return to_date(left(m[1], 3) || ' ' || coalesce(m[2], '1') || ' ' || m[3], 'Mon DD YYYY');
exception when others then
  return null;
end $$;

create or replace function public.generate_competition_tasks() returns integer
language plpgsql security definer set search_path = public, website as $$
declare c record; k record; s date; n integer := 0; due timestamptz;
begin
  -- pg_cron runs without a user; from the app only approved admins may trigger it
  if auth.uid() is not null and not public.is_approved_admin() then return 0; end if;
  for c in select id, title, date, location from website.competitions loop
    s := public.parse_competition_start(c.date);
    continue when s is null or s < current_date or s > current_date + 30;
    for k in
      select * from (values
        ('pubmat',   'Create the pubmat for ' || c.title,    'Design the announcement pubmat for ' || c.title || ' (' || c.date || '). Include the date and venue' || coalesce(' (' || c.location || ')', '') || '.', s - 7),
        ('gear',     'Prepare camera gear for ' || c.title,  'Charge batteries, clear memory cards and pack the cameras, lenses and tripods for ' || c.title || '.', s - 2),
        ('coverage', 'Cover ' || c.title,                    'Photos and video of the team during ' || c.title || ' (' || c.date || '). Upload everything to the shared Drive the same day.', s),
        ('recap',    'Post the recap of ' || c.title,        'Edit the best photos and clips and post the recap of ' || c.title || ' with the results.', s + 2)
      ) as v(key, title, instructions, due_day)
    loop
      due := ((k.due_day + time '18:00') at time zone 'Asia/Manila');
      insert into website.task_suggestions (competition_id, template_key, title, instructions, due_at)
      values (c.id, k.key, k.title, k.instructions, case when due > now() then due end)
      on conflict (competition_id, template_key) do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.generate_competition_tasks(), public.parse_competition_start(text) from public, anon;
grant execute on function public.generate_competition_tasks(), public.parse_competition_start(text) to authenticated;

-- Daily at 08:00 Manila time (00:00 UTC).
create extension if not exists pg_cron;
select cron.unschedule('competition-task-suggestions') where exists (select 1 from cron.job where jobname = 'competition-task-suggestions');
select cron.schedule('competition-task-suggestions', '0 0 * * *', 'select public.generate_competition_tasks()');
