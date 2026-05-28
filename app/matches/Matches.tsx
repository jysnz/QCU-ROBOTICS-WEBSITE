"use client";

import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { LoadingSpinner, SkeletonMatchCard } from '../components/LoadingSpinner';
import { ChevronLeft, ChevronDown, Check, Trophy } from 'lucide-react';
import Link from 'next/link';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);
let activeVideoElement: HTMLVideoElement | null = null;

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

const HLSVideo = ({ url }: { url: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      if (activeVideoElement && activeVideoElement !== video) {
        activeVideoElement.pause();
      }
      activeVideoElement = video;
    };

    const handlePauseOrEnd = () => {
      if (activeVideoElement === video) {
        activeVideoElement = null;
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePauseOrEnd);
    video.addEventListener('ended', handlePauseOrEnd);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePauseOrEnd);
      video.removeEventListener('ended', handlePauseOrEnd);
      if (activeVideoElement === video) {
        activeVideoElement = null;
      }
    };
  }, []);

  useEffect(() => {
    console.log('==============================');
    console.log('[HLS DEBUG] URL:', url);

    if (!videoRef.current || !url) {
      console.warn('[HLS DEBUG] Missing video or URL');
      return;
    }

    const video = videoRef.current;

    let hls: Hls | null = null;

    // ❗ FORCE hls.js for ALL non-Safari browsers
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    console.log('[HLS DEBUG] Is Safari?', isSafari);

    if (isSafari) {
      console.log('[HLS DEBUG] Using native HLS');
      video.src = url;
      return;
    }

    if (!Hls.isSupported()) {
      console.warn('[HLS DEBUG] hls.js NOT supported');
      return;
    }

    console.log('[HLS DEBUG] Using hls.js');

    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('[HLS DEBUG] Manifest loaded (NO autoplay)');
      // Do nothing — user must press play
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.warn('[HLS DEBUG] HLS ERROR:', data);
    });

    return () => {
      if (hls) hls.destroy();
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full max-h-48 object-cover bg-black"
    />
  );
};

const MatchesSection = () => {
  const searchParams = useSearchParams();
  const competitionIdParam = searchParams?.get('id');

  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | number | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  
  // Custom Dropdown State & Ref
  const [isCompDropdownOpen, setIsCompDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCompDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchCompetitionsAndTeams = async () => {
      try {
        let compData = getCachedData('matches-competitions');
        if (!compData) {
          const { data, error: compError } = await supabase.from('competitions').select('id, title');
          if (compError) { console.error('[Matches] ❌ Error:', compError.message); return; }
          compData = data;
          if (compData) setCachedData('matches-competitions', compData);
        }

        let teamData = getCachedData('matches-teams');
        if (!teamData) {
          const { data, error: teamError } = await supabase.from('teams').select('id, team_code, team_name');
          if (teamError) { console.error('[Matches] ❌ Team Error:', teamError.message); return; }
          teamData = data;
          if (teamData) setCachedData('matches-teams', teamData);
        }

        if (compData && compData.length > 0) {
          setCompetitions(compData);
          const selectedId = competitionIdParam ? parseInt(competitionIdParam, 10) : compData[0].id;
          setSelectedComp(selectedId);
        }
      } catch (err: any) {
        console.error('[Matches] ❌ Exception:', err?.message || err);
      }
    };

    fetchCompetitionsAndTeams();
  }, [competitionIdParam]);

  useEffect(() => {
    const fetchCompetitionTeams = async () => {
      if (!selectedComp) return;

      try {
        const cacheKey = `matches-competition-teams-${selectedComp}`;
        let competitionTeams = getCachedData(cacheKey);

        if (!competitionTeams) {
          const { data, error } = await supabase
            .from('team_competitions')
            .select('team_id, teams ( id, team_code, team_name )')
            .eq('competition_id', selectedComp);

          if (error) {
            console.error('[Matches] ❌ Team competition error:', error.message);
            setTeams([]);
            setSelectedTeam(null);
            return;
          }

          competitionTeams = (data ?? [])
            .map((row: any) => row.teams)
            .filter((team: any) => Boolean(team?.id));

          console.log('[Matches] ✅ Competition teams fetched:', {
            selectedComp,
            rows: data,
            teams: competitionTeams,
          });

          setCachedData(cacheKey, competitionTeams);
        } else {
          console.log('[Matches] ♻️ Using cached competition teams:', {
            selectedComp,
            teams: competitionTeams,
          });
        }

        setTeams(competitionTeams);

        const currentSelectionStillValid = competitionTeams.some(
          (team: any) => Number(team.id) === Number(selectedTeam)
        );

        if (competitionTeams.length === 0) {
          console.warn('[Matches] ⚠️ No teams linked to this competition:', selectedComp);
          setSelectedTeam(null);
        } else if (!currentSelectionStillValid) {
          const nextTeamId = competitionTeams[0].id;
          console.log('[Matches] 🔁 Reset selected team to first competition-linked team:', nextTeamId);
          setSelectedTeam(nextTeamId);
        }
      } catch (err: any) {
        console.error('[Matches] ❌ Competition teams exception:', err?.message || err);
        setTeams([]);
        setSelectedTeam(null);
      }
    };

    fetchCompetitionTeams();
  }, [selectedComp]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!selectedComp) return;
      setLoadingMatches(true);
      try {
        let query = supabase.from('matches').select('*').eq('competition_id', selectedComp);
        if (selectedTeam) query = query.eq('team_id', selectedTeam);
        const { data, error } = await query.order('sequence', { ascending: true });
        if (error) { console.error('[MatchResults] ❌ Error:', error.message); }
        else { setMatches(data ?? []); }
      } catch (err: any) {
        console.error('[MatchResults] ❌ Exception:', err?.message || err);
      } finally {
        setLoadingMatches(false);
      }
    };
    fetchMatches();
  }, [selectedComp, selectedTeam]);

  const teamOptions = teams;

  // Helper to get currently selected competition title
  const currentCompTitle = competitions.find(c => c.id === selectedComp)?.title || 'Select Competition...';
  const currentTeamLabel = teams.find((team) => Number(team.id) === Number(selectedTeam))?.team_code || 'All linked teams';

  return (
    <section id="matches" className="py-24 relative z-10 bg-slate-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link href="/#competitions" className="p-2 rounded-lg bg-slate-900/40 border border-slate-700/40 hover:bg-slate-800/40 transition-all">
              <ChevronLeft className="w-5 h-5 text-slate-300" />
            </Link>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Match Results</h2>
              <p className="text-slate-400">Track scores and watch match footage for each competition.</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8">
          
          {/* Custom Competition Dropdown */}
          <div className="mb-6 relative w-full max-w-sm" ref={dropdownRef}>
            <label className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2 block">
              Competition
            </label>
            
            <button
              type="button"
              onClick={() => setIsCompDropdownOpen(!isCompDropdownOpen)}
              className={`w-full flex items-center justify-between bg-slate-900/60 border ${
                isCompDropdownOpen ? 'border-blue-500/50 ring-1 ring-blue-500/30' : 'border-slate-700/50 hover:border-slate-600'
              } text-white text-sm font-medium px-4 py-3 rounded-xl backdrop-blur-sm transition-all duration-300`}
            >
              <span className="truncate">{currentCompTitle}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isCompDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isCompDropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <ul className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                  {competitions.map((comp) => (
                    <li key={comp.id}>
                      <button
                        onClick={() => {
                          setSelectedComp(comp.id);
                          setIsCompDropdownOpen(false);
                        }}
                        className={`w-full text-left flex items-center justify-between px-4 py-3 text-sm transition-colors ${
                          selectedComp === comp.id
                            ? 'bg-blue-600/10 text-blue-400 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{comp.title}</span>
                        {selectedComp === comp.id && <Check className="w-4 h-4" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Team filter */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/40 to-slate-900/20 backdrop-blur-md border border-slate-700/40 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">Select Team</p>
            <div className="flex gap-4 flex-wrap justify-center">
              {teamOptions.length > 0 ? teamOptions.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team.id)}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 border-2 ${
                    selectedTeam === team.id
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-blue-500/50 hover:text-white'
                  }`}
                >
                  {team.team_code || `Team ${team.team_number}`}
                </button>
              )) : (
                <p className="text-slate-500 text-sm">No teams are linked to this competition.</p>
              )}
            </div>
          </div>
        </div>

        {/* Match Cards */}
        {loadingMatches ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => <SkeletonMatchCard key={i} />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-950/80 p-10 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_35%),radial-gradient(circle_at_bottom,rgba(220,38,38,0.10),transparent_32%)]" />
            <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 shadow-[0_0_28px_rgba(239,68,68,0.16)]">
                <Trophy className="h-8 w-8 text-red-300" />
              </div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-red-300/80">
                No matches available
              </p>
              <h3 className="text-2xl font-bold text-white mb-3">
                No results recorded for this competition yet.
              </h3>
              <p className="text-slate-400 leading-relaxed max-w-lg">
                The selected competition is {currentCompTitle}. The current team filter is {currentTeamLabel}. If this event has not been linked to matches yet, they will appear here once entries are added.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-stagger">
            {matches.map((match) => (
              <div
                key={match.id}
                className="p-6 rounded-2xl bg-slate-900/30 backdrop-blur-md border border-slate-700/40 hover:bg-slate-800/40 transition-all duration-300 animate-fadeIn"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">{match.name}</h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    match.result === 'Win'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : match.result === 'Loss'
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  }`}>
                    {match.result}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-6 py-4 mb-4 rounded-xl bg-slate-950/40 border border-slate-800/50">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">{teamOptions.find(t => Number(t.id) === Number(match.team_id))?.team_code || 'Our Team'}</p>
                    <p className="text-4xl font-extrabold text-white">{match.our_score}</p>
                  </div>
                  <span className="text-slate-600 text-xl font-bold">vs</span>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">{match.opponent_name}</p>
                    <p className="text-4xl font-extrabold text-slate-300">{match.opponent_score}</p>
                  </div>
                </div>

                {match.video_url && (
                  <div className="rounded-xl overflow-hidden border border-slate-700/50">
                    <HLSVideo url={match.video_url} />
                  </div>
                )}

                <p className="text-xs text-slate-500 mt-3">
                  {new Date(match.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default function MatchesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <MatchesSection />
    </div>
  );
}