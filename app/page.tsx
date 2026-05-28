"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { LoadingSpinner, SkeletonCompetitionCard, SkeletonTeamMemberCard, SkeletonCoachCard } from './components/LoadingSpinner';
import {
  Trophy,
  Rocket,
  Activity,
  Zap,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Mail,
  Bot,
  Cpu,
  Shield,
  ArrowUpRight,
} from 'lucide-react';

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('[Init] Supabase URL:', supabaseUrl);
console.log('[Init] Supabase Key valid:', supabaseKey !== 'placeholder-key');

if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder-key') {
  console.warn('[Init] ⚠️ SUPABASE CREDENTIALS MISSING - using placeholders');
}

// ─── Data Cache System ────────────────────────────────────────────────────────
const CACHE_DURATION = 5 * 60 * 1000;
const dataCache = new Map<string, { data: any; timestamp: number }>();

const getCachedData = (key: string) => {
  const cached = dataCache.get(key);
  if (!cached) return null;
  const isExpired = Date.now() - cached.timestamp > CACHE_DURATION;
  if (isExpired) { dataCache.delete(key); return null; }
  console.log(`[Cache] ✅ Using cached data for: ${key}`);
  return cached.data;
};

const setCachedData = (key: string, data: any) => {
  dataCache.set(key, { data, timestamp: Date.now() });
  console.log(`[Cache] 📝 Cached data for: ${key}`);
};

// ─── JSONB Helpers ────────────────────────────────────────────────────────────
const formatRoleData = (role: any): string => {
  if (!role) return 'Team Member';
  if (typeof role === 'string') return role;
  if (typeof role === 'object') {
    if (Array.isArray(role.roles) && role.roles.length > 0) return role.roles.join(' • ');
    if (role.title) return role.title;
    if (role.department) return role.department;
  }
  return 'Team Member';
};

const extractSeasons = (seasonData: any): string[] => {
  if (!seasonData) return [];

  if (Array.isArray(seasonData)) {
    return seasonData
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof seasonData === 'object') {
    if (Array.isArray(seasonData.seasons)) {
      return seasonData.seasons
        .map((item: any) => String(item).trim())
        .filter(Boolean);
    }
    return Object.values(seasonData)
      .flat()
      .map((item: any) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof seasonData === 'string') {
    try {
      const parsed = JSON.parse(seasonData);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    } catch {
      return [seasonData.trim()].filter(Boolean);
    }
  }

  return [];
};

// ─── Ambient Background ───────────────────────────────────────────────────────
const AmbientBackground = () => (
  <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-red-900/20 blur-[120px] mix-blend-screen" />
    <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[60%] rounded-full bg-yellow-900/20 blur-[100px] mix-blend-screen" />
    <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-red-800/10 blur-[90px] mix-blend-screen" />
    <div
      className="absolute inset-0 opacity-50"
      style={{
        backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+")`
      }}
    />
  </div>
);

// ─── Navbar ───────────────────────────────────────────────────────────────────
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState('');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = ['Competitions', 'Matches', 'About Us', 'Teams', 'Technology'];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'py-2' : 'py-4'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between px-6 py-3 rounded-xl transition-all duration-300 ${
          scrolled
            ? 'bg-slate-950/70 backdrop-blur-xl border border-slate-700/40 shadow-2xl shadow-slate-900/30'
            : 'bg-slate-950/40 backdrop-blur-lg border border-slate-700/30'
        }`}>
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold shadow-lg group-hover:shadow-red-500/50 transition-shadow duration-300 overflow-hidden bg-slate-800">
                <img
                  src="/Images/logo1.jpg"
                  alt="QCU Robotics Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "https://ui-avatars.com/api/?name=QCU&background=dc143c&color=fff";
                  }}
                />
              </div>
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-red-500/20 to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
            <span className="text-lg font-bold text-white whitespace-nowrap">QCU ROBOTICS</span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item}
                href={item === 'Teams' ? '#members' : `#${item.toLowerCase().replace(' ', '-')}`}
                onMouseEnter={() => setActiveLink(item)}
                onMouseLeave={() => setActiveLink('')}
                className="relative px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                {item}
                <span className={`absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full transition-all duration-300 ${
                  activeLink === item ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                }`} />
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-4">
            <button className="group relative px-6 py-2.5 rounded-lg font-medium text-white text-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-lg transition-all duration-300 group-hover:shadow-lg group-hover:shadow-red-500/50" />
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-yellow-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-2">
                Join Team
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </span>
            </button>
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-300 hover:text-red-400 p-2 rounded-lg hover:bg-slate-800/50 transition-all duration-300"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden mt-3 p-5 rounded-xl bg-slate-950/80 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <a
                  key={item}
                  href={item === 'Teams' ? '#members' : `#${item.toLowerCase().replace(' ', '-')}`}
                  className="text-slate-300 hover:text-red-400 font-medium px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-all duration-300"
                  onClick={() => setIsOpen(false)}
                >
                  {item}
                </a>
              ))}
              <button className="w-full mt-2 px-5 py-3 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold hover:shadow-lg hover:shadow-red-500/50 transition-all duration-300 flex items-center justify-center gap-2">
                Join Team <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

// ─── Carousel Images ──────────────────────────────────────────────────────────
const CAROUSEL_IMAGES = [
  "/Images/678235897_1485046506604187_4125957943912417164_n.jpg",
  "/Images/678299297_1459872215195693_2358093542589606207_n%20(1).jpg",
  "/Images/678314792_1746064756186419_4411744446890772271_n.jpg",
  "/Images/682477686_1365069988975435_6372022281528030398_n.jpg",
  "/Images/685920531_944634058361196_8201555872037207606_n.jpg",
];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1563207153-f403bf289096?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1535378917042-10a22c95931a?q=80&w=2000&auto=format&fit=crop",
];

// ─── Hero ─────────────────────────────────────────────────────────────────────
const Hero = () => {
  const [currentImage, setCurrentImage] = useState(0);
  const [stats, setStats] = useState({
    competitions: 0,
    internationalAwards: 0,
    teamMembers: 0,
    nationalAwards: 0,
  });

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.history.replaceState(null, '', `#${sectionId}`);
    window.scrollTo({ top, behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchHeroStats = async () => {
      try {
        const [competitionsResult, internationalAwardsResult, teamMembersResult, nationalAwardsResult] = await Promise.all([
          supabase.from('competitions').select('id', { count: 'exact', head: true }),
          supabase.from('Achievements').select('achievement_id', { count: 'exact', head: true }).eq('international_award', true),
          supabase.from('team_members').select('id', { count: 'exact', head: true }),
          supabase.from('Achievements').select('achievement_id', { count: 'exact', head: true }).eq('national_award', true),
        ]);

        if (competitionsResult.error) {
          console.error('[Hero Stats] Competitions error:', competitionsResult.error.message);
        }
        if (internationalAwardsResult.error) {
          console.error('[Hero Stats] International awards error:', internationalAwardsResult.error.message);
        }
        if (teamMembersResult.error) {
          console.error('[Hero Stats] Team members error:', teamMembersResult.error.message);
        }
        if (nationalAwardsResult.error) {
          console.error('[Hero Stats] National awards error:', nationalAwardsResult.error.message);
        }

        setStats({
          competitions: competitionsResult.count ?? 0,
          internationalAwards: internationalAwardsResult.count ?? 0,
          teamMembers: teamMembersResult.count ?? 0,
          nationalAwards: nationalAwardsResult.count ?? 0,
        });

        console.log('[Hero Stats] Loaded counts:', {
          competitions: competitionsResult.count ?? 0,
          internationalAwards: internationalAwardsResult.count ?? 0,
          teamMembers: teamMembersResult.count ?? 0,
          nationalAwards: nationalAwardsResult.count ?? 0,
        });
      } catch (err: any) {
        console.error('[Hero Stats] Exception:', err?.message || err);
      }
    };

    fetchHeroStats();
  }, []);

  const statCards = [
    { label: 'Competitions', value: stats.competitions },
    ...(stats.internationalAwards > 0
      ? [{ label: 'International Awards', value: stats.internationalAwards }]
      : []),
    { label: 'Team Members', value: stats.teamMembers },
    { label: 'National Awards', value: stats.nationalAwards },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="relative min-h-screen pt-32 pb-12 sm:pt-40 sm:pb-16 overflow-hidden">
        <div className="absolute inset-0 h-full w-full bg-slate-900">
          <div
            className="flex h-full w-full transition-transform duration-1000 ease-in-out"
            style={{
              width: `${CAROUSEL_IMAGES.length * 100}%`,
              transform: `translateX(-${currentImage * (100 / CAROUSEL_IMAGES.length)}%)`,
            }}
          >
            {CAROUSEL_IMAGES.map((src, idx) => (
              <div
                key={idx}
                className="relative h-full shrink-0"
                style={{ width: `${100 / CAROUSEL_IMAGES.length}%` }}
              >
                <img
                  src={src}
                  alt={`Robotics showcase ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/60 mix-blend-multiply pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center pointer-events-none">
          <div className="flex justify-center mb-8 pointer-events-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 backdrop-blur-md border border-slate-700/50">
              <span className="flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,20,60,0.8)] animate-pulse" />
              <span className="text-xs font-medium text-slate-300 tracking-wider uppercase">Competing at the Highest Level</span>
            </div>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight mb-6">
            QCU Robotics <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-500 to-red-500">
              Alpha & Beta
            </span>
          </h1>

          <p className="mt-4 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
            Building excellence through innovation and teamwork. QCU Robotics brings cutting-edge engineering to international robotics competitions with two competitive teams.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pointer-events-auto mb-8">
            <button
              type="button"
              onClick={() => scrollToSection('competitions')}
              className="px-8 py-4 rounded-xl bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              View Competitions <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('members')}
              className="px-8 py-4 rounded-xl bg-slate-800/40 backdrop-blur-md border border-slate-600/50 text-white font-medium hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2"
            >
              Meet Our Teams
            </button>
          </div>

          <div className="flex justify-center items-center gap-3 pointer-events-auto">
            {CAROUSEL_IMAGES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImage(idx)}
                className={`transition-all duration-500 rounded-full ${
                  idx === currentImage
                    ? 'w-10 h-2 bg-gradient-to-r from-red-500 to-red-600 shadow-[0_0_12px_rgba(220,20,60,0.8)]'
                    : 'w-2 h-2 bg-slate-500/70 hover:bg-slate-300'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="relative pt-0 pb-16 sm:pb-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto -mt-8">
            {statCards.map((stat, idx) => (
              <div key={idx} className="min-w-[160px] flex-1 basis-[calc(50%-1rem)] md:basis-[calc(25%-1rem)] p-6 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/50 flex flex-col items-center justify-center shadow-xl">
                <span className="text-3xl font-bold text-white mb-1">{stat.value}</span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Competitions Section ─────────────────────────────────────────────────────
const CompetitionsSection = () => {
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[Competitions] selectedSeason changed:', selectedSeason);
  }, [selectedSeason]);

  useEffect(() => {
    if (seasons.length > 0) {
      console.log(
        '[Competitions] seasons state snapshot:',
        seasons.map((season) => ({ id: season.id, season_name: season.season_name }))
      );
    }
  }, [seasons]);

  useEffect(() => {
    if (competitions.length > 0) {
      console.log(
        '[Competitions] competitions state snapshot:',
        competitions.map((competition) => ({
          id: competition.id,
          title: competition.title,
          season_id: competition.season_id,
          created_at: competition.created_at,
        }))
      );
    }
  }, [competitions]);

  const sortedSeasons = [...seasons].sort((a, b) => {
    const aName = String(a.season_name ?? '').trim();
    const bName = String(b.season_name ?? '').trim();

    if (aName && bName) {
      return bName.localeCompare(aName, undefined, { numeric: true, sensitivity: 'base' });
    }

    return Number(b.id) - Number(a.id);
  });

  const seasonOrderMap = new Map<number, number>(
    sortedSeasons.map((season, index) => [Number(season.id), index])
  );

  useEffect(() => {
    const fetchCompetitionsAndSeasons = async () => {
      try {
        // ── Seasons (always fresh, no cache to avoid stale empty arrays) ──
        const { data: seasonData, error: seasonError } = await supabase
          .from('seasons')
          .select('*')
          .order('id', { ascending: false });

        if (seasonError) {
          console.error('[Seasons] ❌ Error:', seasonError.message);
        } else {
          console.log('[Seasons] ✅ Fetched:', seasonData);
          console.log(
            '[Seasons] 🔎 Normalized order preview:',
            (seasonData ?? []).map((season: any) => ({ id: season.id, season_name: season.season_name }))
          );
          const normalizedSeasons = [...(seasonData ?? [])].sort((a, b) => {
            const aName = String(a.season_name ?? '').trim();
            const bName = String(b.season_name ?? '').trim();

            if (aName && bName) {
              return bName.localeCompare(aName, undefined, { numeric: true, sensitivity: 'base' });
            }

            return Number(b.id) - Number(a.id);
          });

          console.log(
            '[Seasons] ✅ Sorted seasons:',
            normalizedSeasons.map((season: any) => ({ id: season.id, season_name: season.season_name }))
          );
          setSeasons(normalizedSeasons);
          setCachedData('landing-seasons', seasonData ?? []);
        }

        // ── Competitions ──
        let compData = getCachedData('landing-competitions');
        if (!compData) {
          const { data, error } = await supabase
            .from('competitions')
            .select('id, title, status, date, location, created_at, image_url, season_id, seasons ( id, season_name )')
            .order('created_at', { ascending: false });

          if (error) {
            console.error('[Competitions] ❌ Error:', error.message);
          } else {
            compData = data ?? [];
            console.log('[Competitions] ✅ Fetched:', compData);
            console.log(
              '[Competitions] 🔎 Competition season mapping:',
              (compData ?? []).map((competition: any) => ({
                id: competition.id,
                title: competition.title,
                season_id: competition.season_id,
                season_name: Array.isArray(competition.seasons)
                  ? competition.seasons[0]?.season_name ?? null
                  : competition.seasons?.season_name ?? null,
              }))
            );
            setCachedData('landing-competitions', compData);
          }
        } else {
          console.log(
            '[Competitions] ♻️ Using cached competitions:',
            compData.map((competition: any) => ({
              id: competition.id,
              title: competition.title,
              season_id: competition.season_id,
              season_name: Array.isArray(competition.seasons)
                ? competition.seasons[0]?.season_name ?? null
                : competition.seasons?.season_name ?? null,
            }))
          );
        }
        if (compData) setCompetitions(compData);

      } catch (err: any) {
        console.error('[Competitions] ❌ Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitionsAndSeasons();
  }, []);

  const filteredCompetitions =
    selectedSeason === 'all'
      ? competitions
      : competitions.filter((c) => Number(c.season_id) === Number(selectedSeason));

  const seasonNameById = new Map(
    seasons.map((season) => [Number(season.id), String(season.season_name ?? '').trim()])
  );

  const sortedCompetitions = [...filteredCompetitions].sort((a, b) => {
    const seasonOrderA = seasonOrderMap.get(Number(a.season_id)) ?? Number.MAX_SAFE_INTEGER;
    const seasonOrderB = seasonOrderMap.get(Number(b.season_id)) ?? Number.MAX_SAFE_INTEGER;

    if (seasonOrderA !== seasonOrderB) {
      return seasonOrderA - seasonOrderB;
    }

    const seasonNameA = seasonNameById.get(Number(a.season_id)) ?? '';
    const seasonNameB = seasonNameById.get(Number(b.season_id)) ?? '';

    if (seasonNameA !== seasonNameB) {
      return seasonNameB.localeCompare(seasonNameA, undefined, { numeric: true, sensitivity: 'base' });
    }

    const aCreatedAt = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreatedAt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bCreatedAt - aCreatedAt;
  });

  useEffect(() => {
    console.log('[Competitions] filter summary:', {
      selectedSeason,
      totalCompetitions: competitions.length,
      matchedCompetitions: filteredCompetitions.length,
      sortedCompetitions: sortedCompetitions.length,
      seasonIds: competitions.map((competition) => competition.season_id),
      seasonNames: competitions.map((competition) => seasonNameById.get(Number(competition.season_id)) ?? null),
    });
  }, [selectedSeason, competitions, filteredCompetitions.length, sortedCompetitions.length, seasonNameById]);

  if (loading) {
    return (
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <SkeletonCompetitionCard key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="competitions" className="py-24 relative z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                Featured Competitions
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Competitions &{' '}
              <span className="bg-gradient-to-r from-red-400 via-red-500 to-orange-500 bg-clip-text text-transparent">
                Achievements
              </span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              QCU Robotics competes at the highest level, showcasing innovation and engineering
              excellence across multiple prestigious competitions worldwide.
            </p>
          </div>

          <a
            href="#"
            className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 font-medium transition-colors mt-6"
          >
            View All Events <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* Season Filter Dropdown */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 px-5 py-3 rounded-2xl shadow-xl">
            <span className="text-slate-400 text-sm font-medium whitespace-nowrap">
              Filter by Season:
            </span>
            <div className="relative">
              <select
                value={selectedSeason}
                onChange={(e) =>
                  setSelectedSeason(
                    e.target.value === 'all' ? 'all' : Number(e.target.value)
                  )
                }
                disabled={seasons.length === 0}
                className="appearance-none bg-slate-800 border border-slate-600 text-white text-sm font-semibold rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer hover:bg-slate-700 transition-colors min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">
                  {sortedSeasons.length === 0 ? 'No seasons found' : 'All Seasons'}
                </option>
                {sortedSeasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.season_name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Competition Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCompetitions.length > 0 ? (
            sortedCompetitions.map((comp, idx) => (
              <div
                key={comp.id}
                className="group relative overflow-hidden rounded-2xl transition-all duration-500 hover:scale-105"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 via-slate-900/30 to-slate-950/50 backdrop-blur-xl border border-slate-700/40 group-hover:border-red-500/30 transition-colors duration-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-red-500/10 via-transparent to-orange-600/5" />
                <div className="relative z-10 p-8 flex flex-col h-full">
                  {comp.image_url ? (
                    <div className="mb-6 -mx-8 -mt-8 h-40 bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-t-2xl overflow-hidden flex items-center justify-center group-hover:opacity-90 transition-opacity">
                      <img
                        src={comp.image_url}
                        alt={comp.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="mb-6 -mx-8 -mt-8 h-40 rounded-t-2xl overflow-hidden relative bg-gradient-to-br from-red-950/80 via-slate-900 to-slate-950 border-b border-white/5">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(248,113,113,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.16),transparent_32%)]" />
                      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
                      <div className="relative h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 shadow-[0_0_24px_rgba(239,68,68,0.18)]">
                          <Trophy className="w-7 h-7 text-red-300" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-200/80">
                            Competition Spotlight
                          </p>
                          <p className="mt-1 text-sm text-slate-300/80">
                            No cover image available
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider transition-all duration-300 ${
                        comp.status === 'Active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : comp.status === 'Recent'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}
                    >
                      {comp.status}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{comp.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-100 transition-colors">
                    {comp.title}
                  </h3>
                  <p className="text-slate-400 text-sm font-medium mb-4 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-500" />
                    {comp.location}
                  </p>
                  <div className="mt-auto flex gap-3">
                    <Link
                      href={`/matches?id=${comp.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors py-2 px-3 rounded-lg bg-red-600/10 border border-red-500/30 hover:bg-red-600/20"
                    >
                      <span>Matches</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                      href={`/achievements?id=${comp.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-amber-400 group-hover:text-amber-300 transition-colors py-2 px-3 rounded-lg bg-amber-600/10 border border-amber-500/30 hover:bg-amber-600/20"
                    >
                      <span>Achievements</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-500 md:col-span-2 lg:col-span-3 text-center py-12 bg-slate-900/30 rounded-2xl border border-slate-800/50">
              No competitions found for the selected season.
            </p>
          )}
        </div>

      </div>
    </section>
  );
};

// ─── About Section ────────────────────────────────────────────────────────────
const AboutSection = () => (
  <section id="about-us" className="py-24 relative z-10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="rounded-3xl overflow-hidden border border-slate-700/50 shadow-[0_0_40px_rgba(220,20,60,0.15)]">
          <img
            src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2000&auto=format&fit=crop"
            alt="QCU Robotics Team"
            className="w-full h-96 object-cover"
          />
        </div>
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">About QCU Robotics</h2>
          <div className="space-y-4 mb-8">
            <p className="text-slate-400 leading-relaxed">
              QCU Robotics is a premier competitive robotics organization dedicated to fostering innovation, teamwork, and technical excellence. Our organization brings together talented engineers, programmers, and designers who share a passion for robotics.
            </p>
            <p className="text-slate-400 leading-relaxed">
              Built on a foundation of collaboration and continuous improvement, QCU Robotics has established itself as a powerhouse in the competitive robotics community.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="p-6 rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-700/30">
              <span className="text-2xl font-bold text-red-400">2</span>
              <p className="text-slate-400 text-sm mt-2">Competitive Teams</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-700/30">
              <span className="text-2xl font-bold text-red-400">45+</span>
              <p className="text-slate-400 text-sm mt-2">Active Members</p>
            </div>
          </div>
          <button className="px-8 py-3 rounded-xl bg-red-600/80 backdrop-blur-sm border border-red-500/50 text-white font-medium hover:bg-red-700/80 transition-all shadow-[0_0_15px_rgba(220,20,60,0.2)] hover:shadow-[0_0_20px_rgba(220,20,60,0.4)]">
            Join Our Community
          </button>
        </div>
      </div>
    </div>
  </section>
);

// ─── Member Card ──────────────────────────────────────────────────────────────
const MemberCard = ({ member }: { member: any }) => {
  const [avatarUrl] = useState(member.profile_image_url ?? null);
  const seasons = extractSeasons(member.season);

  const accentText   = 'text-blue-300';
  const accentBg     = 'bg-blue-900/50';
  const accentBorder = 'border-blue-500/40';
  const gradientBg   = 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20';
  const hoverGlow    = 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]';

  return (
    <div className={`group p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 relative overflow-hidden transition-all duration-300 hover:border-slate-600/80 ${hoverGlow}`}>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity">
        <div className={`w-full h-full rounded-full ${gradientBg}`} />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Avatar */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={member.name}
              className="w-24 h-24 rounded-full object-cover border-2 border-slate-600 shadow-lg"
            />
          ) : (
            <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 ${accentBg} ${accentBorder}`}>
              <span className={`text-4xl font-bold ${accentText}`}>{member.name?.charAt(0) || 'M'}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <h4 className="text-lg font-bold text-white text-center mb-2 group-hover:text-slate-100 transition-colors">
          {member.name}
        </h4>

        {/* Role */}
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${accentBg} ${accentBorder} border text-center mb-3`}>
          <p className={`text-xs font-semibold ${accentText} uppercase tracking-wider`}>
            {formatRoleData(member.role)}
          </p>
        </div>

        {/* Season badges — one pill per season string, never combined */}
        {seasons.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {seasons.map((s, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-600/70 text-slate-300"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400/80 animate-pulse" />
          <span className="text-xs text-slate-400">Active Member</span>
        </div>
      </div>

      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl bg-gradient-to-br from-slate-700/20 via-transparent to-slate-700/20" />
    </div>
  );
};

const TeamMembersSection = () => {
  const [team1Members, setTeam1Members] = useState<any[]>([]);
  const [team2Members, setTeam2Members] = useState<any[]>([]);
  const [teams, setTeams]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedSeason, setSelectedSeason]     = useState('All');
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);

  useEffect(() => {
    const fetchTeamsData = async () => {
      try {
        let teamsData = getCachedData('team-members-teams');
        if (!teamsData) {
          const { data, error } = await supabase.from('teams').select('*').order('team_number');
          if (error) console.error('[TeamMembers] Teams error:', error.message);
          else { teamsData = data; setCachedData('team-members-teams', data); }
        }
        if (teamsData) setTeams(teamsData);

        let membersData = getCachedData('team-members-members');
        if (!membersData) {
          const { data, error } = await supabase.from('team_members').select('*').order('id');
          if (error) console.error('[TeamMembers] Members error:', error.message);
          else { membersData = data; setCachedData('team-members-members', data); }
        }

        if (membersData) {
          // Debug: log raw season values to confirm DB shape
          console.log('[TeamMembers] Raw season values:',
            membersData.map((m: any) => ({ name: m.name, season: m.season }))
          );

          const seasonsSet = new Set<string>();
          membersData.forEach((m: any) => {
            const parsed = extractSeasons(m.season);
            console.log(`[TeamMembers] ${m.name} seasons:`, parsed);
            parsed.forEach((s) => seasonsSet.add(s));
          });

          const sorted = Array.from(seasonsSet).sort();
          console.log('[TeamMembers] Available seasons:', sorted);
          setAvailableSeasons(sorted);

          setTeam1Members(membersData.filter((m: any) => m.team_number === 1));
          setTeam2Members(membersData.filter((m: any) => m.team_number === 2));
        }
      } catch (err: any) {
        console.error('[TeamMembers] Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamsData();
  }, []);

  const filterBySeason = (members: any[]) =>
    selectedSeason === 'All'
      ? members
      : members.filter((m) => extractSeasons(m.season).includes(selectedSeason));

  const teamLabel = (data: any, num: number) =>
    `${data?.team_code ?? `Team ${num}`}${data?.team_name ? ` - ${data.team_name}` : ''}`;

  if (loading) {
    return (
      <section className="py-24 relative z-10 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {[...Array(2)].map((_, t) => (
              <div key={t}>
                <div className="h-8 w-1/2 bg-slate-700/50 rounded mb-8 animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => <SkeletonTeamMemberCard key={i} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const team1Data = teams.find((t) => t.team_number === 1);
  const team2Data = teams.find((t) => t.team_number === 2);

  return (
    <section id="members" className="py-24 relative z-10 bg-slate-950/50 scroll-mt-28 md:scroll-mt-32">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Our Team</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Meet Our Teams</h2>
          <p className="text-slate-400 text-lg">
            Dedicated engineers and innovators working together to achieve excellence in competitive robotics.
          </p>
        </div>

        {/* Season dropdown — always visible, shows "No seasons found" if DB has no data */}
        <div className="flex justify-center mb-14">
          <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-md border border-slate-700/50 px-5 py-3 rounded-2xl shadow-xl">
            <span className="text-slate-400 text-sm font-medium whitespace-nowrap">Filter by Season:</span>
            <div className="relative">
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                disabled={availableSeasons.length === 0}
                className="appearance-none bg-slate-800 border border-slate-600 text-white text-sm font-semibold rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:bg-slate-700 transition-colors min-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="All">
                  {availableSeasons.length === 0 ? 'No seasons in DB' : 'All Seasons'}
                </option>
                {availableSeasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Team 1 */}
        <div className="mb-20">
          <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            {teamLabel(team1Data, 1)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filterBySeason(team1Members).length > 0
              ? filterBySeason(team1Members).map((m) => <MemberCard key={m.id} member={m} />)
              : <p className="text-slate-500 text-sm col-span-full py-8 italic bg-slate-900/30 rounded-xl px-6 border border-slate-800/50">No members found for this season.</p>
            }
          </div>
        </div>

        {/* Team 2 */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            {teamLabel(team2Data, 2)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filterBySeason(team2Members).length > 0
              ? filterBySeason(team2Members).map((m) => <MemberCard key={m.id} member={m} />)
              : <p className="text-slate-500 text-sm col-span-full py-8 italic bg-slate-900/30 rounded-xl px-6 border border-slate-800/50">No members found for this season.</p>
            }
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Coaches Section ──────────────────────────────────────────────────────────
const CoachesSection = () => {
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const cached = getCachedData('coaches');
        if (cached) { setCoaches(cached); setLoading(false); return; }

        const { data, error } = await supabase.from('Coaches').select('*').order('id');
        if (error) {
          console.error('[Coaches] ❌ Error:', error.message);
        } else if (data) {
          setCachedData('coaches', data);
          setCoaches(data);
        }
      } catch (err: any) {
        console.error('[Coaches] ❌ Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchCoaches();
  }, []);

  return (
    <section id="coaches" className="py-24 relative z-10 bg-slate-950/50">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Leadership</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Meet Our Coaches</h2>
          <p className="text-slate-400 text-lg">Expert mentors guiding our teams to victory and fostering the next generation of robotic enthusiasts.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(4)].map((_, i) => <SkeletonCoachCard key={i} />)}
          </div>
        ) : coaches.length === 0 ? (
          <p className="text-slate-500 text-center py-12">No coaches added yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-md border border-slate-700/50 transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              >
                <div className="relative h-64 overflow-hidden bg-slate-950">
                  {coach.image_url ? (
                    <img
                      src={coach.image_url}
                      alt={coach.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                      <Cpu className="w-16 h-16 text-slate-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-1">{coach.name}</h3>
                  <p className="text-sm text-purple-300 font-medium">Team Coach</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');

  const handleSignup = async () => {
    if (!email || !email.includes('@')) return;
    setStatus('loading');
    const { error } = await supabase.from('email_signups').insert([{ email }]);
    if (error) { setStatus('error'); }
    else { setStatus('success'); setEmail(''); }
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 backdrop-blur-lg pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-xs">Q</div>
              <span className="text-lg font-bold text-white">QCU ROBOTICS</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Competing at the highest level. QCU Robotics Team brings innovation and excellence to international robotics competitions.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
              </a>
            </div>
          </div>

          {/* Competitions */}
          <div>
            <h4 className="text-white font-semibold mb-4">Competitions</h4>
            <ul className="space-y-2">
              {['FIRST Robotics', 'VEX Robotics', 'Robotic Sumo', 'Aerial Robotics'].map((link) => (
                <li key={link}><a href="#" className="text-slate-400 hover:text-red-400 text-sm transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>

          {/* Organization */}
          <div>
            <h4 className="text-white font-semibold mb-4">Organization</h4>
            <ul className="space-y-2">
              {['About QCU Robotics', 'Our Teams', 'Achievements', 'Community Partners'].map((link) => (
                <li key={link}><a href="#" className="text-slate-400 hover:text-red-400 text-sm transition-colors">{link}</a></li>
              ))}
            </ul>
          </div>

          {/* Email Signup */}
          <div>
            <h4 className="text-white font-semibold mb-4">Get Involved</h4>
            <p className="text-slate-400 text-sm mb-4">Join our mailing list for updates on competitions and team announcements.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                placeholder="Enter email"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-full"
                disabled={status === 'loading'}
              />
              <button
                onClick={handleSignup}
                disabled={status === 'loading'}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 transition-colors"
              >
                {status === 'loading' ? '...' : <Mail className="w-4 h-4" />}
              </button>
            </div>
            {status === 'success' && <p className="text-green-400 text-xs mt-2">You're on the list!</p>}
            {status === 'error'   && <p className="text-red-400   text-xs mt-2">Already signed up or invalid email.</p>}
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2026 QCU Robotics. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Privacy Policy</a>
            <a href="#" className="text-slate-500 hover:text-white text-sm transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ─── Page Root ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-red-500/30">
      <AmbientBackground />
      <Navbar />
      <main>
        <Hero />
        <CompetitionsSection />
        <AboutSection />
        <TeamMembersSection />
        <CoachesSection />
      </main>
      <Footer />
    </div>
  );
}