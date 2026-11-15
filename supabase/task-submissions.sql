-- Files an assignee attaches when they mark a task done. Run after task-files.sql.
-- Files live next to the task's own attachments, under <task id>/submissions/<user id>/...
-- (private Supabase Storage bucket "task-files", or the "tasks" bucket on Cloudflare R2).
-- Only the person who submitted and the task's creator can see a submission; only that person can add or remove it.

create table if not exists website.task_submissions (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references website.tasks(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  path       text not null unique,
  name       text not null check (char_length(name) between 1 and 255),
  size       bigint not null default 0,
  mime       text,
  store      text not null default 'supabase' check (store in ('supabase', 'r2')),
  created_at timestamptz not null default now()
);
create index if not exists task_submissions_task_idx on website.task_submissions (task_id, user_id);

alter table website.task_submissions enable row level security;
revoke all on website.task_submissions from anon;

drop policy if exists "Submissions: owner or creator reads" on website.task_submissions;
drop policy if exists "Submissions: assignee adds" on website.task_submissions;
drop policy if exists "Submissions: owner removes" on website.task_submissions;
create policy "Submissions: owner or creator reads" on website.task_submissions for select to authenticated
  using (public.is_approved_admin() and (user_id = auth.uid() or public.is_task_creator(task_id)));
create policy "Submissions: assignee adds" on website.task_submissions for insert to authenticated
  with check (public.is_approved_admin() and user_id = auth.uid() and public.is_task_assignee(task_id));
create policy "Submissions: owner removes" on website.task_submissions for delete to authenticated
  using (public.is_approved_admin() and user_id = auth.uid());

-- Storage: submissions/<user id> is the 2nd and 3rd folder of the object path.
-- The task's general read policy now skips submissions, so other assignees can't open someone else's files.
drop policy if exists "task-files read" on storage.objects;
create policy "task-files read" on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and public.is_approved_admin()
         and (public.is_task_creator(public.task_of_object(name))
              or (public.is_task_assignee(public.task_of_object(name))
                  and ((storage.foldername(name))[2] is distinct from 'submissions' or (storage.foldername(name))[3] = auth.uid()::text))));

drop policy if exists "task-files submit" on storage.objects;
drop policy if exists "task-files unsubmit" on storage.objects;
create policy "task-files submit" on storage.objects for insert to authenticated
  with check (bucket_id = 'task-files' and public.is_approved_admin()
              and (storage.foldername(name))[2] = 'submissions' and (storage.foldername(name))[3] = auth.uid()::text
              and public.is_task_assignee(public.task_of_object(name)));
create policy "task-files unsubmit" on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and public.is_approved_admin()
         and (storage.foldername(name))[2] = 'submissions' and (storage.foldername(name))[3] = auth.uid()::text);
