"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Data Cache System ────────────────────────────────────────────────────────
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const dataCache = new Map<string, { data: any; timestamp: number }>();

const getCachedData = (key: string) => {
  const cached = dataCache.get(key);
  if (!cached) return null;
  
  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
  if (isExpired) {
    dataCache.delete(key);
    return null;
  }
  
  console.log(`[Cache] ✅ Using cached data for: ${key}`);
  return cached.data;
};

const setCachedData = (key: string, data: any) => {
  dataCache.set(key, { data, timestamp: Date.now() });
  console.log(`[Cache] 📝 Cached data for: ${key}`);
};

// ─── Upload Functions ────────────────────────────────────────────────────────
async function uploadMatchVideo(file: File, matchName: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const filePath = `match-${matchName.replace(/\s+/g, '-')}-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage
    .from('match-videos')
    .upload(filePath, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from('match-videos').getPublicUrl(filePath);
  return data.publicUrl;
}

// ─── Matches Section ──────────────────────────────────────────────────────────
const MatchesSection = () => {
  const searchParams = useSearchParams();
  const competitionIdParam = searchParams?.get('id');
  
  console.log('[MatchesSection] Component rendering');
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | number | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', our_score: '', opponent_score: '', opponent_name: '' });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log('[MatchesSection] useEffect for competitions hook running');
    const fetchCompetitionsAndTeams = async () => {
      try {
        // Check cache for competitions
        let compData = getCachedData('matches-competitions');
        if (!compData) {
          console.log('[Matches] Fetching competitions...');
          const { data, error: compError } = await supabase.from('competitions').select('id, title');
          
          if (compError) {
            console.error('[Matches] ❌ Error:', compError.message);
            return;
          }
          
          compData = data;
          if (compData) {
            setCachedData('matches-competitions', compData);
          }
        }
        
        // Check cache for teams
        let teamData = getCachedData('matches-teams');
        if (!teamData) {
          console.log('[Matches] Fetching teams...');
          const { data, error: teamError } = await supabase.from('teams').select('id, team_code, team_name');
          
          if (teamError) {
            console.error('[Matches] ❌ Team Error:', teamError.message);
            return;
          }
          
          teamData = data;
          if (teamData) {
            setCachedData('matches-teams', teamData);
          }
        }
        
        if (compData && compData.length > 0) {
          console.log('[Matches] ✅ Loaded:', compData.length, 'competitions');
          setCompetitions(compData);
          // Use the competition ID from URL params if available, otherwise use first
          const selectedId = competitionIdParam ? parseInt(competitionIdParam, 10) : compData[0].id;
          setSelectedComp(selectedId);
        }
        
        if (teamData && teamData.length > 0) {
          console.log('[Matches] ✅ Loaded teams:', teamData);
          setTeams(teamData);
          setSelectedTeam(teamData[0].id);
        }
      } catch (err: any) {
        console.error('[Matches] ❌ Exception:', err?.message || err);
      }
    };
    
    fetchCompetitionsAndTeams();
  }, []);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!selectedComp) return;
      
      setLoadingMatches(true);
      try {
        console.log('[MatchResults] Fetching for competition:', selectedComp);
        
        let query = supabase
          .from('matches')
          .select('*')
          .eq('competition_id', selectedComp);
        
        if (selectedTeam) {
          query = query.eq('team_id', selectedTeam);
        }
        
        const { data, error } = await query.order('sequence', { ascending: true });
        
        if (error) {
          console.error('[MatchResults] ❌ Error:', error.message);
        } else {
          console.log('[MatchResults] ✅ Fetched:', data?.length || 0, 'matches');
          setMatches(data ?? []);
        }
      } catch (err: any) {
        console.error('[MatchResults] ❌ Exception:', err?.message || err);
      } finally {
        setLoadingMatches(false);
      }
    };
    
    fetchMatches();
  }, [selectedComp, selectedTeam]);

  const handleSubmit = async () => {
    if (!form.name || !form.opponent_name) return;
    setSubmitting(true);
    try {
      let video_url = null;
      if (videoFile) {
        video_url = await uploadMatchVideo(videoFile, form.name);
      }
      const { error } = await supabase.from('matches').insert([{
        competition_id: selectedComp,
        name: form.name,
        our_score: parseInt(form.our_score) || 0,
        opponent_score: parseInt(form.opponent_score) || 0,
        opponent_name: form.opponent_name,
        video_url,
      }]);
      if (error) throw error;
      setForm({ name: '', our_score: '', opponent_score: '', opponent_name: '' });
      setVideoFile(null);
      setShowForm(false);
    } catch (err: any) {
      console.error('Failed to add match:', err?.message || err);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500";

  return (
    <section id="matches" className="py-24 relative z-10 bg-slate-950/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg bg-slate-900/40 border border-slate-700/40 hover:bg-slate-800/40 transition-all">
              <ChevronLeft className="w-5 h-5 text-slate-300" />
            </Link>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Match Results</h2>
              <p className="text-slate-400">Track scores and watch match footage for each competition.</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="mt-4 md:mt-0 px-5 py-2.5 rounded-lg bg-red-600/80 border border-red-500/50 text-white text-sm font-medium hover:bg-red-700/80 transition-all"
          >
            {showForm ? 'Cancel' : '+ Add Match'}
          </button>
        </div>

        {/* Team and Competition filter tabs */}
        <div className="mb-8">
          {/* Competition filter tabs */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {competitions.map((comp) => (
              <button
                key={comp.id}
                onClick={() => setSelectedComp(comp.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  selectedComp === comp.id
                    ? 'bg-red-600/80 border-red-500/50 text-white'
                    : 'bg-slate-900/40 border-slate-700/40 text-slate-400 hover:text-white'
                }`}
              >
                {comp.title}
              </button>
            ))}
          </div>

          {/* Team filter tabs */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/40 to-slate-900/20 backdrop-blur-md border border-slate-700/40 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">Select Team</p>
            <div className="flex gap-4 flex-wrap justify-center">
              {teams.map((team) => (
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
              ))}
            </div>
          </div>
        </div>

        {/* Add Match Form */}
        {showForm && (
          <div className="mb-8 p-6 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-700/40">
            <h3 className="text-lg font-bold text-white mb-5">New Match</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Match Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Qualifier Round 1"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Opponent Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Team Nexus"
                  value={form.opponent_name}
                  onChange={(e) => setForm((p) => ({ ...p, opponent_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Our Score</label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="0"
                  value={form.our_score}
                  onChange={(e) => setForm((p) => ({ ...p, our_score: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Opponent Score</label>
                <input
                  className={inputClass}
                  type="number"
                  placeholder="0"
                  value={form.opponent_score}
                  onChange={(e) => setForm((p) => ({ ...p, opponent_score: e.target.value }))}
                />
              </div>
            </div>

            {/* Video Upload */}
            <div className="mb-5">
              <label className="block text-xs text-slate-400 mb-1">Match Video</label>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-red-500/50 transition-colors">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  id="video-upload"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                  {videoFile
                    ? <p className="text-green-400 text-sm">{videoFile.name}</p>
                    : <p className="text-slate-400 text-sm">Click to upload match video <span className="text-slate-600">(mp4, mov, etc.)</span></p>
                  }
                </label>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Match'}
            </button>
          </div>
        )}

        {/* Match Cards */}
        {loadingMatches ? (
          <p className="text-slate-400 text-center py-12">Loading matches...</p>
        ) : matches.length === 0 ? (
          <p className="text-slate-500 text-center py-12">No matches recorded for this competition yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map((match) => (
              <div
                key={match.id}
                className="p-6 rounded-2xl bg-slate-900/30 backdrop-blur-md border border-slate-700/40 hover:bg-slate-800/40 transition-all duration-300"
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

                {/* Scoreboard */}
                <div className="flex items-center justify-center gap-6 py-4 mb-4 rounded-xl bg-slate-950/40 border border-slate-800/50">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">{teams.find(t => t.id === match.team_id)?.team_code || 'Our Team'}</p>
                    <p className="text-4xl font-extrabold text-white">{match.our_score}</p>
                  </div>
                  <span className="text-slate-600 text-xl font-bold">vs</span>
                  <div className="text-center">
                    <p className="text-xs text-slate-400 mb-1">{match.opponent_name}</p>
                    <p className="text-4xl font-extrabold text-slate-300">{match.opponent_score}</p>
                  </div>
                </div>

                {/* Video player */}
                {match.video_url && (
                  <div className="rounded-xl overflow-hidden border border-slate-700/50">
                    <video controls className="w-full max-h-48 object-cover bg-black" src={match.video_url}>
                      Your browser does not support video playback.
                    </video>
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
