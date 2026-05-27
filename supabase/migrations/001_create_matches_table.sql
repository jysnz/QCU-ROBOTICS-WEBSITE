-- Create matches table with corrected schema
create table public.matches (
  id bigint generated always as identity not null,
  competition_id bigint null,
  name text not null,
  our_score integer null default 0,
  opponent_score integer null default 0,
  opponent_name text null,
  result text GENERATED ALWAYS as (
    case
      when (our_score > opponent_score) then 'Win'::text
      when (our_score < opponent_score) then 'Loss'::text
      else 'Draw'::text
    end
  ) STORED,
  video_url text null,
  created_at timestamp with time zone null default now(),
  team_id bigint null,
  constraint matches_pkey primary key (id),
  constraint matches_competition_id_fkey foreign KEY (competition_id) references competitions (id) on delete CASCADE,
  constraint matches_team_id_fkey foreign KEY (team_id) references teams (id) on update CASCADE on delete CASCADE
) TABLESPACE pg_default;
