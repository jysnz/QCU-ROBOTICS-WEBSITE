-- Optional photo of the award for each achievement. The admin uploads the picture to the "images" storage bucket
-- and saves its public URL here. Run once in the Supabase SQL editor (project szbtmeyoctkscwjcdrvg).
alter table website."Achievements"
  add column if not exists image_url text;
