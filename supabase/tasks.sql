-- Tasks for the /admin area ("Assign" and "To do", like Google Classroom).
-- A member creates a task, picks which teammates (approved admin accounts) it goes to, and each assignee
-- sees it under To do and marks it done. Run once in the Supabase SQL editor. Requires admin-approval.sql first.

create table if not exists website.tasks (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  instructions text check (instructions is null or char_length(instructions) <= 5000),
  due_at      timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists website.task_assignees (
  task_id  uuid not null references website.tasks(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  status   text not null default 'assigned' check (status in ('assigned', 'done')),
  done_at  timestamptz,
  primary key (task_id, user_id)
);
create index if not exists task_assignees_user_idx on website.task_assignees (user_id);
create index if not exists tasks_created_by_idx on website.tasks (created_by);

-- Helpers are SECURITY DEFINER so the two tables' policies can look at each other without recursing.
create or replace function public.is_task_creator(tid uuid) returns boolean
language sql stable security definer set search_path = public, website as $$
  select exists (select 1 from website.tasks where id = tid and created_by = auth.uid());
$$;
create or replace function public.is_task_assignee(tid uuid) returns boolean
language sql stable security definer set search_path = public, website as $$
  select exists (select 1 from website.task_assignees where task_id = tid and user_id = auth.uid());
$$;
create or replace function public.is_approved_user(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_accounts where id = uid and is_approved = true);
$$;
revoke all on function public.is_task_creator(uuid), public.is_task_assignee(uuid), public.is_approved_user(uuid) from public, anon;
grant execute on function public.is_task_creator(uuid), public.is_task_assignee(uuid), public.is_approved_user(uuid) to authenticated;

alter table website.tasks enable row level security;
alter table website.task_assignees enable row level security;

revoke all on website.tasks, website.task_assignees from anon;
revoke update on website.task_assignees from authenticated;
grant update (status, done_at) on website.task_assignees to authenticated; -- assignees can only flip their own status

drop policy if exists "Tasks: creator or assignee reads" on website.tasks;
drop policy if exists "Tasks: admins create" on website.tasks;
drop policy if exists "Tasks: creator edits" on website.tasks;
drop policy if exists "Tasks: creator deletes" on website.tasks;
create policy "Tasks: creator or assignee reads" on website.tasks for select to authenticated
  using (public.is_approved_admin() and (created_by = auth.uid() or public.is_task_assignee(id)));
create policy "Tasks: admins create" on website.tasks for insert to authenticated
  with check (public.is_approved_admin() and created_by = auth.uid());
create policy "Tasks: creator edits" on website.tasks for update to authenticated
  using (public.is_approved_admin() and created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Tasks: creator deletes" on website.tasks for delete to authenticated
  using (public.is_approved_admin() and created_by = auth.uid());

drop policy if exists "Assignees: creator or self reads" on website.task_assignees;
drop policy if exists "Assignees: creator adds" on website.task_assignees;
drop policy if exists "Assignees: self updates status" on website.task_assignees;
drop policy if exists "Assignees: creator removes" on website.task_assignees;
create policy "Assignees: creator or self reads" on website.task_assignees for select to authenticated
  using (public.is_approved_admin() and (user_id = auth.uid() or public.is_task_creator(task_id)));
create policy "Assignees: creator adds" on website.task_assignees for insert to authenticated
  with check (public.is_approved_admin() and public.is_task_creator(task_id) and public.is_approved_user(user_id));
create policy "Assignees: self updates status" on website.task_assignees for update to authenticated
  using (public.is_approved_admin() and user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Assignees: creator removes" on website.task_assignees for delete to authenticated
  using (public.is_approved_admin() and public.is_task_creator(task_id));

-- Later change (run after competition-tasks.sql): only the super admin and the media head can assign tasks.
drop policy if exists "Tasks: admins create" on website.tasks;
drop policy if exists "Tasks: heads create" on website.tasks;
create policy "Tasks: heads create" on website.tasks for insert to authenticated
  with check (public.is_approved_admin() and public.is_media_head() and created_by = auth.uid());
drop policy if exists "Assignees: creator adds" on website.task_assignees;
create policy "Assignees: creator adds" on website.task_assignees for insert to authenticated
  with check (public.is_approved_admin() and public.is_media_head() and public.is_task_creator(task_id) and public.is_approved_user(user_id));
