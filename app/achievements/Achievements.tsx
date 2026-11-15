"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabasePublic';
import Link from 'next/link';
import { ChevronLeft, Trophy, Star, Zap, Award } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import CompetitionFilters from '../components/CompetitionFilters';


const CACHE_DURATION = 5 * 60 * 1000;
const dataCache = new Map<string, { data: any; timestamp: number }>();

const getCachedData = (key: string) => {
  const cached = dataCache.get(key);
  if (!cached) return null;
  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
  if (isExpired) { dataCache.delete(key); return null; }
  return cached.data;
};

const setCachedData = (key: string, data: any) => {
  dataCache.set(key, { data, timestamp: Date.now() });
};

const getIconComponent = (index: number) => {
  const icons = [Trophy, Star, Zap, Award];
  const Icon = icons[index % icons.length];
  return <Icon className="w-6 h-6" />;
};

export default function AchievementsPage() {
  const searchParams = useSearchParams();
  const competitionIdParam = searchParams?.get('id') ?? null;

  const [competitions, setCompetitions] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | number | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompetitionsAndTeams = async () => {
      try {
        let compData = getCachedData('achievements-competitions-v2');
        if (!compData) {
          const { data, error: compError } = await supabase.from('competitions').select('id, title, season_id');
          if (compError) { console.error('[Achievements] ❌ Error:', compError.message); return; }
          compData = data;
          if (compData) setCachedData('achievements-competitions-v2', compData);
        }

        let seasonData = getCachedData('achievements-seasons');
        if (!seasonData) {
          const { data, error: seasonError } = await supabase.from('seasons').select('id, season_name').order('id', { ascending: false });
          if (seasonError) console.error('[Achievements] ⚠️ Seasons error:', seasonError.message);
          else { seasonData = data ?? []; setCachedData('achievements-seasons', seasonData); }
        }
        if (seasonData) setSeasons(seasonData);

        let teamData = getCachedData('achievements-teams');
        if (!teamData) {
          const { data, error: teamError } = await supabase.from('teams').select('id, team_code, team_name');
          if (teamError) { console.error('[Achievements] ❌ Team Error:', teamError.message); return; }
          teamData = data;
          if (teamData) setCachedData('achievements-teams', teamData);
        }

        if (compData && compData.length > 0) {
          setCompetitions(compData);
          const selectedId = competitionIdParam ? parseInt(competitionIdParam, 10) : compData[0].id;
          setSelectedComp(selectedId);
        }
      } catch (err: any) {
        console.error('[Achievements] ❌ Exception:', err?.message || err);
      }
    };

    fetchCompetitionsAndTeams();
  }, [competitionIdParam]);

  useEffect(() => {
    const fetchCompetitionTeams = async () => {
      if (!selectedComp) return;

      try {
        const cacheKey = `achievements-competition-teams-${selectedComp}`;
        let competitionTeams = getCachedData(cacheKey);

        if (!competitionTeams) {
          const { data, error } = await supabase
            .from('team_competitions')
            .select('team_id, teams ( id, team_code, team_name )')
            .eq('competition_id', selectedComp);

          if (error) {
            console.error('[Achievements] ❌ Team competition error:', error.message);
            setTeams([]);
            setSelectedTeam(null);
            return;
          }

          competitionTeams = (data ?? [])
            .map((row: any) => row.teams)
            .filter((team: any) => Boolean(team?.id));

          setCachedData(cacheKey, competitionTeams);
        }

        setTeams(competitionTeams);

        const currentSelectionStillValid = competitionTeams.some(
          (team: any) => Number(team.id) === Number(selectedTeam)
        );

        if (competitionTeams.length === 0) {
          setSelectedTeam(null);
        } else if (!currentSelectionStillValid) {
          setSelectedTeam(competitionTeams[0].id);
        }
      } catch (err: any) {
        console.error('[Achievements] ❌ Competition teams exception:', err?.message || err);
        setTeams([]);
        setSelectedTeam(null);
      }
    };

    fetchCompetitionTeams();
  }, [selectedComp]);

  useEffect(() => {
    const fetchAchievements = async () => {
      if (!selectedComp) return;
      setLoading(true);
      try {
        const cacheKey = `achievements-comp-${selectedComp}`;
        let achievementsData = getCachedData(cacheKey);
        if (!achievementsData) {
          const { data, error } = await supabase
            .from('Achievements')
            .select('achievement_id, achievement_name, team_id, competition_id')
            .eq('competition_id', selectedComp)
            .order('achievement_id', { ascending: true });
          if (error) { console.error('[Achievements] ❌ Error:', error.message); setAchievements([]); }
          else {
            achievementsData = data ?? [];
            setCachedData(cacheKey, achievementsData);
            setAchievements(achievementsData);
          }
        } else {
          setAchievements(achievementsData);
        }
      } catch (err: any) {
        console.error('[Achievements] ❌ Exception:', err?.message || err);
        setAchievements([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [selectedComp]);

  // Helper to get currently selected competition title
  const currentCompTitle = competitions.find(c => c.id === selectedComp)?.title || 'Select Competition...';

  // Filter achievements locally based on selected team
  const displayedAchievements = selectedTeam
    ? achievements.filter(a => a.team_id === selectedTeam)
    : achievements;

  const selectedTeamLabel = teams.find((team) => Number(team.id) === Number(selectedTeam))?.team_code || 'All teams';

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-20 pt-8 md:px-7 md:pt-12">
      <Link
        href="/#competitions"
        className="group mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        Competitions
      </Link>

      <header className="mb-10 max-w-2xl">
        <p className="kicker mb-4">Achievements</p>
        <h1 className="font-display text-[clamp(2.4rem,6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.04em]">
          Competition <span className="text-accent">achievements</span>
        </h1>
        <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-400">
          The awards and placements our teams have earned across robotics competitions.
        </p>
      </header>

      <CompetitionFilters
        seasons={seasons}
        competitions={competitions}
        selectedComp={selectedComp}
        onCompChange={setSelectedComp}
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
      />

      {/* Results */}
      <div className="mt-8 flex items-baseline justify-between gap-4" aria-live="polite">
        <p className="text-sm text-slate-400">
          {loading ? 'Loading…' : (
            <>
              <span className="font-mono tabular-nums text-white">{String(displayedAchievements.length).padStart(2, '0')}</span>{' '}
              {displayedAchievements.length === 1 ? 'achievement' : 'achievements'}
              {selectedTeam ? <> for <span className="text-white">{selectedTeamLabel}</span></> : null}
            </>
          )}
        </p>
        <p className="hidden truncate text-sm text-slate-500 sm:block">{currentCompTitle}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : displayedAchievements.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-600 px-6 py-16 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-xl border border-slate-600 text-slate-400">
            <Trophy className="h-6 w-6" />
          </div>
          <h2 className="font-display text-xl font-semibold text-white">Nothing recorded yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            No awards or placements have been added for {selectedTeamLabel} at {currentCompTitle}. Try another team or competition.
          </p>
        </div>
      ) : (
        <ul key={`${selectedComp}-${selectedTeam}`} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedAchievements.map((achievement, idx) => {
            const team = teams.find(t => t.id === achievement.team_id);
            const teamName = team ? (team.team_code || `Team ${team.id}`) : 'Unknown team';

            return (
              <li
                key={achievement.achievement_id}
                className="lift group flex min-h-[180px] flex-col rounded-2xl border border-slate-700 bg-slate-900 p-6"
                style={{ animation: 'rise .6s var(--ease) both', animationDelay: `${Math.min(idx, 9) * 60}ms` }}
              >
                <div className="mb-5 flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/10 text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-ink">
                    {getIconComponent(idx)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-slate-500">{String(idx + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="font-display text-xl font-semibold leading-snug tracking-tight text-white">
                  {achievement.achievement_name}
                </h3>
                <div className="mt-auto pt-5">
                  <span className="inline-flex items-center gap-2 border-t border-slate-700 pt-4 font-mono text-[.7rem] uppercase tracking-[.14em] text-slate-400">
                    <span className="h-1.5 w-1.5 bg-accent" aria-hidden="true" />
                    {teamName}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
