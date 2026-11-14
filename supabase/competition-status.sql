-- A competition's status follows its date: before it -> Upcoming, during -> Active, after -> Completed.
-- The date is free text ("March 14-15, 2026", "March 28 - April 2, 2026", "May 2025"); an unreadable date keeps the old status.
create or replace function public.parse_competition_end(d text) returns date
language plpgsql immutable set search_path = public as $$
declare m text[]; mon text; dy text;
begin
  m := regexp_match(coalesce(d, ''), '([A-Za-z]{3,9})\.?\s+(\d{1,2})?(?:\s*[-–]\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2}))?,?\s*(\d{4})');
  if m is null then return null; end if;
  mon := left(coalesce(m[3], m[1]), 3);
  dy := coalesce(m[4], m[2]);
  if dy is null then  -- month and year only: the whole month counts, so use its last day
    return (to_date(mon || ' 1 ' || m[5], 'Mon DD YYYY') + interval '1 month - 1 day')::date;
  end if;
  return to_date(mon || ' ' || dy || ' ' || m[5], 'Mon DD YYYY');
exception when others then
  return null;
end $$;

create or replace function public.competition_status(d text, old text) returns text
language plpgsql stable set search_path = public as $$
declare s date; e date; today date := (now() at time zone 'Asia/Manila')::date;
begin
  s := public.parse_competition_start(d); e := public.parse_competition_end(d);
  if s is null or e is null then return old; end if;
  if e < today then return 'Completed'; end if;
  if s > today then return 'Upcoming'; end if;
  return 'Active';
end $$;

create or replace function website.set_competition_status() returns trigger
language plpgsql set search_path = public, website as $$
begin
  new.status := public.competition_status(new.date, new.status);
  return new;
end $$;

drop trigger if exists competitions_status on website.competitions;
create trigger competitions_status before insert or update of date on website.competitions
  for each row execute function website.set_competition_status();

update website.competitions set status = public.competition_status(date, status);

-- Every day just after midnight Manila time (16:00 UTC), move competitions along as their dates pass.
create extension if not exists pg_cron;
select cron.unschedule('competition-status') where exists (select 1 from cron.job where jobname = 'competition-status');
select cron.schedule('competition-status', '5 16 * * *',
  $$update website.competitions set status = public.competition_status(date, status) where status is distinct from public.competition_status(date, status)$$);
