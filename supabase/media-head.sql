-- One media head at a time, picked from the Media team page by the super admin. Run after competition-tasks.sql.
-- admin_roles.media_team_id records which Media team member the head is (the member itself has no login).
alter table website.admin_roles add column if not exists media_team_id bigint;

create or replace function public.set_media_head(uid uuid, member bigint) returns void
language plpgsql security definer set search_path = public, website as $$
begin
  if not public.is_super_admin() then raise exception 'Only the super admin can assign the media head.'; end if;
  if not public.is_approved_user(uid) then raise exception 'That account is not approved.'; end if;
  if exists (select 1 from website.admin_roles where user_id = uid and role = 'super_admin') then
    raise exception 'The super admin already has every media head permission.';
  end if;
  delete from website.admin_roles where role = 'media_head';
  insert into website.admin_roles (user_id, role, media_team_id, granted_by) values (uid, 'media_head', member, auth.uid());
end $$;

create or replace function public.clear_media_head() returns void
language plpgsql security definer set search_path = public, website as $$
begin
  if not public.is_super_admin() then raise exception 'Only the super admin can remove the media head.'; end if;
  delete from website.admin_roles where role = 'media_head';
end $$;

revoke all on function public.set_media_head(uuid, bigint), public.clear_media_head() from public, anon;
grant execute on function public.set_media_head(uuid, bigint), public.clear_media_head() to authenticated;
