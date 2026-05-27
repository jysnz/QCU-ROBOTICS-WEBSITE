"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ChevronLeft, Trophy, Star, Zap, Award } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

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

const getIconComponent = (index: number) => {
  const icons = [Trophy, Star, Zap, Award];
  const Icon = icons[index % icons.length];
  return <Icon className="w-6 h-6" />;
};

export default function AchievementsPage() {
  const searchParams = useSearchParams();
  const competitionIdParam = searchParams?.get('id') ?? null;
  
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | number | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch competitions and teams
  useEffect(() => {
    const fetchCompetitionsAndTeams = async () => {
      try {
        // Check cache for competitions
        let compData = getCachedData('achievements-competitions');
        if (!compData) {
          console.log('[Achievements] Fetching competitions...');
          const { data, error: compError } = await supabase.from('competitions').select('id, title');
          
          if (compError) {
            console.error('[Achievements] ❌ Error:', compError.message);
            return;
          }
          
          compData = data;
          if (compData) {
            setCachedData('achievements-competitions', compData);
          }
        }

        // Check cache for teams
        let teamData = getCachedData('achievements-teams');
        if (!teamData) {
          console.log('[Achievements] Fetching teams...');
          const { data, error: teamError } = await supabase.from('teams').select('id, team_code, team_name');
          
          if (teamError) {
            console.error('[Achievements] ❌ Team Error:', teamError.message);
            return;
          }
          
          teamData = data;
          if (teamData) {
            setCachedData('achievements-teams', teamData);
          }
        }
        
        if (compData && compData.length > 0) {
          console.log('[Achievements] ✅ Loaded:', compData.length, 'competitions');
          setCompetitions(compData);
          // Use the competition ID from URL params if available, otherwise use first
          const selectedId = competitionIdParam ? parseInt(competitionIdParam, 10) : compData[0].id;
          setSelectedComp(selectedId);
        }
        
        if (teamData && teamData.length > 0) {
          console.log('[Achievements] ✅ Loaded teams:', teamData);
          setTeams(teamData);
        }
      } catch (err: any) {
        console.error('[Achievements] ❌ Exception:', err?.message || err);
      }
    };
    
    fetchCompetitionsAndTeams();
  }, []);

  // Fetch achievements when selected competition changes
  useEffect(() => {
    const fetchAchievements = async () => {
      if (!selectedComp) return;
      
      setLoading(true);
      try {
        console.log('[Achievements] Fetching for competition:', selectedComp);
        
        // Check cache first
        const cacheKey = `achievements-comp-${selectedComp}`;
        let achievementsData = getCachedData(cacheKey);
        
        if (!achievementsData) {
          const { data, error } = await supabase
            .from('Achievements')
            .select('achievement_id, achievement_name, team_id, competition_id')
            .eq('competition_id', selectedComp)
            .order('achievement_id', { ascending: true });
          
          if (error) {
            console.error('[Achievements] ❌ Error:', error.message);
            setAchievements([]);
          } else {
            console.log('[Achievements] ✅ Fetched:', data?.length || 0, 'achievements');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-slate-950/95 to-slate-950/80 backdrop-blur-md border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Achievements</span>
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">
              Competition <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">Achievements</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-2xl">
              Celebrating the accomplishments and awards earned by our teams across various robotics competitions.
            </p>
          </div>

          {/* Competition Filter */}
          <div className="mb-12">
            <div className="flex gap-3 flex-wrap">
              {competitions.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => setSelectedComp(comp.id)}
                  className={`px-6 py-3 rounded-full text-sm font-semibold transition-all border ${
                    selectedComp === comp.id
                      ? 'bg-amber-600/80 border-amber-500/50 text-white'
                      : 'bg-slate-900/40 border-slate-700/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {comp.title}
                </button>
              ))}
            </div>
          </div>

          {/* Achievements Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <LoadingSpinner />
            </div>
          ) : achievements.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 text-lg">No achievements recorded for this competition yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-stagger">
              {achievements.map((achievement, idx) => {
                const team = teams.find(t => t.id === achievement.team_id);
                const teamName = team ? (team.team_code || `Team ${team.id}`) : 'Unknown Team';
                
                return (
                  <div
                    key={achievement.achievement_id}
                    className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-md border border-slate-700/50 p-8 transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(217,119,6,0.2)] animate-fadeIn"
                  >
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {/* Content */}
                    <div className="relative z-10">
                      {/* Icon */}
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                        {getIconComponent(idx)}
                      </div>

                      {/* Achievement Name */}
                      <h3 className="text-xl font-bold text-white mb-4 group-hover:text-amber-100 transition-colors">
                        {achievement.achievement_name}
                      </h3>

                      {/* Team Info */}
                      {team && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                          <div className="flex gap-2">
                            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                              {teamName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Trophy className="w-4 h-4 text-yellow-400" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Border glow effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl bg-gradient-to-br from-amber-500/20 via-transparent to-orange-500/20" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
