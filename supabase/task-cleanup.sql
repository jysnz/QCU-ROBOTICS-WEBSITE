-- Tasks follow the person: when someone is removed, the tasks assigned to them are removed too.
-- Run in the Supabase SQL editor (safe to run again).
--
-- "Removed" means any of:
--   * their registration is deleted or rejected (website.members) -> the account with the same email loses its tasks
--   * their admin account is deleted, rejected (archived) or un-approved (public.user_accounts)
-- A task that was assigned to nobody else is deleted with them (its files and hand-ins go with it); a task shared with other
-- people stays, just without that person. Accounts that hold an admin role (super admin, media head, assistant) are never
-- affected by a member being removed, so running the site can't be broken by deleting someone's registration.

create or replace function website.drop_person_tasks(p_user uuid)
returns void
language sql
security definer
set search_path = website, public
as $$
  with gone as (
    delete from website.task_assignees where user_id = p_user returning task_id
  )
  delete from website.tasks t
  where t.id in (select task_id from gone)
    and not exists (select 1 from website.task_assignees a where a.task_id = t.id);
$$;
revoke all on function website.drop_person_tasks(uuid) from public, anon, authenticated;

-- a registration is deleted or rejected
create or replace function website.members_drop_tasks()
returns trigger
language plpgsql
security definer
set search_path = website, public
as $$
declare
  mail text := lower(btrim(coalesce(old.email, '')));
  uid uuid;
begin
  if mail = '' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and not (new.registration_status = 'rejected' and old.registration_status is distinct from 'rejected') then
    return new;
  end if;
  for uid in
    select u.id from public.user_accounts u
    where lower(btrim(u.email)) = mail
      and not exists (select 1 from website.admin_roles r where r.user_id = u.id)
      and not exists (select 1 from website.members m2 where m2.id <> old.id and lower(btrim(m2.email)) = mail and coalesce(m2.registration_status, '') <> 'rejected')
  loop
    perform website.drop_person_tasks(uid);
  end loop;
  return coalesce(new, old);
end;
$$;
drop trigger if exists members_drop_tasks_del on website.members;
create trigger members_drop_tasks_del after delete on website.members
  for each row execute function website.members_drop_tasks();
drop trigger if exists members_drop_tasks_rej on website.members;
create trigger members_drop_tasks_rej after update of registration_status on website.members
  for each row execute function website.members_drop_tasks();

-- an admin account is deleted, rejected (archived) or un-approved
create or replace function public.accounts_drop_tasks()
returns trigger
language plpgsql
security definer
set search_path = website, public
as $$
begin
  if tg_op = 'DELETE' then
    perform website.drop_person_tasks(old.id);
    return old;
  end if;
  if (new.rejected_at is not null and old.rejected_at is null) or (old.is_approved is true and new.is_approved is not true) then
    perform website.drop_person_tasks(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists accounts_drop_tasks_del on public.user_accounts;
create trigger accounts_drop_tasks_del before delete on public.user_accounts
  for each row execute function public.accounts_drop_tasks();
drop trigger if exists accounts_drop_tasks_upd on public.user_accounts;
create trigger accounts_drop_tasks_upd after update of rejected_at, is_approved on public.user_accounts
  for each row execute function public.accounts_drop_tasks();
