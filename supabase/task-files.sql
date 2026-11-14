-- File attachments for tasks. Run after tasks.sql.
-- Files live in a PRIVATE Supabase Storage bucket ("task-files"), at <task id>/<random>-<file name>.
-- Only the task's creator and its assignees can read them; only the creator can add or remove them.

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 26214400) -- 25 MB per file
on conflict (id) do update set public = false, file_size_limit = 26214400;

create table if not exists website.task_files (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references website.tasks(id) on delete cascade,
  path       text not null unique,
  name       text not null check (char_length(name) between 1 and 255),
  size       bigint not null default 0,
  mime       text,
  created_at timestamptz not null default now()
);
create index if not exists task_files_task_idx on website.task_files (task_id);

alter table website.task_files enable row level security;
revoke all on website.task_files from anon;

drop policy if exists "Files: creator or assignee reads" on website.task_files;
drop policy if exists "Files: creator adds" on website.task_files;
drop policy if exists "Files: creator removes" on website.task_files;
create policy "Files: creator or assignee reads" on website.task_files for select to authenticated
  using (public.is_approved_admin() and (public.is_task_creator(task_id) or public.is_task_assignee(task_id)));
create policy "Files: creator adds" on website.task_files for insert to authenticated
  with check (public.is_approved_admin() and public.is_task_creator(task_id));
create policy "Files: creator removes" on website.task_files for delete to authenticated
  using (public.is_approved_admin() and public.is_task_creator(task_id));

-- Storage: the first folder of the object path is the task id.
create or replace function public.task_of_object(obj_name text) returns uuid
language sql immutable as $$
  select case when (storage.foldername(obj_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then ((storage.foldername(obj_name))[1])::uuid end;
$$;
grant execute on function public.task_of_object(text) to authenticated;

drop policy if exists "task-files read" on storage.objects;
drop policy if exists "task-files upload" on storage.objects;
drop policy if exists "task-files delete" on storage.objects;
create policy "task-files read" on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and public.is_approved_admin()
         and (public.is_task_creator(public.task_of_object(name)) or public.is_task_assignee(public.task_of_object(name))));
create policy "task-files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and public.is_approved_admin() and public.is_task_creator(public.task_of_object(name)));
create policy "task-files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and public.is_approved_admin() and public.is_task_creator(public.task_of_object(name)));
