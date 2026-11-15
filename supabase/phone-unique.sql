-- A mobile number can belong to only one live registration.
-- Run in the Supabase SQL editor (safe to run again).
--
-- The uniqueness itself already exists: members_phone_unique (see members-phone.sql) refuses a second live registration with the
-- same number. A registration in the rejected archive doesn't count, so a rejected person can register again.
--
-- That index compares the stored text exactly, so "0917 123 4567" and "09171234567" would count as two different numbers. The
-- website always saves a number as 09XXXXXXXXX, and this rule makes the database insist on it too: whoever writes to the table
-- (the website, an import, the SQL editor) can only store one spelling of a number, so the index above always catches a repeat.
alter table website.members drop constraint if exists members_phone_format;
alter table website.members
  add constraint members_phone_format check (phone is null or phone ~ '^09[0-9]{9}$');
