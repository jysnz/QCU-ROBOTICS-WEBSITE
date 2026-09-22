import { cache } from 'react';
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

/**
 * Fetch hero stats (counts) - cached per render pass
 */
export const getHeroStats = cache(async (): Promise<HeroStats> => {
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

  const totalMembers =
    (teamPlayersResult.count ?? 0) +
    (membersResult.count ?? 0) +
    (mediaTeamResult.count ?? 0);

  return {
    competitions: competitionsResult.count ?? 0,
    internationalAwards: internationalAwardsResult.count ?? 0,
    teamMembers: totalMembers,
    nationalAwards: nationalAwardsResult.count ?? 0,
    seasons: seasonsResult.count ?? 0,
  };
});

/**
 * Fetch all seasons - cached per render pass
 */
export const getSeasons = cache(async (): Promise<Season[]> => {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('[Data] Seasons error:', error.message);
    return [];
  }
  return data ?? [];
});

/**
 * Fetch all competitions with seasons - cached per render pass
 */
export const getCompetitions = cache(async (): Promise<Competition[]> => {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, title, status, date, location, created_at, image_url, season_id, seasons ( id, season_name )')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Data] Competitions error:', error.message);
    return [];
  }
  return (data ?? []) as Competition[];
});

/**
 * Fetch team members - cached per render pass
 */
export const getTeamMembers = cache(async (): Promise<TeamMember[]> => {
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

  if (error) {
    console.error('[Data] Team members error:', error.message);
    return [];
  }
  return (data ?? []) as unknown as TeamMember[];
});

/**
 * Fetch media team - cached per render pass
 */
export const getMediaTeam = cache(async (): Promise<MediaMember[]> => {
  const { data, error } = await supabase
    .from('media_team')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[Data] Media team error:', error.message);
    return [];
  }
  return (data ?? []) as MediaMember[];
});

/**
 * Fetch members - cached per render pass
 */
export const getMembers = cache(async (): Promise<Member[]> => {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[Data] Members error:', error.message);
    return [];
  }
  return (data ?? []) as Member[];
});

/**
 * Fetch coaches - cached per render pass
 */
export const getCoaches = cache(async (): Promise<Coach[]> => {
  const { data, error } = await supabase
    .from('Coaches')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[Data] Coaches error:', error.message);
    return [];
  }
  return (data ?? []) as Coach[];
});

/**
 * Fetch sponsor companies - cached per render pass
 */
export const getSponsors = cache(async (): Promise<SponsorCompany[]> => {
  const { data, error } = await supabase
    .from('sponsor_company')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('[Data] Sponsors error:', error.message);
    return [];
  }
  return (data ?? []) as SponsorCompany[];
});
