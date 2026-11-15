-- One-time codes emailed through Brevo: forgot password, change email, set a password for a Google-only account.
-- Only a keyed hash of each 6-digit code is stored. Codes expire after 10 minutes and are locked after 5 wrong tries.
-- Nothing here is readable from the browser: only the server (service role) uses this table.
create table if not exists public.otp_codes (
  id          uuid primary key default gen_random_uuid(),
  purpose     text not null check (purpose in ('reset', 'email_change', 'set_password')),
  email       text not null,                       -- where the code was sent
  user_id     uuid references auth.users(id) on delete cascade,
  code_hash   text not null,                       -- HMAC of the 6-digit code, never the code itself
  ticket_hash text,                                -- set once the code is verified; lets the next step run without the code
  payload     jsonb,
  attempts    int not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists otp_codes_lookup_idx on public.otp_codes (purpose, lower(email), created_at desc);
create index if not exists otp_codes_user_idx on public.otp_codes (user_id, purpose, created_at desc);
alter table public.otp_codes enable row level security;
revoke all on public.otp_codes from anon, authenticated;
