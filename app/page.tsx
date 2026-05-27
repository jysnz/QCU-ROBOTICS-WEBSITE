"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Trophy,
  Rocket,
  Activity,
  Zap,
  ChevronRight,
  Menu,
  X,
  Mail,
  Bot,
  Cpu,
  Shield,
  ArrowUpRight,
} from 'lucide-react';

// ─── Supabase Client ──────────────────────────────────────────────────────────
// Added fallback strings to prevent createClient from throwing an error in preview environments
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Initial Debug Logging ────────────────────────────────────────────────────
console.log('[Init] Supabase URL:', supabaseUrl);
console.log('[Init] Supabase Key valid:', supabaseKey !== 'placeholder-key');

if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder-key') {
  console.warn('[Init] ⚠️ SUPABASE CREDENTIALS MISSING - using placeholders');
}

async function uploadMemberAvatar(
  file: File,
  memberId: string
) {
  const fileExt = file.name.split('.').pop();

  const filePath = `member-${memberId}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  return filePath;
}

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

// ─── Icon Map ─────────────────────────────────────────────────────────────────
const iconMap = {
  trophy: <Trophy className="w-8 h-8 text-red-400" />,
  rocket: <Rocket className="w-8 h-8 text-yellow-400" />,
  activity: <Activity className="w-8 h-8 text-red-300" />,
  zap: <Zap className="w-8 h-8 text-yellow-500" />,
};

// ─── Ambient Background ───────────────────────────────────────────────────────
const AmbientBackground = () => (
  <div className="fixed inset-0 z-[-1] bg-slate-950 overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-red-900/20 blur-[120px] mix-blend-screen" />
    <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[60%] rounded-full bg-yellow-900/20 blur-[100px] mix-blend-screen" />
    <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-red-800/10 blur-[90px] mix-blend-screen" />
    <div className="absolute inset-0 opacity-50"
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
                    console.error('[Navbar Debug] Failed to load logo from /Images/logo1.jpg');
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
                href={`#${item.toLowerCase().replace(' ', '-')}`}
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
                  href={`#${item.toLowerCase().replace(' ', '-')}`}
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

// Fallback high-quality robotics/tech images from Unsplash in case local paths 404 on network
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

  useEffect(() => {
    console.log('[Carousel Debug] Carousel Component Mounted.');
    console.log(`[Carousel Debug] Starting interval for ${CAROUSEL_IMAGES.length} images.`);
    
    const timer = setInterval(() => {
      setCurrentImage((prev) => {
        const nextIndex = (prev + 1) % CAROUSEL_IMAGES.length;
        console.log(`[Carousel Debug] Transitioning to image index: ${nextIndex}`);
        return nextIndex;
      });
    }, 4000);
    
    return () => {
      console.log('[Carousel Debug] Cleaning up interval.');
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Carousel Section */}
      <div className="relative min-h-screen pt-32 pb-12 sm:pt-40 sm:pb-16 overflow-hidden">
        {/* Carousel Background */}
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
                  onLoad={() => console.log(`[Carousel Debug] Image ${idx} loaded successfully:`, src)}
                  onError={(e) => {
                    console.error(`[Carousel Debug] ERROR: Failed to load image ${idx}:`, src);
                    console.warn(`[Carousel Debug] RECOVERY: Applying fallback remote image for index ${idx}.`);
                    e.currentTarget.src = FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/60 mix-blend-multiply pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent pointer-events-none" />
              </div>
            ))}
          </div>
        </div>

        {/* Hero Content */}
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
            <button className="px-8 py-4 rounded-xl bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              View Competitions <ChevronRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 rounded-xl bg-slate-800/40 backdrop-blur-md border border-slate-600/50 text-white font-medium hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2">
              Meet Our Teams
            </button>
          </div>

          {/* Carousel Indicators - Below Buttons */}
          <div className="flex justify-center items-center gap-3 pointer-events-auto">
            {CAROUSEL_IMAGES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  console.log(`[Carousel Debug] User clicked dot indicator for index: ${idx}`);
                  setCurrentImage(idx);
                }}
                className={`transition-all duration-500 rounded-full ${
                  idx === currentImage
                    ? 'w-10 h-2 bg-gradient-to-r from-red-500 to-red-600 shadow-[0_0_12px_rgba(220,20,60,0.8)]'
                    : 'w-2 h-2 bg-slate-500/70 hover:bg-slate-300'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
                title={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="relative pt-0 pb-16 sm:pb-20 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto -mt-8">
            {[
              { label: 'Competitions', value: '12+' },
              { label: 'International Awards', value: '8' },
              { label: 'Team Members', value: '45+' },
              { label: 'Championships', value: '3' },
            ].map((stat, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/50 flex flex-col items-center justify-center shadow-xl">
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
  console.log('[CompetitionsSection] Component rendering');
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[CompetitionsSection] useEffect hook running');
    const fetchCompetitions = async () => {
      try {
        console.log('[Competitions] Fetching...');
        
        const { data, error } = await supabase
          .from('competitions')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('[Competitions] ❌ Error:', error.message);
        } else {
          console.log('[Competitions] ✅ Fetched:', data?.length || 0, 'items');
          setCompetitions(data ?? []);
        }
      } catch (err: any) {
        console.error('[Competitions] ❌ Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCompetitions();
  }, []);

  if (loading) {
    return (
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400">Loading competitions...</div>
      </section>
    );
  }

  return (
    <section id="competitions" className="py-24 relative z-10">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Featured Competitions</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Competitions & <span className="bg-gradient-to-r from-red-400 via-red-500 to-orange-500 bg-clip-text text-transparent">Achievements</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">QCU Robotics competes at the highest level, showcasing innovation and engineering excellence across multiple prestigious competitions worldwide.</p>
          </div>
          <a href="#" className="hidden md:inline-flex items-center gap-2 text-red-400 hover:text-red-300 font-medium transition-colors mt-6 md:mt-0">
            View All Events <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {competitions.length > 0 ? competitions.map((comp, idx) => (
            <div
              key={comp.id}
              className="group relative overflow-hidden rounded-2xl transition-all duration-500 hover:scale-105"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Card background with gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 via-slate-900/30 to-slate-950/50 backdrop-blur-xl border border-slate-700/40 group-hover:border-red-500/30 transition-colors duration-500" />
              
              {/* Animated gradient overlay on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-red-500/10 via-transparent to-orange-600/5" />
              
              {/* Content */}
              <div className="relative z-10 p-8 flex flex-col h-full">
                {/* Image container - only show if image_url exists */}
                {comp.image_url && (
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
                )}

                {/* Icon container */}
                {/* Removed */}

                {/* Status and date */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider transition-all duration-300 ${
                    comp.status === 'Active'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : comp.status === 'Recent'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  }`}>
                    {comp.status}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{comp.date}</span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-100 transition-colors">{comp.title}</h3>

                {/* Location */}
                <p className="text-slate-400 text-sm font-medium mb-4 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-500" />
                  {comp.location}
                </p>

                {/* Button - fixed at bottom */}
                <button className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors relative overflow-hidden">
                  <span>Learn More</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/20 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                </button>
              </div>

              {/* Border glow effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl bg-gradient-to-br from-red-500/20 via-transparent to-orange-500/20" />
            </div>
          )) : (
            <p className="text-slate-500 md:col-span-2 lg:col-span-3 text-center py-12">No active competitions found or waiting for database connection.</p>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Matches Section ──────────────────────────────────────────────────────────
const MatchesSection = () => {
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
        console.log('[Matches] Fetching competitions...');
        const { data: compData, error: compError } = await supabase.from('competitions').select('id, title');
        
        if (compError) {
          console.error('[Matches] ❌ Error:', compError.message);
          return;
        }
        
        console.log('[Matches] Fetching teams...');
        const { data: teamData, error: teamError } = await supabase.from('teams').select('id, team_code, team_name');
        
        if (teamError) {
          console.error('[Matches] ❌ Team Error:', teamError.message);
          return;
        }
        
        if (compData && compData.length > 0) {
          console.log('[Matches] ✅ Fetched:', compData.length, 'competitions');
          setCompetitions(compData);
          setSelectedComp(compData[0].id);
        }
        
        if (teamData && teamData.length > 0) {
          console.log('[Matches] ✅ Fetched teams:', teamData);
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
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Match Results</h2>
            <p className="text-slate-400">Track scores and watch match footage for each competition.</p>
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
              With two competitive teams, we participate in international robotics competitions including FIRST Robotics, VEX Robotics, and specialized robotic sports events. Our mission is to inspire the next generation of engineers while pushing the boundaries of what's possible in robotics technology.
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
const formatRoleData = (role: any): string => {
  if (!role) return 'Team Member';
  
  // If it's a string, return as-is
  if (typeof role === 'string') return role;
  
  // If it's a jsonb object
  if (typeof role === 'object') {
    // Handle roles array format: { roles: ["Programmer", "Builder"] }
    if (Array.isArray(role.roles) && role.roles.length > 0) {
      return role.roles.join(' • ');
    }
    // Handle other potential formats
    if (role.title) return role.title;
    if (role.department) return role.department;
  }
  
  return 'Team Member';
};

const MemberCard = ({ member }: { member: any }) => {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(member.profile_image_url ?? null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const publicUrl = await uploadMemberAvatar(file, member.id);
      const { error } = await supabase
        .from('team_members')
        .update({ profile_image_url: publicUrl })
        .eq('id', member.id);
      if (error) throw error;
      setAvatarUrl(publicUrl);
    } catch (err: any) {
      console.error('Avatar upload failed:', err?.message || err);
    } finally {
      setUploading(false);
    }
  };

  // Unified blue color scheme for all teams
  const accentText = 'text-blue-300';
  const accentBg = 'bg-blue-900/50';
  const accentBorder = 'border-blue-500/40';
  const gradientBg = 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20';
  const hoverGlowColor = 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]';

  return (
    <div className={`group p-8 rounded-3xl bg-gradient-to-b from-slate-800/40 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 relative overflow-hidden transition-all duration-300 hover:border-slate-600/80 ${hoverGlowColor}`}>
      {/* Background accent decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity">
        <div className={`w-full h-full rounded-full ${gradientBg}`} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Avatar */}
        <div className="relative w-24 h-24 mx-auto mb-6 group/avatar">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={member.name}
              className="w-24 h-24 rounded-full object-cover border-2 border-slate-600 group-hover/avatar:border-slate-500 transition-all duration-300 shadow-lg"
            />
          ) : (
            <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 ${accentBg} ${accentBorder} transition-all duration-300`}>
              <span className={`text-4xl font-bold ${accentText}`}>{member.name?.charAt(0) || 'M'}</span>
            </div>
          )}
          {/* Hover upload overlay */}
          <label className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
            <span className="text-white text-xs font-medium">{uploading ? '...' : 'Upload'}</span>
          </label>
        </div>

        {/* Name */}
        <h4 className="text-lg font-bold text-white text-center mb-2 group-hover:text-slate-100 transition-colors">{member.name}</h4>
        
        {/* Role */}
        <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${accentBg} ${accentBorder} border text-center mb-4 transition-all duration-300`}>
          <p className={`text-xs font-semibold ${accentText} uppercase tracking-wider`}>
            {formatRoleData(member.role)}
          </p>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400/80 animate-pulse" />
          <span className="text-xs text-slate-400">Active Member</span>
        </div>
      </div>

      {/* Border glow effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl bg-gradient-to-br from-slate-700/20 via-transparent to-slate-700/20" />
    </div>
  );
};

// ─── Team Members Section ─────────────────────────────────────────────────────
const TeamMembersSection = () => {
  console.log('[TeamMembersSection] Component rendering');
  const [team1Members, setTeam1Members] = useState<any[]>([]);
  const [team2Members, setTeam2Members] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    try {
      console.log('[TeamMembers] Fetching teams and members...');
      
      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase.from('teams').select('*').order('team_number');
      if (teamsError) {
        console.error('[TeamMembers] ❌ Teams Error:', teamsError.message);
        return;
      }
      if (teamsData) {
        console.log('[TeamMembers] ✅ Fetched teams:', teamsData);
        setTeams(teamsData);
      }

      // Fetch members
      const { data: membersData, error: membersError } = await supabase.from('team_members').select('*').order('id');
      
      if (membersError) {
        console.error('[TeamMembers] ❌ Members Error:', membersError.message);
        return;
      }
      
      if (membersData) {
        const team1 = membersData.filter((m) => m.team_number === 1);
        const team2 = membersData.filter((m) => m.team_number === 2);
        console.log('[TeamMembers] ✅ Fetched: Team 1:', team1.length, '| Team 2:', team2.length);
        setTeam1Members(team1);
        setTeam2Members(team2);
      }
    } catch (err: any) {
      console.error('[TeamMembers] ❌ Exception:', err?.message || err);
    }
  };

  useEffect(() => {
    console.log('[TeamMembersSection] useEffect hook running');
    refetch().then(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-24 relative z-10 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400">Loading team...</div>
      </section>
    );
  }

  const team1Data = teams.find((t) => t.team_number === 1);
  const team2Data = teams.find((t) => t.team_number === 2);

  return (
    <section id="teams" className="py-24 relative z-10 bg-slate-950/50">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Our Team</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Meet Our Teams</h2>
          <p className="text-slate-400 text-lg">Dedicated engineers and innovators working together to achieve excellence in competitive robotics.</p>
        </div>

        {/* Team 1 */}
        <div className="mb-20">
          <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            {team1Data?.team_code ? `${team1Data.team_code}` : `Team ${team1Data?.team_number}`}{team1Data?.team_name ? ` - ${team1Data.team_name}` : ''}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team1Members.length > 0 ? team1Members.map((member) => (
              <MemberCard key={member.id} member={member} />
            )) : <p className="text-slate-500 text-sm col-span-full text-center py-12">No members added yet.</p>}
          </div>
        </div>

        {/* Team 2 */}
        <div>
          <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
            {team2Data?.team_code ? `${team2Data.team_code}` : `Team ${team2Data?.team_number}`}{team2Data?.team_name ? ` - ${team2Data.team_name}` : ''}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team2Members.length > 0 ? team2Members.map((member) => (
              <MemberCard key={member.id} member={member} />
            )) : <p className="text-slate-500 text-sm col-span-full text-center py-12">No members added yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Coaches Section ──────────────────────────────────────────────────────────
const CoachesSection = () => {
  console.log('[CoachesSection] Component rendering');
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[CoachesSection] useEffect hook running');
    const fetchCoaches = async () => {
      try {
        console.log('[Coaches] Fetching coaches...');
        const { data, error } = await supabase.from('Coaches').select('*').order('id');
        
        if (error) {
          console.error('[Coaches] ❌ Error:', error.message);
          return;
        }
        
        if (data) {
          console.log('[Coaches] ✅ Fetched:', data.length, 'coaches');
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
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Leadership</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Meet Our Coaches</h2>
          <p className="text-slate-400 text-lg">Expert mentors guiding our teams to victory and fostering the next generation of robotic enthusiasts.</p>
        </div>

        {/* Coaches Grid */}
        {loading ? (
          <p className="text-slate-400 text-center py-12">Loading coaches...</p>
        ) : coaches.length === 0 ? (
          <p className="text-slate-500 text-center py-12">No coaches added yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-md border border-slate-700/50 transition-all duration-300 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              >
                {/* Coach Image */}
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
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Coach Info */}
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
    if (error) {
      setStatus('error');
    } else {
      setStatus('success');
      setEmail('');
    }
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 backdrop-blur-lg pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-xs">
                Q
              </div>
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
        <MatchesSection />
        <AboutSection />
        <TeamMembersSection />
        <CoachesSection />
      </main>
      <Footer />
    </div>
  );
}