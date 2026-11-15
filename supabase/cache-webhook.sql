-- Instant refresh of the cached public website.
-- After every INSERT / UPDATE / DELETE on a public table, the database tells the website (through pg_net) which table changed;
-- the website's /api/revalidate then expires that table's cache tag, so the next visit rebuilds with fresh data.
-- Works for every write, wherever it comes from (admin pages, API routes, SQL). A failed call never stops a write.
--
-- BEFORE running: replace __REVALIDATE_SECRET__ with the same random value you set as REVALIDATE_SECRET in Vercel / .env.local.
-- (The real value is deliberately not stored in this file.)

create extension if not exists pg_net;

create table if not exists website.cache_config (key text primary key, value text not null);
alter table website.cache_config enable row level security;
revoke all on website.cache_config from anon, authenticated;   -- only the database itself reads it

insert into website.cache_config (key, value) values
  ('revalidate_url', 'https://www.qcurobotics.website/api/revalidate'),
  ('revalidate_secret', '__REVALIDATE_SECRET__')
on conflict (key) do update set value = excluded.value;

create or replace function website.notify_revalidate() returns trigger
language plpgsql security definer
set search_path = website, extensions, net, public
as $$
declare u text; s text;
begin
  select value into u from website.cache_config where key = 'revalidate_url';
  select value into s from website.cache_config where key = 'revalidate_secret';
  if u is not null and s is not null then
    perform net.http_post(
      url := u,
      headers := jsonb_build_object('content-type', 'application/json', 'x-revalidate-secret', s),
      body := jsonb_build_object('table', tg_table_name),
      timeout_milliseconds := 5000
    );
  end if;
  return null;
exception when others then
  return null; -- telling the website is best effort: it must never stop an edit from saving
end;
$$;
revoke all on function website.notify_revalidate() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['Achievements','achievements','Coaches','competitions','descriptions','matches','media_team','member_roles','member_team_seasons','members','roles','seasons','socials','sponsor_company','sponsors','team_competitions','team_members','teams']
  loop
    execute format('drop trigger if exists revalidate_site on website.%I', t);
    execute format('create trigger revalidate_site after insert or update or delete on website.%I for each statement execute function website.notify_revalidate()', t);
  end loop;
end $$;

drop trigger if exists revalidate_site on public.user_accounts;
create trigger revalidate_site after insert or update or delete on public.user_accounts for each statement execute function website.notify_revalidate();
