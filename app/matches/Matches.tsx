"use client";

import React, { useState, useEffect, useId, useRef } from 'react';
import Hls from 'hls.js';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabasePublic';
import { LoadingSpinner, SkeletonMatchCard } from '../components/LoadingSpinner';
import { ChevronLeft, Settings, Trophy, Download, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { convertHlsToMp4, triggerBlobDownload } from './hlsToMp4';
import CompetitionFilters from '../components/CompetitionFilters';
import CountUp from '../components/CountUp';


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

type QualityOption = {
  value: string;
  label: string;
};

const buildQualityOptions = (levels: any[]): QualityOption[] => {
  const options = levels.map((level, index) => {
    const heightLabel = level?.height ? `${level.height}p` : '';
    const fallbackLabel = level?.name || `Level ${index + 1}`;
    const label = heightLabel || fallbackLabel;

    return {
      value: String(index),
      label,
    };
  });

  return [{ value: 'auto', label: 'Auto' }, ...options.filter((option) => Boolean(option.label))];
};

// <video poster> is fetched directly by the browser, so point it at the same
// optimizer endpoint next/image uses instead of the rate-limited R2 origin.
const getOptimizedImageUrl = (src: string, width = 1200) =>
  `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;

const HLSVideo = ({ url, thumbnailUrl }: { url: string; thumbnailUrl?: string | null }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hasInitializedRef = useRef(false);
  const qualityControlId = useId();
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([{ value: 'auto', label: 'Auto' }]);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [isActivated, setIsActivated] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const showThumbnail = Boolean(thumbnailUrl) && !thumbnailFailed;

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || !hls.levels.length) return;

    if (selectedQuality === 'auto') {
      hls.currentLevel = -1;
      return;
    }

    const selectedLevel = Number(selectedQuality);
    if (!Number.isNaN(selectedLevel) && selectedLevel >= 0 && selectedLevel < hls.levels.length) {
      hls.currentLevel = selectedLevel;
    } else {
      hls.currentLevel = -1;
    }
  }, [qualityOptions, selectedQuality]);

  useEffect(() => {
    if (!isActivated) return;

    const video = videoRef.current;
    if (!video) return;

    setQualityOptions([{ value: 'auto', label: 'Auto' }]);
    setSelectedQuality('auto');

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
  }, [isActivated]);

  useEffect(() => {
    if (!isActivated) return;

    const video = videoRef.current;
    if (!video || !url || hasInitializedRef.current || hlsRef.current) return;

    hasInitializedRef.current = true;
    let hls: Hls | null = null;

    const syncQualityOptions = () => {
      setQualityOptions(buildQualityOptions(hls?.levels ?? []));
    };

    const startPlayback = async () => {
      try {
        await video.play();
      } catch (error) {
        console.warn('[HLS DEBUG] Autoplay after activation was blocked:', error);
      }
    };

    if (!Hls.isSupported()) {
      console.warn('[HLS DEBUG] hls.js NOT supported, falling back to native playback');
      video.src = url;
      void startPlayback();

      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      autoStartLoad: false,
      startLevel: -1,
      maxBufferLength: 8,
      maxMaxBufferLength: 16,
    });

    hlsRef.current = hls;
    hls.attachMedia(video);
    hls.loadSource(url);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      syncQualityOptions();
      hls?.startLoad(0);
      void startPlayback();
    });

    hls.on(Hls.Events.LEVELS_UPDATED, syncQualityOptions);

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.warn('[HLS DEBUG] HLS ERROR:', data);
    });

    return () => {
      video.removeAttribute('src');
      video.load();
      if (hls) hls.destroy();
      hlsRef.current = null;
    };
  }, [isActivated, url]);

  useEffect(() => {
    setIsActivated(false);
    hasInitializedRef.current = false;
    setQualityOptions([{ value: 'auto', label: 'Auto' }]);
    setSelectedQuality('auto');
  }, [url]);

  const canChooseQuality = qualityOptions.length > 1;

  const handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextQuality = event.target.value;
    setSelectedQuality(nextQuality);

    const hls = hlsRef.current;
    if (!hls || !hls.levels.length) return;

    if (nextQuality === 'auto') {
      hls.currentLevel = -1;
      return;
    }

    const selectedLevel = Number(nextQuality);
    if (!Number.isNaN(selectedLevel) && selectedLevel >= 0 && selectedLevel < hls.levels.length) {
      hls.currentLevel = selectedLevel;
    } else {
      hls.currentLevel = -1;
    }
  };

  

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-950/60 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          <Settings className="h-4 w-4" />
          <span>Resolution</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`quality-${qualityControlId}`}>Select video resolution</label>
          <select
            id={`quality-${qualityControlId}`}
            value={selectedQuality}
            onChange={handleQualityChange}
            disabled={!isActivated || !canChooseQuality}
            className="min-w-40 rounded-lg border border-slate-700/60 bg-slate-900/90 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-blue-500/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {qualityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-black">
        {!isActivated ? (
          <button
            type="button"
            onClick={() => setIsActivated(true)}
            className="group relative flex w-full items-center justify-center overflow-hidden bg-black"
            aria-label="Play match video"
          >
            {showThumbnail ? (
              <div className="relative h-64 w-full overflow-hidden">
                <Image
                  src={thumbnailUrl as string}
                  alt="Match video preview"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  onError={() => setThumbnailFailed(true)}
                />
              </div>
            ) : (
              <div className="flex h-64 w-full items-center justify-center bg-slate-900 text-sm text-slate-300">
                Tap to load match video
              </div>
            )}
            <span className="absolute inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-black/55 text-white transition-colors group-hover:bg-black/70">
              ▶
            </span>
          </button>
        ) : (
          <video
            ref={videoRef}
            controls
            preload="none"
            playsInline
            poster={showThumbnail ? getOptimizedImageUrl(thumbnailUrl as string) : undefined}
            className="w-full h-64 object-contain bg-black"
          />
        )}

        
      </div>
    </div>
  );
};

type DownloadStatus = 'idle' | 'downloading' | 'converting' | 'error';

const DownloadMp4Button = ({ url, matchName }: { url: string; matchName: string }) => {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState(0);

  const handleDownload = async () => {
    if (status === 'downloading' || status === 'converting') return;

    setStatus('downloading');
    setProgress(0);

    try {
      const blob = await convertHlsToMp4(url, (update) => {
        if (update.stage === 'downloading') {
          setProgress(update.total > 0 ? Math.round((update.loaded / update.total) * 100) : 0);
        } else {
          setStatus('converting');
        }
      });

      const filename = `${matchName?.replace(/[^a-z0-9-_]+/gi, '_') || 'match'}.mp4`;
      triggerBlobDownload(blob, filename);
      setStatus('idle');
    } catch (error) {
      console.error('[Matches] MP4 conversion failed:', error);
      setStatus('error');
    }
  };

  const isBusy = status === 'downloading' || status === 'converting';

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isBusy}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-blue-500/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-80"
    >
      {status === 'idle' && (
        <>
          <Download className="h-3.5 w-3.5" />
          Download MP4
        </>
      )}
      {status === 'downloading' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Downloading video… {progress}%
        </>
      )}
      {status === 'converting' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Converting to MP4…
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          Download failed — retry
        </>
      )}
    </button>
  );
};

const MatchesSection = () => {
  const searchParams = useSearchParams();
  const competitionIdParam = searchParams?.get('id');

  const [competitions, setCompetitions] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | number | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registerMatchesVideoCache = async () => {
      try {
        await navigator.serviceWorker.register('/matches-video-sw.js', { scope: '/' });
      } catch (error) {
        console.warn('[Matches] Service worker registration failed:', error);
      }
    };

    registerMatchesVideoCache();
  }, []);

  useEffect(() => {
    const fetchCompetitionsAndTeams = async () => {
      try {
        let compData = getCachedData('matches-competitions-v2');
        if (!compData) {
          const { data, error: compError } = await supabase.from('competitions').select('id, title, season_id');
          if (compError) { console.error('[Matches] ❌ Error:', compError.message); return; }
          compData = data;
          if (compData) setCachedData('matches-competitions-v2', compData);
        }

        let seasonData = getCachedData('matches-seasons');
        if (!seasonData) {
          const { data, error: seasonError } = await supabase.from('seasons').select('id, season_name').order('id', { ascending: false });
          if (seasonError) console.error('[Matches] ⚠️ Seasons error:', seasonError.message);
          else { seasonData = data ?? []; setCachedData('matches-seasons', seasonData); }
        }
        if (seasonData) setSeasons(seasonData);

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
    <section id="matches" className="relative z-10 pb-20 pt-8 md:pt-12">
      <div className="mx-auto max-w-[1200px] px-4 md:px-7">
        <Link
          href="/#competitions"
          className="group mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Competitions
        </Link>

        <header className="mb-10 max-w-2xl">
          <p className="kicker mb-4">Matches</p>
          <h1 className="font-display text-[clamp(2.4rem,6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.04em]">
            Match <span className="text-accent">results</span>
          </h1>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-400">
            Scores and match footage for each competition.
          </p>
        </header>

        <CompetitionFilters
          seasons={seasons}
          competitions={competitions}
          selectedComp={selectedComp}
          onCompChange={(id) => setSelectedComp(Number(id))}
          teams={teamOptions}
          selectedTeam={selectedTeam}
          onTeamChange={setSelectedTeam}
        />

        <div className="h-8" />

        {/* Match Cards */}
        {loadingMatches ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => <SkeletonMatchCard key={i} />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-600 px-6 py-16 text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-xl border border-slate-600 text-slate-400">
              <Trophy className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-semibold text-white">No matches recorded yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              There are no results for {currentTeamLabel} at {currentCompTitle}. They will appear here once entries are added.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-stagger">
            {matches.map((match) => (
              <div
                key={match.id}
                className="p-6 rounded-2xl bg-slate-900/30 border border-slate-700/40 hover:bg-slate-800/40 transition-all duration-300 animate-fadeIn"
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
                    <p className="text-4xl font-extrabold text-white"><CountUp value={Number(match.our_score) || 0} /></p>
                  </div>
                  <span className="text-slate-600 text-xl font-bold">vs</span>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">{match.opponent_name}</p>
                    <p className="text-4xl font-extrabold text-slate-300"><CountUp value={Number(match.opponent_score) || 0} /></p>
                  </div>
                </div>

                {match.video_url && (
                  <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden border border-slate-700/50">
                      <HLSVideo url={match.video_url} thumbnailUrl={match.thumbnail_url ?? match.thumbnail ?? null} />
                    </div>
                    <DownloadMp4Button url={match.video_url} matchName={match.name} />
                  </div>
                )}

                {/* The video was uploaded but is still being converted for streaming (it appears here by itself when ready). */}
                {!match.video_url && match.is_processing === true && (
                  <div role="status" className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                    <span>This video is still being processed. Check back in a little while.</span>
                  </div>
                )}
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