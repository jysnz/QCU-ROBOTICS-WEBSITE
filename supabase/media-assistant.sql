-- Media assistants: people the media head names to assign tasks on the head's behalf. Run after media-head.sql.
-- The super admin, the media head and assistants can assign tasks and act on competition prompts.
-- Only the media head (and the super admin) can add or remove assistants; only the head and super admin edit templates.

alter table website.admin_roles drop constraint if exists admin_roles_role_check;
alter table website.admin_roles add constraint admin_roles_role_check check (role in ('super_admin', 'media_head', 'media_assistant'));

create or replace function public.is_task_assigner() returns boolean
language sql stable security definer set search_path = public, website as $$
  select exists (select 1 from website.admin_roles where user_id = auth.uid() and role in ('super_admin', 'media_head', 'media_assistant'));
$$;
revoke all on function public.is_task_assigner() from public, anon;
grant execute on function public.is_task_assigner() to authenticated;

drop policy if exists "Tasks: heads create" on website.tasks;
drop policy if exists "Tasks: assigners create" on website.tasks;
create policy "Tasks: assigners create" on website.tasks for insert to authenticated
  with check (public.is_approved_admin() and public.is_task_assigner() and created_by = auth.uid());

drop policy if exists "Assignees: creator adds" on website.task_assignees;
create policy "Assignees: creator adds" on website.task_assignees for insert to authenticated
  with check (public.is_approved_admin() and public.is_task_assigner() and public.is_task_creator(task_id) and public.is_approved_user(user_id));

drop policy if exists "Suggestions: media head reads" on website.task_suggestions;
drop policy if exists "Suggestions: media head updates" on website.task_suggestions;
drop policy if exists "Suggestions: assigners read" on website.task_suggestions;
drop policy if exists "Suggestions: assigners update" on website.task_suggestions;
create policy "Suggestions: assigners read" on website.task_suggestions for select to authenticated
  using (public.is_approved_admin() and public.is_task_assigner());
create policy "Suggestions: assigners update" on website.task_suggestions for update to authenticated
  using (public.is_approved_admin() and public.is_task_assigner()) with check (public.is_task_assigner());

drop policy if exists "Roles: heads name assistants" on website.admin_roles;
drop policy if exists "Roles: heads remove assistants" on website.admin_roles;
create policy "Roles: heads name assistants" on website.admin_roles for insert to authenticated
  with check (public.is_media_head() and role = 'media_assistant' and public.is_approved_user(user_id));
create policy "Roles: heads remove assistants" on website.admin_roles for delete to authenticated
  using (public.is_media_head() and role = 'media_assistant');

-- A new head who was an assistant simply moves up.
create or replace function public.set_media_head(uid uuid, member bigint) returns void
language plpgsql security definer set search_path = public, website as $$
begin
  if not public.is_super_admin() then raise exception 'Only the super admin can assign the media head.'; end if;
  if not public.is_approved_user(uid) then raise exception 'That account is not approved.'; end if;
  if exists (select 1 from website.admin_roles where user_id = uid and role = 'super_admin') then
    raise exception 'The super admin already has every media head permission.';
  end if;
  delete from website.admin_roles where role = 'media_head' or user_id = uid;
  insert into website.admin_roles (user_id, role, media_team_id, granted_by) values (uid, 'media_head', member, auth.uid());
end $$;
