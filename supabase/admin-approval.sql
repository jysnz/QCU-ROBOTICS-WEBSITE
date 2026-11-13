-- Admin approval gate for the website's /admin area.
-- Run once in the Supabase SQL editor (project szbtmeyoctkscwjcdrvg). It is shared with the QCUR-Apex app.
--
-- Part 1 (required): adds public.user_accounts.is_approved. New sign-ups start unapproved and cannot
--                    open /admin until an approved admin approves them.
-- Part 2 (recommended): makes the database itself enforce it, so an unapproved account can no longer
--                    write to the website tables even by calling the API directly.

-- ───────────── Part 1: approval flag ─────────────
alter table public.user_accounts
  add column if not exists is_approved boolean not null default false;

-- Everyone who already has an account (the 23 current Apex users) keeps access.
update public.user_accounts set is_approved = true where is_approved = false;

-- A user can update their own user_accounts row, so stop them from approving themselves.
-- Only the service role (used by the website's server) or the SQL editor can change is_approved.
create or replace function public.protect_is_approved()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_approved := false;
  else
    new.is_approved := old.is_approved;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_is_approved on public.user_accounts;
create trigger protect_is_approved
  before insert or update on public.user_accounts
  for each row execute function public.protect_is_approved();

-- Helper used by the policies in Part 2.
create or replace function public.is_approved_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_accounts where id = auth.uid() and is_approved = true);
$$;
revoke all on function public.is_approved_admin() from public;
grant execute on function public.is_approved_admin() to authenticated;

-- ───────────── Part 2: enforce it in RLS (recommended) ─────────────
-- Replaces the "any authenticated user can write" policies on the website tables with
-- "approved admins only". Public (anon) read policies are not touched.
-- NOTE: the Apex mobile app uses the same policies, so after this an unapproved Apex account can no
-- longer edit website content either. Approve accounts from /admin -> Accounts.
do $$
declare
  t text;
  tables text[] := array[
    'Achievements','Coaches','achievements','competitions','descriptions','matches','media_team',
    'member_roles','member_team_seasons','roles','seasons','socials','sponsor_company','sponsors',
    'team_competitions','team_members','teams'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "Authenticated insert" on website.%I', t);
    execute format('drop policy if exists "Authenticated update" on website.%I', t);
    execute format('drop policy if exists "Authenticated delete" on website.%I', t);
    execute format('drop policy if exists "Allow authenticated insert" on website.%I', t);
    execute format('drop policy if exists "Allow authenticated update" on website.%I', t);
    execute format('drop policy if exists "Allow authenticated delete" on website.%I', t);
    execute format('create policy "Approved admins insert" on website.%I for insert to authenticated with check (public.is_approved_admin())', t);
    execute format('create policy "Approved admins update" on website.%I for update to authenticated using (public.is_approved_admin()) with check (public.is_approved_admin())', t);
    execute format('create policy "Approved admins delete" on website.%I for delete to authenticated using (public.is_approved_admin())', t);
  end loop;
end $$;

-- website.achievements (lowercase) only had authenticated read; keep that readable for approved admins too.

-- website.members: keep the "pending registrations are private" rules and add the admin check.
drop policy if exists "Authenticated insert members" on website.members;
drop policy if exists "Authenticated update members" on website.members;
drop policy if exists "Authenticated delete members" on website.members;
create policy "Approved admins insert members" on website.members for insert to authenticated
  with check (public.is_approved_admin() and registration_status is null);
create policy "Approved admins update members" on website.members for update to authenticated
  using (public.is_approved_admin() and registration_status is distinct from 'pending')
  with check (public.is_approved_admin() and registration_status is distinct from 'pending');
create policy "Approved admins delete members" on website.members for delete to authenticated
  using (public.is_approved_admin() and registration_status is distinct from 'pending');
