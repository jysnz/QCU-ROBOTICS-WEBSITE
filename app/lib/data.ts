import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'website' },
});

export type HeroStats = {
  competitions: number;
  internationalAwards: number;
  teamMembers: number;
  nationalAwards: number;
  seasons: number;
};

export type Competition = {
  id: number;
  title: string;
  status: string;
  date: string;
  location: string;
  created_at: string;
  image_url: string | null;
  season_id: number | null;
  seasons: { id: number; season_name: string } | { id: number; season_name: string }[] | null;
};

export type Season = {
  id: number;
  season_name: string;
};

export type TeamMember = {
  id: number;
  name: string;
  profile_image_url: string | null;
  is_graduated: boolean;
  is_active: boolean;
  member_roles: {
    role_id: number;
    season_id: number;
    roles: { id: number; role_name: string } | null;
  }[];
  member_team_seasons: {
    team_id: number;
    season_id: number;
    teams: { id: number; team_name: string; team_number: number; team_code: string | null; is_active: boolean } | null;
    seasons: { id: number; season_name: string } | null;
  }[];
};

export type MediaMember = {
  id: number;
  name: string;
  position: string | null;
  image_url: string | null;
  is_active: boolean;
};

export type Member = {
  id: number;
  name: string;
  image_url: string | null;
  is_active: boolean;
};

export type Coach = {
  id: number;
  name: string;
  image_url: string | null;
  role: string | null;
};

export type SponsorCompany = {
  id: number;
  company_name: string;
  image_url: string | null;
  website_url: string | null;
};

/* ───────────────────────────────────────────────────────────────────────────
   Public data, cached across visitors.
   - unstable_cache keeps each result in Next's data cache (shared by every visitor, survives between requests) and tags it with the
     database table(s) it reads. When an admin changes a table, a database webhook calls /api/revalidate, which expires that table's
     tag, so the next visit rebuilds the page with fresh data. The hourly `revalidate` is only a safety net.
   - The cached function THROWS on a database error: an error is never cached (a hiccup must not freeze an empty page for an hour).
     The wrapper then returns an empty list for that one request.
   - React's cache() on the outside still de-duplicates repeat calls inside a single render.
   Tags are the table names, exactly as the webhook sends them. */
const REVALIDATE_SECONDS = 3600;

function keep<T>(label: string, tags: string[], load: () => Promise<T>, empty: T): () => Promise<T> {
  const cached = unstable_cache(load, ['public-data', label], { tags, revalidate: REVALIDATE_SECONDS });
  return cache(async () => {
    try {
      return await cached();
    } catch (e) {
      console.error(`[Data] ${label} error:`, (e as Error).message);
      return empty;
    }
  });
}

/** Fetch hero stats (counts) */
export const getHeroStats = keep<HeroStats>(
  'hero-stats',
  ['competitions', 'Achievements', 'team_members', 'members', 'media_team', 'seasons'],
  async () => {
    const [
      competitionsResult,
      internationalAwardsResult,
      teamPlayersResult,
      membersResult,
      mediaTeamResult,
      nationalAwardsResult,
      seasonsResult,
    ] = await Promise.all([
      supabase.from('competitions').select('id', { count: 'exact', head: true }),
      supabase.from('Achievements').select('achievement_id', { count: 'exact', head: true }).eq('international_award', true),
      supabase.from('team_members').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('media_team').select('id', { count: 'exact', head: true }),
      supabase.from('Achievements').select('achievement_id', { count: 'exact', head: true }).eq('national_award', true),
      supabase.from('seasons').select('id', { count: 'exact', head: true }),
    ]);

    const failed = [competitionsResult, internationalAwardsResult, teamPlayersResult, membersResult, mediaTeamResult, nationalAwardsResult, seasonsResult].find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);

    const totalMembers = (teamPlayersResult.count ?? 0) + (membersResult.count ?? 0) + (mediaTeamResult.count ?? 0);
    return {
      competitions: competitionsResult.count ?? 0,
      internationalAwards: internationalAwardsResult.count ?? 0,
      teamMembers: totalMembers,
      nationalAwards: nationalAwardsResult.count ?? 0,
      seasons: seasonsResult.count ?? 0,
    };
  },
  { competitions: 0, internationalAwards: 0, teamMembers: 0, nationalAwards: 0, seasons: 0 },
);

/** Fetch all seasons */
export const getSeasons = keep<Season[]>(
  'seasons',
  ['seasons'],
  async () => {
    const { data, error } = await supabase.from('seasons').select('*').order('id', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  [],
);

/** Fetch all competitions with seasons */
export const getCompetitions = keep<Competition[]>(
  'competitions',
  ['competitions', 'seasons'],
  async () => {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title, status, date, location, created_at, image_url, season_id, seasons ( id, season_name )')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Competition[];
  },
  [],
);

/** Fetch team members */
export const getTeamMembers = keep<TeamMember[]>(
  'team-members',
  ['team_members', 'member_roles', 'member_team_seasons', 'teams', 'roles', 'seasons'],
  async () => {
    // Must include the membership relations: the client groups members by
    // team/season and renders nothing for rows without `member_team_seasons`.
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        id,
        name,
        profile_image_url,
        is_graduated,
        is_active,
        member_roles (
          role_id,
          season_id,
          roles (
            id,
            role_name
          )
        ),
        member_team_seasons (
          team_id,
          season_id,
          teams (
            id,
            team_name,
            team_number,
            team_code,
            is_active
          ),
          seasons (
            id,
            season_name
          )
        )
      `)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as TeamMember[];
  },
  [],
);

/** Fetch media team */
export const getMediaTeam = keep<MediaMember[]>(
  'media-team',
  ['media_team'],
  async () => {
    const { data, error } = await supabase.from('media_team').select('*').order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as MediaMember[];
  },
  [],
);

/** Fetch members */
export const getMembers = keep<Member[]>(
  'members',
  ['members'],
  async () => {
    const { data, error } = await supabase
      .from('members')
      // Explicit columns only: the anon role may read just these. Registration data
      // (email, birthday, student ID, ...) is private, so select('*') is denied.
      .select('id, name, image_url, is_active')
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Member[];
  },
  [],
);

/** Fetch coaches */
export const getCoaches = keep<Coach[]>(
  'coaches',
  ['Coaches'],
  async () => {
    const { data, error } = await supabase.from('Coaches').select('*').order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Coach[];
  },
  [],
);

/** Fetch sponsor companies */
export const getSponsors = keep<SponsorCompany[]>(
  'sponsors',
  ['sponsor_company'],
  async () => {
    const { data, error } = await supabase.from('sponsor_company').select('*').order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorCompany[];
  },
  [],
);

/** Counts of what is active right now, for the About section (null when the database couldn't be reached, so the page can fall back). */
export type ActiveCounts = { teams: number; members: number };
export const getActiveCounts = keep<ActiveCounts | null>(
  'active-counts',
  ['teams', 'team_members', 'members', 'media_team'],
  async () => {
    const [teams, players, members, media] = await Promise.all([
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('media_team').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    const failed = [teams, players, members, media].find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    return { teams: teams.count ?? 0, members: (players.count ?? 0) + (members.count ?? 0) + (media.count ?? 0) };
  },
  null,
);

/** The people who represent each sponsor company. */
export type SponsorPerson = { id: number; name: string; image_url: string | null; company_id: number | null };
export const getSponsorPeople = keep<SponsorPerson[]>(
  'sponsor-people',
  ['sponsors'],
  async () => {
    const { data, error } = await supabase.from('sponsors').select('id, name, image_url, company_id').order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SponsorPerson[];
  },
  [],
);

/** The footer's social links. */
export type Social = { platform: string; url: string | null };
export const getSocials = keep<Social[]>(
  'socials',
  ['socials'],
  async () => {
    const { data, error } = await supabase.from('socials').select('platform, url').order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Social[];
  },
  [],
);

/** The editable wording of the site (Admin > Page text), keyed by section name, e.g. hero_description. */
export type Descriptions = Record<string, string>;
export const getDescriptions = keep<Descriptions>(
  'descriptions',
  ['descriptions'],
  async () => {
    const { data, error } = await supabase.from('descriptions').select('section, description');
    if (error) throw new Error(error.message);
    return Object.fromEntries((data ?? []).filter((r: { description: string | null }) => r.description).map((r: { section: string; description: string }) => [r.section, r.description]));
  },
  {},
);
