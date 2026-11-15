-- Rejected admin accounts go to an archive for 30 days, then are deleted for good (the purge runs from /api/admin/users).
-- A rejected account has rejected_at set and is_approved = false. Restoring clears rejected_at (back to "waiting").
-- Run after admin-approval.sql.

alter table public.user_accounts add column if not exists rejected_at timestamptz;

-- Like is_approved, only the server (service role) may change rejected_at: a rejected person can't clear it from the browser.
create or replace function public.protect_is_approved() returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_approved := false;
    new.rejected_at := null;
  else
    new.is_approved := old.is_approved;
    new.rejected_at := old.rejected_at;
  end if;
  return new;
end;
$$;

-- Every admin account must have a password (also Google sign-ins). has_password is set by the server when a password is
-- created or reset; Google-only accounts don't get an "email" identity from that, so the flag is the reliable record.
alter table public.user_accounts add column if not exists has_password boolean not null default false;
update public.user_accounts u set has_password = true
where exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

create or replace function public.protect_is_approved() returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_approved := false;
    new.rejected_at := null;
    new.has_password := false;
  else
    new.is_approved := old.is_approved;
    new.rejected_at := old.rejected_at;
    new.has_password := old.has_password;
  end if;
  return new;
end;
$$;
