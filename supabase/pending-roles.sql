-- Name a media head or an assistant BEFORE they have an account.
-- Run in the Supabase SQL editor (safe to run again). Run after media-assistant.sql.
--
-- The Assign page lists everyone who registered at /member-reg. Picking someone who already has an account gives them the role
-- straight away. Picking someone who hasn't made an account yet saves a "pending role" against their email; the moment an account
-- with that email is created (email + password sign-up or Google), the role is given to it automatically.
-- A role does nothing until the account is approved, so approval stays the gate to the admin area.

create table if not exists website.pending_roles (
  email text primary key,                                   -- lower-case
  full_name text,
  role text not null check (role in ('media_head', 'media_assistant')),
  media_team_id bigint,                                     -- media head only: which Media team entry this person is (as in media-head.sql)
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table website.pending_roles enable row level security;   -- no policies on purpose: only the functions below read or write it
revoke all on website.pending_roles from anon, authenticated;

-- Give a role by email: straight away when the person has an account, saved for later when they don't.
-- Only the super admin can name a media head; the media head (or super admin) can add assistants. Returns 'granted' or 'pending'.
create or replace function public.assign_role_by_email(p_email text, p_role text, p_name text default null, p_media_team bigint default null) returns text
language plpgsql security definer set search_path = public, website as $$
declare
  mail text := lower(btrim(coalesce(p_email, '')));
  uid uuid;
  cur text;
begin
  if mail = '' then raise exception 'An email is needed.'; end if;
  if p_role = 'media_head' then
    if not public.is_super_admin() then raise exception 'Only the super admin can assign the media head.'; end if;
  elsif p_role = 'media_assistant' then
    if not public.is_media_head() then raise exception 'Only the media head can add assistants.'; end if;
  else
    raise exception 'Unknown role.';
  end if;

  select id into uid from public.user_accounts where lower(email) = mail and rejected_at is null limit 1;
  if uid is not null then
    select role into cur from website.admin_roles where user_id = uid;
    if cur = 'super_admin' then raise exception 'The super admin can already do everything.'; end if;
    if p_role = 'media_assistant' and cur is not null then raise exception 'That person already has a role.'; end if;
    if p_role = 'media_head' then
      delete from website.admin_roles where role = 'media_head' or user_id = uid;   -- one head at a time; an assistant simply moves up
      delete from website.pending_roles where role = 'media_head';
    end if;
    insert into website.admin_roles (user_id, role, granted_by, media_team_id) values (uid, p_role, auth.uid(), case when p_role = 'media_head' then p_media_team end);
    delete from website.pending_roles where email = mail;
    return 'granted';
  end if;

  if p_role = 'media_head' then delete from website.pending_roles where role = 'media_head'; end if;
  insert into website.pending_roles (email, full_name, role, granted_by, media_team_id) values (mail, nullif(btrim(coalesce(p_name, '')), ''), p_role, auth.uid(), case when p_role = 'media_head' then p_media_team end)
  on conflict (email) do update set role = excluded.role, full_name = excluded.full_name, granted_by = excluded.granted_by, media_team_id = excluded.media_team_id, created_at = now();
  return 'pending';
end $$;

-- Take back a role that is still waiting for an account. The media head can cancel assistants; only the super admin can cancel a head.
create or replace function public.clear_pending_role(p_email text) returns void
language plpgsql security definer set search_path = public, website as $$
begin
  if not public.is_media_head() then raise exception 'Only the media head can do that.'; end if;
  delete from website.pending_roles
   where email = lower(btrim(coalesce(p_email, ''))) and (role = 'media_assistant' or public.is_super_admin());
end $$;

-- Who is waiting for an account (for people who can assign tasks).
create or replace function public.list_pending_roles() returns table (email text, full_name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, website as $$
begin
  if not public.is_task_assigner() then return; end if;
  return query select p.email, p.full_name, p.role, p.created_at from website.pending_roles p order by p.created_at;
end $$;

-- When an account is created (or its email changes), hand over a role that was saved for that email.
-- Never allowed to get in the way of signing up: any problem here is only logged.
create or replace function website.apply_pending_role() returns trigger
language plpgsql security definer set search_path = public, website as $$
declare p website.pending_roles%rowtype;
begin
  begin
    select * into p from website.pending_roles where email = lower(btrim(coalesce(new.email, '')));
    if found then
      if not exists (select 1 from website.admin_roles where user_id = new.id and role = 'super_admin') then
        if p.role = 'media_head' then delete from website.admin_roles where role = 'media_head' or user_id = new.id; end if;
        insert into website.admin_roles (user_id, role, granted_by, media_team_id) values (new.id, p.role, p.granted_by, p.media_team_id) on conflict (user_id) do nothing;
      end if;
      delete from website.pending_roles where email = p.email;
    end if;
  exception when others then
    raise warning 'apply_pending_role failed: %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists accounts_apply_pending_role on public.user_accounts;
create trigger accounts_apply_pending_role after insert or update of email on public.user_accounts
  for each row execute function website.apply_pending_role();

revoke all on function public.assign_role_by_email(text, text, text, bigint), public.clear_pending_role(text), public.list_pending_roles() from public, anon;
grant execute on function public.assign_role_by_email(text, text, text, bigint), public.clear_pending_role(text), public.list_pending_roles() to authenticated;
