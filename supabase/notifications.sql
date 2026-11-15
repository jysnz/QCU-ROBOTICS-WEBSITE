-- In-app notifications + Firebase Cloud Messaging (push) device tokens for the admin area.
-- Notifications are written by the server (service role). A person can read, mark read and delete only their own.

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,                       -- task_assigned, task_done, task_due, birthday, registration, access_request, account_approved ...
  title      text not null check (char_length(title) between 1 and 200),
  body       text,
  link       text,                                -- where it opens, e.g. /admin#tasks-todo
  dedupe_key text,                                -- stops the same event notifying the same person twice
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  unique (user_id, dedupe_key)                    -- NULL keys never collide
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;   -- the only thing a person may change

drop policy if exists "Notifications: own read" on public.notifications;
drop policy if exists "Notifications: own mark read" on public.notifications;
drop policy if exists "Notifications: own delete" on public.notifications;
create policy "Notifications: own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Notifications: own mark read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Notifications: own delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- One row per browser/device that turned push on. Only the server touches this table.
create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token        text not null unique,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- Live updates for the bell (the panel listens for new rows).
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
