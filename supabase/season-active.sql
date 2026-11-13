-- Marks which season(s) are currently running. Team assignments in /admin can only be added to active seasons.
-- Run once in the Supabase SQL editor (project szbtmeyoctkscwjcdrvg).
alter table website.seasons
  add column if not exists is_active boolean not null default false;

-- Only the current season (Override) is active right now.
update website.seasons set is_active = (season_name = 'Override');

-- Afterwards, switch seasons on and off from /admin -> Competitions -> Seasons ("Active season").
