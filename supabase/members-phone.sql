-- Mobile number collected on /member-reg (shown to admins on the Information page).
-- Like the other personal details it is private: anon and authenticated can only read id, name, image_url, is_active and
-- registration_status of website.members, so a new column is not readable from the browser. Only the server (service role) reads it.
alter table website.members add column if not exists phone text check (phone is null or char_length(phone) between 7 and 20);

-- Email, mobile number and student ID can each belong to only one live registration. A registration in the rejected archive
-- doesn't count, so a rejected person can register again. (members_student_id_unique already exists; see the earlier migration.)
create unique index if not exists members_email_unique on website.members (lower(email))
  where email is not null and registration_status is distinct from 'rejected';
create unique index if not exists members_phone_unique on website.members (phone)
  where phone is not null and registration_status is distinct from 'rejected';
