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
