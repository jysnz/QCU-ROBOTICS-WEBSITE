-- Rejected registrations go to an archive (registration_status = 'rejected') for 30 days, then are deleted for good
-- (the purge runs from /api/admin/registrations, which also removes the photos from storage).
-- Rejected rows are private exactly like pending ones: only the service role can see them.

alter table website.members add column if not exists rejected_at timestamptz;

drop policy if exists "Public read non-pending members" on website.members;
create policy "Public read non-pending members" on website.members for select to anon, authenticated
  using (registration_status is null or registration_status not in ('pending', 'rejected'));

drop policy if exists "Approved admins update members" on website.members;
create policy "Approved admins update members" on website.members for update to authenticated
  using (public.is_approved_admin() and (registration_status is null or registration_status not in ('pending', 'rejected')))
  with check (public.is_approved_admin() and (registration_status is null or registration_status not in ('pending', 'rejected')));

drop policy if exists "Approved admins delete members" on website.members;
create policy "Approved admins delete members" on website.members for delete to authenticated
  using (public.is_approved_admin() and (registration_status is null or registration_status not in ('pending', 'rejected')));
