-- Who can name a media head, and the hand-over between media heads.
-- Run in the Supabase SQL editor (safe to run again). Run after pending-roles.sql.
--
-- Rules
--   * There is one media head at a time. A head who has no account yet (saved in website.pending_roles) counts as the head.
--   * The super admin can name a media head only when there isn't one. To change the head, the super admin removes the current one first.
--   * The media head herself can name a new media head: the role is TRANSFERRED to them and she stops being head.
--   * Nobody else can name a media head. (Assistants are unchanged: the media head and the super admin add and remove them.)
--   * An approved person with an account becomes head straight away; someone with no account yet is saved against their email and
--     becomes head the moment they create one.

-- Someone who already has an account.
create or replace function public.set_media_head(uid uuid, member bigint) returns void
language plpgsql security definer set search_path = public, website as $$
declare
  caller uuid := auth.uid();
  caller_is_super boolean := public.is_super_admin();
  caller_is_head boolean := exists (select 1 from website.admin_roles where user_id = auth.uid() and role = 'media_head');
begin
  if not (caller_is_super or caller_is_head) then raise exception 'Only the super admin or the media head can assign the media head.'; end if;
  if not public.is_approved_user(uid) then raise exception 'That account is not approved.'; end if;
  if exists (select 1 from website.admin_roles where user_id = uid and role = 'super_admin') then
    raise exception 'The super admin already has every media head permission.';
  end if;
  if uid = caller then raise exception 'You are already the media head.'; end if;

  if caller_is_super then
    if exists (select 1 from website.admin_roles where role = 'media_head') or exists (select 1 from website.pending_roles where role = 'media_head') then
      raise exception 'There is already a media head. Remove them first.';
    end if;
  else
    delete from website.admin_roles where user_id = caller and role = 'media_head';   -- the head hands the role over
  end if;

  delete from website.admin_roles where user_id = uid;                                  -- an assistant simply moves up
  insert into website.admin_roles (user_id, role, media_team_id, granted_by) values (uid, 'media_head', member, caller);
end $$;

-- By email: straight away when the person has an account, saved for later when they don't. Returns 'granted' or 'pending'.
create or replace function public.assign_role_by_email(p_email text, p_role text, p_name text default null, p_media_team bigint default null) returns text
language plpgsql security definer set search_path = public, website as $$
declare
  mail text := lower(btrim(coalesce(p_email, '')));
  caller uuid := auth.uid();
  caller_is_super boolean := public.is_super_admin();
  caller_is_head boolean := exists (select 1 from website.admin_roles where user_id = auth.uid() and role = 'media_head');
  uid uuid;
  cur text;
begin
  if mail = '' then raise exception 'An email is needed.'; end if;
  if p_role = 'media_head' then
    if not (caller_is_super or caller_is_head) then raise exception 'Only the super admin or the media head can assign the media head.'; end if;
  elsif p_role = 'media_assistant' then
    if not public.is_media_head() then raise exception 'Only the media head can add assistants.'; end if;
  else
    raise exception 'Unknown role.';
  end if;

  select id into uid from public.user_accounts where lower(email) = mail and rejected_at is null limit 1;
  if uid is not null then
    select role into cur from website.admin_roles where user_id = uid;
    if cur = 'super_admin' then raise exception 'The super admin can already do everything.'; end if;
    if uid = caller and p_role = 'media_head' then raise exception 'You are already the media head.'; end if;
    if p_role = 'media_assistant' and cur is not null then raise exception 'That person already has a role.'; end if;
  end if;

  if p_role = 'media_head' then
    if caller_is_super then
      if exists (select 1 from website.admin_roles where role = 'media_head') or exists (select 1 from website.pending_roles where role = 'media_head') then
        raise exception 'There is already a media head. Remove them first.';
      end if;
    else
      delete from website.admin_roles where user_id = caller and role = 'media_head'; -- the head hands the role over
    end if;
  end if;

  if uid is not null then
    if p_role = 'media_head' then delete from website.admin_roles where user_id = uid; end if;   -- an assistant simply moves up
    insert into website.admin_roles (user_id, role, granted_by, media_team_id) values (uid, p_role, caller, case when p_role = 'media_head' then p_media_team end);
    delete from website.pending_roles where email = mail;
    return 'granted';
  end if;

  insert into website.pending_roles (email, full_name, role, granted_by, media_team_id) values (mail, nullif(btrim(coalesce(p_name, '')), ''), p_role, caller, case when p_role = 'media_head' then p_media_team end)
  on conflict (email) do update set role = excluded.role, full_name = excluded.full_name, granted_by = excluded.granted_by, media_team_id = excluded.media_team_id, created_at = now();
  return 'pending';
end $$;

-- The list of roles still waiting for an account, now with the Media team entry of a pending head (so its card can show it).
drop function if exists public.list_pending_roles();
create or replace function public.list_pending_roles() returns table (email text, full_name text, role text, media_team_id bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, website as $$
begin
  if not public.is_task_assigner() then return; end if;
  return query select p.email, p.full_name, p.role, p.media_team_id, p.created_at from website.pending_roles p order by p.created_at;
end $$;

revoke all on function public.set_media_head(uuid, bigint), public.assign_role_by_email(text, text, text, bigint), public.list_pending_roles() from public, anon;
grant execute on function public.set_media_head(uuid, bigint), public.assign_role_by_email(text, text, text, bigint), public.list_pending_roles() to authenticated;
