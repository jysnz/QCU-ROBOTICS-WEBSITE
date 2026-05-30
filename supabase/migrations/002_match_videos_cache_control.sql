-- Enforce long-lived cache headers for match videos so Supabase/CDN can serve them from cache.

create or replace function public.set_match_videos_cache_control()
returns trigger
language plpgsql
as $$
begin
  if new.bucket_id = 'match-videos' then
    new.metadata := jsonb_set(
      coalesce(new.metadata, '{}'::jsonb),
      '{cacheControl}',
      to_jsonb('31536000'::text),
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_match_videos_cache_control on storage.objects;

create trigger trg_set_match_videos_cache_control
before insert or update on storage.objects
for each row
execute function public.set_match_videos_cache_control();

update storage.objects
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{cacheControl}',
  to_jsonb('31536000'::text),
  true
)
where bucket_id = 'match-videos';