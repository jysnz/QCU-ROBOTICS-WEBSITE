"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { LoadingSpinner, SkeletonCompetitionCard } from './components/LoadingSpinner';
import {
  Trophy,
  Rocket,
  Activity,
  Zap,
  ChevronRight,
  Menu,
  X,
  Shield,
  ArrowUpRight,
  Globe,
  ChevronDown,
  Search,
} from 'lucide-react';
import Dropdown from './components/Dropdown';
import type { HeroStats, Season, Competition, TeamMember, MediaMember, Member, Coach, SponsorCompany } from './lib/data';
import CountUp from './components/CountUp';

// ─── Props passed from the server component ───────────────────────────────────
export type HomeClientProps = {
  initialHeroStats: HeroStats;
  initialSeasons: Season[];
  initialCompetitions: Competition[];
  initialTeamMembers: TeamMember[];
  initialMediaTeam: MediaMember[];
  initialMembers: Member[];
  initialCoaches: Coach[];
  initialSponsors: SponsorCompany[];
};

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'website' },
});

console.log('[Init] Supabase URL:', supabaseUrl);
console.log('[Init] Supabase Key valid:', supabaseKey !== 'placeholder-key');

if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseKey === 'placeholder-key') {
  console.warn('[Init] ⚠️ SUPABASE CREDENTIALS MISSING - using placeholders');
}

const getSafeExternalUrl = (value: string | null | undefined) => {
  if (!value) return null;

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
};

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

const getSocialIcon = (platform: string) => {
  const normalizedPlatform = platform.trim().toLowerCase();

  if (normalizedPlatform.includes('facebook')) return FacebookIcon;
  if (normalizedPlatform.includes('instagram')) return InstagramIcon;
  if (normalizedPlatform.includes('linkedin')) return LinkedinIcon;
  if (normalizedPlatform.includes('youtube')) return YoutubeIcon;
  if (normalizedPlatform === 'x' || normalizedPlatform.includes('twitter')) return XIcon;
  if (normalizedPlatform.includes('github')) return GithubIcon;

  return Globe;
};

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5H16V4.6c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.3-3.8 3.8V11H7.6V14H10v8h3.5z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M6.94 6.5A1.94 1.94 0 1 1 3.06 6.5a1.94 1.94 0 0 1 3.88 0ZM3.5 9h3v12h-3V9Zm5 0h2.9v1.6h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V21h-3v-6.2c0-1.5 0-3.5-2.1-3.5s-2.4 1.6-2.4 3.4V21h-3V9Z" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M18.9 3H21l-6.9 7.9L22 21h-6.8l-5.3-6.1L4.6 21H2.5l7.4-8.5L2 3h6.9l4.8 5.5L18.9 3Zm-1.2 16h1.9L8.1 4.9H6L17.7 19Z" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M21.6 8.2s-.2-1.4-.8-2c-.8-.8-1.7-.8-2.1-.9C16 5 12 5 12 5h0s-4 0-6.7.3c-.4 0-1.3.1-2.1.9-.6.6-.8 2-.8 2S2 9.8 2 11.3v1.4C2 14.2 2.4 15.6 2.4 15.6s.2 1.4.8 2c.8.8 1.8.8 2.2.9 1.6.1 6.6.2 6.6.2s4 0 6.7-.3c.4 0 1.3-.1 2.1-.9.6-.6.8-2 .8-2s.4-1.4.4-2.9v-1.4c0-1.5-.4-2.9-.4-2.9ZM10 15V9l5.2 3-5.2 3Z" />
  </svg>
);

const GithubIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M12 .8A11.2 11.2 0 0 0 8.5 22.6c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.4-1-.9-1.3-.9-1.3-.7-.5.1-.5.1-.5.8.1 1.3.8 1.3.8.7 1.3 1.9.9 2.4.7.1-.6.3-.9.5-1.1-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.6s.8-.2 2.7 1a9.2 9.2 0 0 1 5 0c1.9-1.2 2.7-1 2.7-1a3.6 3.6 0 0 1 .1 2.6 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .3.3.6.8.6 1.6v2.4c0 .3.2.6.7.5A11.2 11.2 0 0 0 12 .8Z" />
  </svg>
);

// ─── Carousel Images ──────────────────────────────────────────────────────────
const CAROUSEL_IMAGES = [
  "/Images/carouselImage1.jpg",
  "/Images/carouselImage2.jpg",
  "/Images/CarouselImage3.jpg",
  "/Images/CarouselImage4.jpg",
  "/Images/CarouselImage5.jpg",
];

const ABOUT_CAROUSEL_IMAGES = [
  '/Images/aboutImage1.jpg',
  '/Images/aboutImage2.jpg',
  '/Images/aboutImage3.jpg',
  '/Images/aboutImage4.jpg',
  '/Images/aboutImage5.jpg',
];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1563207153-f403bf289096?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1535378917042-10a22c95931a?q=80&w=2000&auto=format&fit=crop",
];

// ─── Hero ─────────────────────────────────────────────────────────────────────
// Headline "decode" effect: glyphs resolve left to right into the real text once the intro is done.
// The real text is always in the layout (invisible) so nothing shifts, and SSR renders the final text.
const DECODE_GLYPHS = '01<>/[]{}#$%&*+=?';
const DecodeText = ({ text }: { text: string }) => {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min((t - t0) / 1000, 1);
        const settled = Math.floor(p * text.length);
        setOut(text.split('').map((c, i) => (c === ' ' || i < settled ? c : DECODE_GLYPHS[Math.floor(Math.random() * DECODE_GLYPHS.length)])).join(''));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setOut(text);
      };
      raf = requestAnimationFrame(tick);
    };
    const wait = () => {
      if (document.documentElement.classList.contains('intro')) timer = setTimeout(wait, 100);
      else timer = setTimeout(run, 350);
    };
    wait();
    return () => { cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [text]);
  return (
    <span className="relative inline-block">
      <span className="sr-only">{text}</span>
      <span className="invisible" aria-hidden="true">{text}</span>
      <span className="absolute left-0 top-0 whitespace-nowrap" aria-hidden="true">{out}</span>
    </span>
  );
};

const Hero = ({ initialStats }: { initialStats?: HeroStats }) => {
  const [currentImage, setCurrentImage] = useState(0);
  const [stats, setStats] = useState({
    competitions: initialStats?.competitions ?? 0,
    internationalAwards: initialStats?.internationalAwards ?? 0,
    teamMembers: initialStats?.teamMembers ?? 0,
    nationalAwards: initialStats?.nationalAwards ?? 0,
    seasons: initialStats?.seasons ?? 0,
  });

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.history.replaceState(null, '', `#${sectionId}`);
    window.scrollTo({ top, behavior: 'smooth' });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentImage((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000);
    return () => clearTimeout(timer);
  }, [currentImage]);

  // Mouse parallax: write CSS variables straight onto the hero (no React state, no re-render per move)
  const heroRef = useRef<HTMLElement>(null);
  const pointerRaf = useRef(0);
  const onHeroPointer = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = heroRef.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(pointerRaf.current);
    pointerRaf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', String(((clientX - r.left) / r.width - 0.5) * 2));
      el.style.setProperty('--my', String(((clientY - r.top) / r.height - 0.5) * 2));
    });
  };
  const onHeroLeave = () => {
    heroRef.current?.style.setProperty('--mx', '0');
    heroRef.current?.style.setProperty('--my', '0');
  };

  useEffect(() => {
    // Skip fetch if server already provided initial stats
    if (initialStats && initialStats.competitions > 0) return;

    const fetchHeroStats = async () => {
      try {
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

        if (competitionsResult.error) {
          console.error('[Hero Stats] Competitions error:', competitionsResult.error.message);
        }
        if (internationalAwardsResult.error) {
          console.error('[Hero Stats] International awards error:', internationalAwardsResult.error.message);
        }
        if (teamPlayersResult.error) {
          console.error('[Hero Stats] Team players error:', teamPlayersResult.error.message);
        }
        if (membersResult.error) {
          console.error('[Hero Stats] Members error:', membersResult.error.message);
        }
        if (mediaTeamResult.error) {
          console.error('[Hero Stats] Media team error:', mediaTeamResult.error.message);
        }
        if (nationalAwardsResult.error) {
          console.error('[Hero Stats] National awards error:', nationalAwardsResult.error.message);
        }

        const totalMembers =
          (teamPlayersResult.count ?? 0) +
          (membersResult.count ?? 0) +
          (mediaTeamResult.count ?? 0);

        setStats({
          competitions: competitionsResult.count ?? 0,
          internationalAwards: internationalAwardsResult.count ?? 0,
          teamMembers: totalMembers,
          nationalAwards: nationalAwardsResult.count ?? 0,
          seasons: seasonsResult.count ?? 0,
        });

        console.log('[Hero Stats] Loaded counts:', {
          competitions: competitionsResult.count ?? 0,
          internationalAwards: internationalAwardsResult.count ?? 0,
          teamMembers: totalMembers,
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
    { label: 'Seasons', value: stats.seasons },
    ...(stats.internationalAwards > 0
      ? [{ label: 'International Awards', value: stats.internationalAwards }]
      : []),
    { label: 'Members', value: stats.teamMembers },
    { label: 'National Awards', value: stats.nationalAwards },
  ];

  return (
    <div>
      <section
        ref={heroRef}
        onPointerMove={onHeroPointer}
        onPointerLeave={onHeroLeave}
        className="hold relative isolate flex h-[calc(100svh-60px)] min-h-[560px] flex-col overflow-hidden border-b border-slate-700 md:h-[calc(100svh-68px)]"
      >
        {/* Carousel background: crossfade + slow push-in + mouse parallax, dimmed so text stays readable */}
        <div className="absolute inset-0 -z-10 overflow-hidden bg-slate-900" aria-hidden="true">
          <div className="parallax absolute -inset-6" style={{ ['--k' as string]: -14 } as React.CSSProperties}>
            {CAROUSEL_IMAGES.map((src, idx) => (
              <Image
                key={src}
                src={src}
                alt=""
                fill
                sizes="100vw"
                priority={idx === 0}
                className={`xfade object-cover ${idx === currentImage ? 'is-on' : ''}`}
              />
            ))}
          </div>
          <div className="absolute inset-0 bg-slate-950/70" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950 to-transparent" />
        </div>


        {/* HUD corner brackets */}
        <span className="hud-corner left-4 top-4 hidden border-l border-t md:block" aria-hidden="true" />
        <span className="hud-corner right-4 top-4 hidden border-r border-t md:block" aria-hidden="true" />
        <span className="hud-corner bottom-4 left-4 hidden border-b border-l md:block" aria-hidden="true" />
        <span className="hud-corner bottom-4 right-4 hidden border-b border-r md:block" aria-hidden="true" />

        {/* headline block fills the free space and centres itself */}
        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center px-4 pt-6 md:px-7">
          <p className="rise mb-[2.2vh] inline-flex w-fit items-center gap-2.5 border border-slate-600 bg-slate-950/50 px-3 py-1.5 font-mono text-[.72rem] uppercase tracking-[.16em] text-slate-300" style={{ ['--i' as string]: 0 } as React.CSSProperties}>
            <span className="blink h-1.5 w-1.5 bg-accent" aria-hidden="true" />
            Systems online
            <span className="text-slate-500" aria-hidden="true">/</span>
            <span className="text-accent">QCU</span>
          </p>
          <p className="kicker rise mb-[1.6vh]" style={{ ['--i' as string]: 1 } as React.CSSProperties}>Quezon City University</p>
          <h1 className="font-display text-[clamp(2.6rem,min(8vw,12vh),6.2rem)] font-bold leading-[.98] tracking-[-0.045em]">
            <span className="rise block text-slate-200" style={{ ['--i' as string]: 2 } as React.CSSProperties}>Robotics</span>
            <span className="rise block text-accent" style={{ ['--i' as string]: 3 } as React.CSSProperties}><DecodeText text="Society" /></span>
          </h1>
          <p className="rise mb-[3vh] mt-[2.4vh] line-clamp-3 max-w-[46ch] text-[1.05rem] leading-relaxed text-slate-300 sm:line-clamp-none" style={{ ['--i' as string]: 4 } as React.CSSProperties}>
            Building excellence through innovation and teamwork. QCU Robotics brings cutting-edge engineering to international robotics competitions with two competitive teams.
          </p>
          <div className="rise flex flex-wrap items-center gap-x-5 gap-y-3" style={{ ['--i' as string]: 5 } as React.CSSProperties}>
            <Link href="/member-reg" prefetch={false} className="btn btn-primary group min-h-[52px] px-7 text-[1rem]">
              Join the team
              <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <button type="button" onClick={() => scrollToSection('competitions')} className="btn btn-ghost min-h-[52px] bg-slate-950/40 px-6">
              Explore competitions
            </button>
          </div>
        </div>

        {/* bottom bar: photo timer + live stats, all inside the same frame */}
        <div className="rise mx-auto w-full max-w-[1200px] px-4 pb-5 md:px-7 md:pb-7" style={{ ['--i' as string]: 6 } as React.CSSProperties}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5" role="tablist" aria-label="Showcase photos">
              {CAROUSEL_IMAGES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={idx === currentImage}
                  aria-label={`Show photo ${idx + 1}`}
                  onClick={() => setCurrentImage(idx)}
                  className="group grid h-6 place-items-center"
                >
                  <span className={`relative block h-[3px] overflow-hidden rounded-full bg-white/30 transition-all duration-500 ${idx === currentImage ? 'w-12' : 'w-5 group-hover:bg-white/60'}`}>
                    {idx === currentImage && <span key={currentImage} className="progress-fill absolute inset-0 bg-accent" />}
                  </span>
                </button>
              ))}
              <span className="ml-2 font-mono text-xs tabular-nums text-slate-300">
                {String(currentImage + 1).padStart(2, '0')}/{String(CAROUSEL_IMAGES.length).padStart(2, '0')}
              </span>
            </div>
            <span className="hidden font-mono text-[.68rem] uppercase tracking-[.2em] text-slate-500 sm:block">Telemetry</span>
          </div>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-px overflow-hidden border border-slate-600/70 bg-slate-600/70">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-slate-950/70 px-4 py-3 md:px-5 md:py-4">
                <dd className="font-display text-[1.6rem] font-bold leading-none tracking-tight text-white md:text-[2rem]">
                  <CountUp value={stat.value} />
                </dd>
                <dt className="mt-1.5 font-mono text-[.64rem] uppercase tracking-[.14em] text-slate-400 md:text-[.68rem]">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
};

// ─── Competitions Section ─────────────────────────────────────────────────────
const CompetitionsSection = ({ initialCompetitions, initialSeasons }: { initialCompetitions?: Competition[]; initialSeasons?: Season[] }) => {
  const [competitions, setCompetitions] = useState<any[]>(initialCompetitions ?? []);
  const [seasons, setSeasons] = useState<any[]>(initialSeasons ?? []);
  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(!initialCompetitions?.length);

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

  // Newest season first (names are game titles, so alphabetical order would be wrong; ids grow with each season)
  const sortedSeasons = [...seasons].sort((a, b) => Number(b.id) - Number(a.id));

  const seasonOrderMap = new Map<number, number>(
    sortedSeasons.map((season, index) => [Number(season.id), index])
  );

  useEffect(() => {
    // Skip fetch if server already provided initial data
    if (initialCompetitions?.length && initialSeasons?.length) return;

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
    <section id="competitions" data-reveal className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">

        {/* Header: heading on the left, season filter on the right */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="kicker mb-4">Featured competitions</p>
            <h2 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] font-bold leading-[1.04] tracking-[-0.04em] text-white">
              Competitions &amp; <span className="text-accent">achievements</span>
            </h2>
            <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-400">
              QCU Robotics competes at the highest level, showcasing innovation and engineering
              excellence across multiple prestigious competitions worldwide.
            </p>
          </div>
          <Dropdown
            className="w-full md:w-64 md:shrink-0"
            label="Season"
            items={[
              { label: sortedSeasons.length === 0 ? 'No seasons found' : 'All seasons', value: 'all' },
              ...sortedSeasons.map((s) => ({ label: String(s.season_name), value: String(s.id) })),
            ]}
            value={String(selectedSeason)}
            onValueChange={(v) => setSelectedSeason(v === 'all' ? 'all' : Number(v))}
            disabled={seasons.length === 0}
          />
        </div>

        {/* Competition cards */}
        <div className="mb-4 flex items-baseline justify-between text-sm text-slate-400" aria-live="polite">
          <p>
            <span className="font-mono tabular-nums text-white">{String(sortedCompetitions.length).padStart(2, '0')}</span>{' '}
            {sortedCompetitions.length === 1 ? 'competition' : 'competitions'}
            {selectedSeason !== 'all' ? <> in <span className="text-white">{seasonNameById.get(Number(selectedSeason))}</span></> : null}
          </p>
        </div>
        <div key={String(selectedSeason)} className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sortedCompetitions.length > 0 ? (
            sortedCompetitions.map((comp, idx) => (
              <article
                key={comp.id}
                className="lift group flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"
                style={{ animation: 'rise .6s var(--ease) both', animationDelay: `${Math.min(idx, 8) * 70}ms` }}
              >
                <div className="relative aspect-[16/9] overflow-hidden border-b border-slate-700 bg-slate-800">
                  {comp.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={comp.image_url}
                      alt={comp.title}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-slate-500">
                      <Trophy className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                  <span
                    className={`absolute left-3 top-3 inline-flex items-center gap-2 border bg-slate-950/80 px-2.5 py-1 font-mono text-[.68rem] uppercase tracking-[.14em] ${
                      comp.status === 'Active'
                        ? 'border-accent/50 text-accent'
                        : comp.status === 'Upcoming'
                        ? 'border-violet-400/50 text-violet-300'
                        : 'border-slate-600 text-slate-300'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 ${comp.status === 'Active' ? 'bg-accent' : comp.status === 'Upcoming' ? 'bg-violet-400' : 'bg-slate-400'}`} aria-hidden="true" />
                    {comp.status}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="font-mono text-xs tabular-nums text-slate-500">{comp.date}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight text-white">{comp.title}</h3>
                  {comp.location && <p className="mt-2 text-sm text-slate-400">{comp.location}</p>}

                  <div className="mt-auto grid grid-cols-2 gap-3 pt-6">
                    <Link href={`/matches?id=${comp.id}`} className="btn btn-primary btn-sm group/b">
                      Matches
                      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover/b:translate-x-0.5" />
                    </Link>
                    <Link href={`/achievements?id=${comp.id}`} className="btn btn-ghost btn-sm group/b">
                      Achievements
                      <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover/b:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-600 py-14 text-center text-sm text-slate-400 md:col-span-2 lg:col-span-3">
              No competitions found for the selected season.
            </p>
          )}
        </div>

      </div>
    </section>
  );
};

// ─── About Section ────────────────────────────────────────────────────────────
const AboutSection = () => {
  const [activeTeamCount, setActiveTeamCount] = useState(0);
  const [activeMemberCount, setActiveMemberCount] = useState(0);
  const [currentAboutImage, setCurrentAboutImage] = useState(0);

  useEffect(() => {
    const fetchAboutStats = async () => {
      try {
        const [teamsResult, activeTeamPlayersResult, activeMembersResult, activeMediaTeamResult] = await Promise.all([
          supabase.from('teams').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('media_team').select('id', { count: 'exact', head: true }).eq('is_active', true),
        ]);

        if (teamsResult.error) {
          console.error('[About Stats] Teams error:', teamsResult.error.message);
        }
        if (activeTeamPlayersResult.error) {
          console.error('[About Stats] Team players error:', activeTeamPlayersResult.error.message);
        }
        if (activeMembersResult.error) {
          console.error('[About Stats] Members error:', activeMembersResult.error.message);
        }
        if (activeMediaTeamResult.error) {
          console.error('[About Stats] Media team error:', activeMediaTeamResult.error.message);
        }

        const totalActiveMembers =
          (activeTeamPlayersResult.count ?? 0) +
          (activeMembersResult.count ?? 0) +
          (activeMediaTeamResult.count ?? 0);

        setActiveTeamCount(teamsResult.count ?? 0);
        setActiveMemberCount(totalActiveMembers);

        console.log('[About Stats] Loaded counts:', {
          activeTeams: teamsResult.count ?? 0,
          activeMembers: totalActiveMembers,
        });
      } catch (err: any) {
        console.error('[About Stats] Exception:', err?.message || err);
      }
    };

    fetchAboutStats();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentAboutImage((prev) => (prev + 1) % ABOUT_CAROUSEL_IMAGES.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section id="about-us" data-reveal className="py-24 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="rounded-2xl overflow-hidden border border-slate-700/50">
            <div className="relative h-96 overflow-hidden bg-slate-900">
              <div
                className="flex h-full w-full transition-transform duration-1000 ease-in-out"
                style={{
                  width: `${ABOUT_CAROUSEL_IMAGES.length * 100}%`,
                  transform: `translateX(-${currentAboutImage * (100 / ABOUT_CAROUSEL_IMAGES.length)}%)`,
                }}
              >
                {ABOUT_CAROUSEL_IMAGES.map((src, idx) => (
                  <div
                    key={src}
                    className="relative h-full shrink-0"
                    style={{ width: `${100 / ABOUT_CAROUSEL_IMAGES.length}%` }}
                  >
                    <Image
                      src={src}
                      alt={`About QCU Robotics ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      loading="lazy"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54teleJ/9k="
                    />
                  </div>
                ))}
              </div>

              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 pointer-events-auto">
                {ABOUT_CAROUSEL_IMAGES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentAboutImage(idx)}
                    aria-label={`Go to about image ${idx + 1}`}
                    className={`transition-all duration-500 rounded-full ${
                      idx === currentAboutImage
                        ? 'w-10 h-2  '
                        : 'w-2 h-2 bg-slate-500/70 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
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
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-700/30">
                <span className="text-2xl font-bold text-red-400">{activeTeamCount}</span>
                <p className="text-slate-400 text-sm mt-2">Competitive Teams</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-700/30">
                <span className="text-2xl font-bold text-red-400">{activeMemberCount}</span>
                <p className="text-slate-400 text-sm mt-2">Active Members</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Renders `fallback` if the remote image fails to load (dead host, deleted
// object, etc.) instead of leaving a broken image icon in the card.
const RemoteImage = ({
  src,
  alt,
  className,
  fallback,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // The card is server-rendered, so a fast failure (e.g. a host that no longer
  // resolves) can fire before React hydrates and attaches `onError`. Re-check
  // the element's state after mount so those failures still get the fallback.
  useEffect(() => {
    const img = imgRef.current;
    if (src && img && img.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  if (!src || failedSrc === src) return <>{fallback}</>;
  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
};

// ─── Avatar Fallback ──────────────────────────────────────────────────────────
// Used when a person has no photo (or the photo fails to load). Initials on a
// gradient derived from the name so a roster without photos still looks varied.
const AVATAR_GRADIENTS = [
  'bg-violet-500/15',
  'bg-accent/10',
  'bg-slate-700',
  'bg-violet-500/25',
  'bg-accent/15',
  'bg-slate-800',
];

const getInitials = (name?: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
};

const getAvatarGradient = (name?: string | null): string => {
  let hash = 0;
  for (const ch of name ?? '') hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

// Small round avatar (roster cards).
const AvatarFallback = ({ name, ringClass = 'border-slate-600' }: { name?: string | null; ringClass?: string }) => (
  <div
    aria-hidden="true"
    className={`relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 bg-gradient-to-br  ${ringClass} ${getAvatarGradient(name)}`}
  >
    <span className="relative text-2xl font-bold tracking-wide text-white">{getInitials(name)}</span>
  </div>
);

// Full-bleed placeholder for tall photo cards (coaches, sponsor people).
const PortraitFallback = ({ name, label, accentText = 'text-slate-300' }: { name?: string | null; label: string; accentText?: string }) => (
  <div
    aria-hidden="true"
    className={`relative flex h-full w-full flex-col items-center justify-center gap-4 ${getAvatarGradient(name)}`}
  >
    <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10">
      <span className="text-3xl font-bold tracking-wide text-white">{getInitials(name)}</span>
    </div>
    <span className={`relative text-[11px] font-semibold uppercase tracking-[0.14em] ${accentText}`}>{label}</span>
  </div>
);

const SponsorSection = ({ initialSponsors }: { initialSponsors?: SponsorCompany[] }) => {
  const [sponsorCompanies, setSponsorCompanies] = useState<any[]>(initialSponsors ?? []);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialSponsors?.length);

  useEffect(() => {
    // Skip fetch if server already provided initial data
    if (initialSponsors?.length) return;

    const fetchSponsors = async () => {
      try {
        const cachedCompanies = getCachedData('sponsor-companies');
        const cachedSponsors = getCachedData('sponsors');

        if (cachedCompanies && cachedSponsors) {
          setSponsorCompanies(cachedCompanies);
          setSponsors(cachedSponsors);
          return;
        }

        const [companiesResult, sponsorsResult] = await Promise.all([
          supabase.from('sponsor_company').select('id, image_url, company_name').order('id', { ascending: true }),
          supabase.from('sponsors').select('id, name, image_url, company_id').order('id', { ascending: true }),
        ]);

        if (companiesResult.error) {
          console.error('[Sponsors] Company error:', companiesResult.error.message);
        }
        if (sponsorsResult.error) {
          console.error('[Sponsors] Sponsors error:', sponsorsResult.error.message);
        }

        const companyRows = companiesResult.data ?? [];
        const sponsorRows = sponsorsResult.data ?? [];

        setCachedData('sponsor-companies', companyRows);
        setCachedData('sponsors', sponsorRows);

        setSponsorCompanies(companyRows);
        setSponsors(sponsorRows);
      } catch (err: any) {
        console.error('[Sponsors] Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchSponsors();
  }, []);

  const companyById = new Map(sponsorCompanies.map((company) => [Number(company.id), company]));

  return (
    <section id="sponsors" data-reveal className="py-24 relative z-10 bg-slate-950/50 scroll-mt-28 md:scroll-mt-32 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="kicker mb-4">Sponsors</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Our Sponsors</h2>
          <p className="text-slate-400 text-lg">
            Companies and the people behind them who support QCU Robotics.
          </p>
        </div>

        <div className="space-y-16">
          {/* Companies */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h3 className="text-2xl font-bold text-white">Companies</h3>
                <p className="text-slate-400 text-sm mt-1">Featured sponsor companies and their branding.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-wrap justify-center gap-6">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-56 w-full max-w-sm basis-full sm:basis-[calc(50%-0.75rem)] lg:basis-[calc(33.333%-1rem)] rounded-2xl border border-slate-700/50 bg-slate-900/40 animate-pulse" />
                ))}
              </div>
            ) : sponsorCompanies.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-6">
                {sponsorCompanies.map((company) => (
                  <div key={company.id} className="group w-full max-w-sm basis-full sm:basis-[calc(50%-0.75rem)] lg:basis-[calc(33.333%-1rem)] overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 transition-all duration-300 hover:border-amber-500/40 hover:bg-slate-800/50">
                    <div className="aspect-[4/3] bg-slate-950/60 overflow-hidden flex items-center justify-center">
                      <RemoteImage
                        src={company.image_url}
                        alt={company.company_name || 'Sponsor company'}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        fallback={
                          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10">
                              <Shield className="h-8 w-8 text-amber-300/80" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-300/70">Sponsor</p>
                              <p className="mt-2 text-lg font-bold text-white">{company.company_name || 'Sponsor Company'}</p>
                            </div>
                          </div>
                        }
                      />
                    </div>
                    <div className="p-5 text-center">
                      <h4 className="text-lg font-bold text-white">{company.company_name || 'Sponsor Company'}</h4>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-800/50 bg-slate-900/30 px-6 py-10 text-center text-slate-500">
                No sponsor companies found yet.
              </p>
            )}
          </div>

          {/* People */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div>
                <h3 className="text-2xl font-bold text-white">People</h3>
                <p className="text-slate-400 text-sm mt-1">Sponsor representatives with their company name.</p>
              </div>
            </div>

            {sponsors.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-8">
                {sponsors.map((person) => {
                  const company = companyById.get(Number(person.company_id));
                  const companyName = company?.company_name || 'Sponsor Company';

                  return (
                    <div
                      key={person.id}
                      className="w-full max-w-sm basis-full sm:basis-[calc(50%-1rem)] lg:basis-[calc(25%-1.5rem)] group relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/50 transition-all duration-300 hover:border-amber-500/50"
                    >
                      <div className="relative h-64 overflow-hidden bg-slate-950">
                        <RemoteImage
                          src={person.image_url}
                          alt={person.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          fallback={<PortraitFallback name={person.name} label={companyName} accentText="text-amber-200/90" />}
                        />
                      </div>
                      <div className="p-6">
                        <h4 className="text-lg font-bold text-white">{person.name}</h4>
                        <p className="text-sm text-amber-300 font-medium">{companyName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-slate-800/50 bg-slate-900/30 px-6 py-10 text-center text-slate-500">
                No sponsor people found yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Team Members Helpers ────────────────────────────────────────────────────
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
    return seasonData.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof seasonData === 'object') {
    if (Array.isArray(seasonData.seasons)) {
      return seasonData.seasons.map((item: any) => String(item).trim()).filter(Boolean);
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
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return [seasonData.trim()].filter(Boolean);
    }
  }

  return [];
};

const formatTeamLabel = (team: any): string => {
  if (!team) return 'Unassigned Team';

  const teamCode = String(team.team_code ?? '').trim();
  const teamName = String(team.team_name ?? '').trim();

  if (teamCode && teamName) return `${teamCode} - ${teamName}`;
  if (teamCode) return teamCode;
  if (teamName) return teamName;

  const teamNumber = Number(team.team_number);
  if (Number.isFinite(teamNumber)) return `Team ${teamNumber}`;

  return 'Team';
};

const formatSeasonLabel = (season: any): string => {
  const seasonName = String(season?.season_name ?? '').trim();
  if (seasonName) return seasonName;

  const seasonId = Number(season?.id ?? season?.season_id);
  if (Number.isFinite(seasonId)) return `Season ${seasonId}`;

  return 'Season';
};

const formatMemberRoles = (memberRoles: any, seasonOrderMap?: Map<number, number>, filterSeasonId?: number): string[] => {
  if (!Array.isArray(memberRoles)) return [];

  const roles = filterSeasonId !== undefined
    ? memberRoles.filter((mr: any) => Number(mr.season_id) === Number(filterSeasonId))
    : memberRoles;

  const sorted = [...roles].sort((a, b) => {
    const aSeasonId = Number(a.season_id);
    const bSeasonId = Number(b.season_id);

    if (seasonOrderMap && seasonOrderMap.size > 0) {
      const aOrder = seasonOrderMap.get(aSeasonId) ?? 999;
      const bOrder = seasonOrderMap.get(bSeasonId) ?? 999;
      return aOrder - bOrder;
    }

    return bSeasonId - aSeasonId;
  });

  return sorted
    .map((memberRole) => {
      if (!memberRole) return '';
      const roleName = memberRole.roles?.role_name ?? memberRole.role_name ?? memberRole.name ?? '';
      return String(roleName).trim();
    })
    .filter(Boolean);
};

// ─── People: shared building blocks ──────────────────────────────────────────
// Every roster below (team players, media, members, coaches) uses the same header, card and empty state.
const PeopleSection = ({
  id,
  kicker,
  title,
  accent,
  description,
  action,
  tinted = true,
  defaultOpen = true,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  accent: string;
  description: string;
  action?: React.ReactNode;
  tinted?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;

  return (
    <section id={id} data-reveal className={`relative z-10 scroll-mt-28 py-16 md:scroll-mt-32 md:py-20 ${tinted ? 'bg-slate-950/50' : ''}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`flex flex-col gap-6 md:flex-row md:items-end md:justify-between ${open ? 'mb-10' : ''}`}>
          <div className="max-w-2xl">
            <p className="kicker mb-4">{kicker}</p>
            <h2 className="font-display text-[clamp(2.2rem,5vw,3.4rem)] font-bold leading-[1.04] tracking-[-0.04em] text-white">
              {title} <span className="text-accent">{accent}</span>
            </h2>
            {open && <p className="mt-4 text-[1.05rem] leading-relaxed text-slate-400">{description}</p>}
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end md:w-auto">
            {open && action}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="group inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white outline-none transition-colors duration-150 hover:border-slate-500 focus-visible:border-accent"
            >
              {open ? 'Hide' : 'Show'}
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ease-out-quint group-hover:text-white ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          id={panelId}
          inert={!open}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out-quint motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="min-h-0 overflow-hidden">{children}</div>
        </div>
      </div>
    </section>
  );
};

const plural = (noun: string) => (noun === 'person' ? 'people' : noun.endsWith('ch') ? `${noun}es` : `${noun}s`);

const CountLine = ({ count, noun, suffix }: { count: number; noun: string; suffix?: React.ReactNode }) => (
  <p className="text-sm text-slate-400" aria-live="polite">
    <span className="font-mono tabular-nums text-white">{String(count).padStart(2, '0')}</span>{' '}
    {count === 1 ? noun : plural(noun)}
    {suffix}
  </p>
);

const SearchBox = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
  <label className="relative block w-full sm:w-64">
    <span className="sr-only">{label}</span>
    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search by name"
      className="h-11 w-full rounded-xl border border-slate-600 bg-slate-900 pl-11 pr-4 text-sm font-medium text-white outline-none transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent"
    />
  </label>
);

const PeopleEmpty = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-2xl border border-dashed border-slate-600 py-14 text-center text-sm text-slate-400">{children}</p>
);

const personTone = {
  accent: 'text-accent',
  violet: 'text-violet-300',
} as const;

// Portrait card: team players and coaches.
const PersonCard = ({
  name,
  imageUrl,
  role,
  tone = 'accent',
  seasons = [],
}: {
  name: string;
  imageUrl?: string | null;
  role: string;
  tone?: keyof typeof personTone;
  seasons?: string[];
}) => (
  <article className="lift group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
    <div className="relative aspect-[4/5] overflow-hidden border-b border-slate-700 bg-slate-800">
      <RemoteImage
        src={imageUrl}
        alt={name}
        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        fallback={<PortraitFallback name={name} label="" />}
      />
    </div>
    <div className="flex flex-1 flex-col p-4">
      <h3 className="font-display text-base font-semibold leading-snug tracking-tight text-white">{name}</h3>
      <p className={`mt-1 font-mono text-[.7rem] uppercase leading-relaxed tracking-[.12em] ${personTone[tone]}`}>{role}</p>
      {seasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {seasons.map((season) => (
            <li key={season} className="rounded-md border border-slate-600 px-2 py-0.5 text-[.7rem] text-slate-300">
              {season}
            </li>
          ))}
        </ul>
      )}
    </div>
  </article>
);

const PeopleSkeleton = ({ variant, count }: { variant: 'card' | 'row'; count: number }) =>
  variant === 'card' ? (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
          <div className="aspect-[4/5] bg-slate-800" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 rounded bg-slate-800" />
            <div className="h-3 w-1/2 rounded bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
          <div className="h-14 w-14 rounded-full bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-800" />
            <div className="h-3 w-1/3 rounded bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );

// ─── Team players ────────────────────────────────────────────────────────────
const TeamMembersSection = ({ initialTeamMembers, initialSeasons }: { initialTeamMembers?: TeamMember[]; initialSeasons?: Season[] }) => {
  const [seasons, setSeasons] = useState<any[]>(initialSeasons ?? []);
  const [members, setMembers] = useState<any[]>(initialTeamMembers ?? []);
  const [loading, setLoading] = useState(!initialTeamMembers?.length);
  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Skip fetch if server already provided initial data
    if (initialTeamMembers?.length) return;

    const fetchTeamMembers = async () => {
      try {
        let seasonRows = getCachedData('team-members-seasons');
        if (!seasonRows || seasonRows.length === 0) {
          const { data, error } = await supabase
            .from('seasons')
            .select('id, season_name')
            .order('id', { ascending: false });

          if (error) console.error('[TeamMembers] Seasons error:', error.message);
          else {
            seasonRows = data ?? [];
            if (seasonRows.length > 0) setCachedData('team-members-seasons', seasonRows);
          }
        }
        setSeasons(seasonRows ?? []);

        let memberRows = getCachedData('team-members-members');
        if (!memberRows || memberRows.length === 0) {
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

          if (error) console.error('[TeamMembers] Members error:', error.message);
          else {
            memberRows = data ?? [];
            if (memberRows.length > 0) setCachedData('team-members-members', memberRows);
          }
        }

        setMembers(memberRows ?? []);
      } catch (err: any) {
        console.error('[TeamMembers] Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMembers();
  }, []);

  // Newest season first (names are game titles, so ids give the real order).
  const seasonOptions = [...seasons].sort((left, right) => Number(right.id) - Number(left.id));

  const groupedTeams = (() => {
    const groups = new Map<string, {
      seasonId: number;
      seasonName: string;
      teamId: number;
      teamNumber: number;
      teamLabel: string;
      members: any[];
    }>();

    const seasonOrderMap = new Map(seasonOptions.map((season, index) => [Number(season.id), index]));

    members.forEach((member) => {
      const memberships = Array.isArray(member.member_team_seasons) ? member.member_team_seasons : [];
      const relevantMemberships = memberships.filter((membership: any) =>
        selectedSeason === 'all' ? true : Number(membership.season_id) === Number(selectedSeason),
      );

      relevantMemberships.forEach((membership: any) => {
        const teamData = membership.teams ?? {};
        const seasonData = membership.seasons ?? {};
        const teamId = Number(membership.team_id ?? teamData.id);
        const seasonId = Number(membership.season_id ?? seasonData.id);
        const key = `${seasonId}-${teamId}`;

        const roleNames = formatMemberRoles(member.member_roles, seasonOrderMap, seasonId);
        const displayMember = {
          ...member,
          image_url: member.profile_image_url ?? member.image_url ?? null,
          position: roleNames.length > 0 ? roleNames.join(' • ') : (member.position ?? 'Team Member'),
        };

        if (!groups.has(key)) {
          groups.set(key, {
            seasonId,
            seasonName: formatSeasonLabel(seasonData),
            teamId,
            teamNumber: Number(teamData.team_number ?? 0),
            teamLabel: formatTeamLabel(teamData),
            members: [],
          });
        }
        groups.get(key)?.members.push(displayMember);
      });
    });

    const needle = query.trim().toLowerCase();
    const all = Array.from(groups.values()).map((g) =>
      needle ? { ...g, members: g.members.filter((m) => String(m.name ?? '').toLowerCase().includes(needle)) } : g,
    ).filter((g) => g.members.length > 0);

    return all.sort((left, right) => {
      if (left.seasonId !== right.seasonId) {
        const l = seasonOrderMap.get(left.seasonId) ?? 999;
        const r = seasonOrderMap.get(right.seasonId) ?? 999;
        return l !== r ? l - r : right.seasonId - left.seasonId;
      }
      if (left.teamNumber !== right.teamNumber) return left.teamNumber - right.teamNumber;
      return left.teamLabel.localeCompare(right.teamLabel, undefined, { numeric: true, sensitivity: 'base' });
    });
  })();

  // A player who appears in several seasons/teams is still one player.
  const playerCount = new Set(groupedTeams.flatMap((g) => g.members.map((m) => m.id))).size;
  const groupKeys = groupedTeams.map((g) => `${g.seasonId}-${g.teamId}`);
  const allCollapsed = groupKeys.length > 0 && groupKeys.every((k) => collapsed.has(k));
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const selectedSeasonName = selectedSeason === 'all' ? null : seasonOptions.find((s) => Number(s.id) === Number(selectedSeason))?.season_name;

  return (
    <PeopleSection
      id="team-members"
      kicker="Team players"
      title="Meet the"
      accent="players"
      description="The core robotics teams, organised by team number, with each player's role for the season."
      action={
        <Dropdown
          className="w-full md:w-64 md:shrink-0"
          label="Season"
          items={[
            { label: seasonOptions.length === 0 ? 'No seasons found' : 'All seasons', value: 'all' },
            ...seasonOptions.map((s) => ({ label: String(s.season_name), value: String(s.id) })),
          ]}
          value={String(selectedSeason)}
          onValueChange={(v) => setSelectedSeason(v === 'all' ? 'all' : Number(v))}
          disabled={seasonOptions.length === 0}
        />
      }
    >
      {loading ? (
        <PeopleSkeleton variant="card" count={10} />
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <CountLine
              count={playerCount}
              noun="player"
              suffix={<>
                {selectedSeasonName ? <> in <span className="text-white">{selectedSeasonName}</span></> : null}
                {query.trim() ? <> matching <span className="text-white">&ldquo;{query.trim()}&rdquo;</span></> : null}
              </>}
            />
            <div className="flex w-full items-center gap-4 sm:w-auto">
              <SearchBox value={query} onChange={setQuery} label="Search players by name" />
              {groupKeys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groupKeys))}
                  className="shrink-0 cursor-pointer text-sm font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {allCollapsed ? 'Show all teams' : 'Hide all teams'}
                </button>
              )}
            </div>
          </div>
          {groupedTeams.length > 0 ? (
          <div key={String(selectedSeason)} className="space-y-14">
            {groupedTeams.map((group) => {
              const key = `${group.seasonId}-${group.teamId}`;
              const isOpen = !collapsed.has(key);
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(key)}
                    aria-expanded={isOpen}
                    aria-controls={`team-${key}`}
                    className={`group flex w-full cursor-pointer items-baseline gap-4 border-b border-slate-700 pb-3 text-left outline-none focus-visible:border-accent ${isOpen ? 'mb-5' : ''}`}
                  >
                    <h3 className="font-display text-xl font-semibold tracking-tight text-white">{group.teamLabel}</h3>
                    <span className="font-mono text-xs uppercase tracking-[.14em] text-slate-400">{group.seasonName}</span>
                    <span className="ml-auto font-mono text-xs tabular-nums text-slate-500">{String(group.members.length).padStart(2, '0')}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 self-center text-slate-400 transition-transform duration-300 ease-out-quint group-hover:text-white ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>
                  <div
                    id={`team-${key}`}
                    inert={!isOpen}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out-quint motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {group.members.map((member) => (
                          <PersonCard key={`${key}-${member.id}`} name={member.name} imageUrl={member.image_url} role={member.position} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          ) : (
            <PeopleEmpty>{query.trim() ? 'No players match that name.' : 'No team players found for the selected season.'}</PeopleEmpty>
          )}
        </>
      )}
    </PeopleSection>
  );
};

const ROSTER_PREVIEW = 10;

// Shows the first ten people (or `preview`); "See all" reveals everyone plus a name search. Used by media and members.
function ExpandableRoster<T extends { id: number | string; name?: string | null }>({
  items,
  noun,
  render,
  preview = ROSTER_PREVIEW,
}: {
  items: T[];
  noun: string;
  preview?: number;
  render: (visible: T[]) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = needle ? items.filter((i) => String(i.name ?? '').toLowerCase().includes(needle)) : items;
  const visible = expanded || needle ? matches : items.slice(0, preview);
  const canExpand = items.length > preview && !needle;

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <CountLine
          count={needle ? matches.length : items.length}
          noun={noun}
          suffix={needle ? <> matching <span className="text-white">&ldquo;{query.trim()}&rdquo;</span></> : null}
        />
        <SearchBox value={query} onChange={setQuery} label={`Search ${plural(noun)} by name`} />
      </div>

      {visible.length > 0 ? render(visible) : <PeopleEmpty>No {plural(noun)} match that name.</PeopleEmpty>}

      {canExpand && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="btn btn-ghost"
          >
            {expanded ? 'Show less' : `See all ${items.length} ${plural(noun)}`}
          </button>
        </div>
      )}
    </>
  );
}

// ─── Media team ──────────────────────────────────────────────────────────────
const MediaTeamSection = ({ initialMediaTeam }: { initialMediaTeam?: MediaMember[] }) => {
  const [mediaTeam, setMediaTeam] = useState<any[]>(initialMediaTeam ?? []);
  const [loading, setLoading] = useState(!initialMediaTeam?.length);

  useEffect(() => {
    // Skip fetch if server already provided initial data
    if (initialMediaTeam?.length) return;

    const fetchMediaTeam = async () => {
      try {
        let mediaTeamData = getCachedData('homepage-media-team');
        if (!mediaTeamData || mediaTeamData.length === 0) {
          const { data, error } = await supabase.from('media_team').select('id, name, position, image_url').order('id');
          if (error) console.error('[MediaTeam] Error:', error.message);
          else {
            mediaTeamData = data ?? [];
            if (mediaTeamData.length > 0) setCachedData('homepage-media-team', mediaTeamData);
          }
        }
        setMediaTeam(mediaTeamData ?? []);
      } catch (err: any) {
        console.error('[MediaTeam] Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchMediaTeam();
  }, []);

  return (
    <PeopleSection
      id="media-team"
      kicker="Media team"
      title="Behind the"
      accent="camera"
      description="The people behind the photos, videos and coverage of every match."
    >
      {loading ? (
        <PeopleSkeleton variant="card" count={5} />
      ) : mediaTeam.length > 0 ? (
        <ExpandableRoster
          items={mediaTeam}
          noun="person"
          render={(list) => (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {list.map((person) => (
                <PersonCard key={person.id} name={person.name} imageUrl={person.image_url} role={person.position || 'Media team'} tone="violet" />
              ))}
            </div>
          )}
        />
      ) : (
        <PeopleEmpty>No media team members yet.</PeopleEmpty>
      )}
    </PeopleSection>
  );
};

// ─── Members ─────────────────────────────────────────────────────────────────
const MembersSection = ({ initialMembers }: { initialMembers?: Member[] }) => {
  const [members, setMembers] = useState<any[]>(initialMembers ?? []);
  const [loading, setLoading] = useState(!initialMembers?.length);
  useEffect(() => {
    // Skip fetch if server already provided initial data
    if (initialMembers?.length) return;

    const fetchMembers = async () => {
      try {
        let membersData = getCachedData('homepage-members');
        if (!membersData || membersData.length === 0) {
          const { data, error } = await supabase.from('members').select('id, name, image_url').order('id');
          if (error) console.error('[Members] Error:', error.message);
          else {
            membersData = data ?? [];
            if (membersData.length > 0) setCachedData('homepage-members', membersData);
          }
        }
        setMembers(membersData ?? []);
      } catch (err: any) {
        console.error('[Members] Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  return (
    <PeopleSection
      id="members"
      kicker="Our members"
      title="The"
      accent="members"
      description="The students building and competing with the team."
    >
      {loading ? (
        <PeopleSkeleton variant="card" count={5} />
      ) : members.length === 0 ? (
        <PeopleEmpty>No members yet.</PeopleEmpty>
      ) : (
        <ExpandableRoster
          items={members}
          noun="member"
          render={(list) => (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {list.map((member) => (
                <PersonCard key={member.id} name={member.name} imageUrl={member.image_url} role="Member" />
              ))}
            </div>
          )}
        />
      )}
    </PeopleSection>
  );
};

// ─── Coaches ─────────────────────────────────────────────────────────────────
const CoachesSection = ({ initialCoaches }: { initialCoaches?: Coach[] }) => {
  const [coaches, setCoaches] = useState<any[]>(initialCoaches ?? []);
  const [loading, setLoading] = useState(!initialCoaches?.length);

  useEffect(() => {
    // Skip fetch if server already provided initial data
    if (initialCoaches?.length) return;

    const fetchCoaches = async () => {
      try {
        const cached = getCachedData('coaches');
        if (cached) { setCoaches(cached); setLoading(false); return; }

        const { data, error } = await supabase.from('Coaches').select('*').order('id');
        if (error) {
          console.error('[Coaches] Error:', error.message);
        } else if (data) {
          setCachedData('coaches', data);
          setCoaches(data);
        }
      } catch (err: any) {
        console.error('[Coaches] Exception:', err?.message || err);
      } finally {
        setLoading(false);
      }
    };
    fetchCoaches();
  }, []);

  return (
    <PeopleSection
      id="coaches"
      kicker="Leadership"
      title="Meet our"
      accent="coaches"
      description="Mentors guiding our teams to victory and growing the next generation of robotics students."
    >
      {loading ? (
        <PeopleSkeleton variant="card" count={4} />
      ) : coaches.length === 0 ? (
        <PeopleEmpty>No coaches added yet.</PeopleEmpty>
      ) : (
        <ExpandableRoster
          items={coaches}
          noun="coach"
          render={(list) => (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((coach) => (
                <PersonCard key={coach.id} name={coach.name} imageUrl={coach.image_url} role="Team coach" />
              ))}
            </div>
          )}
        />
      )}
    </PeopleSection>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const Footer = () => {
  const contactEmail = 'roboticsqcu@gmail.com';
  const contactSubject = 'Message for QCU Robotics Team';
  const contactBody = 'Hello QCU Robotics Team, I would like to inquire about...';
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contactEmail)}&su=${encodeURIComponent(contactSubject)}&body=${encodeURIComponent(contactBody)}`;
  const [socials, setSocials] = useState<Array<{ platform: string; url: string | null }>>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchSocials = async () => {
      try {
        const cachedSocials = getCachedData('footer-socials');
        if (cachedSocials) {
          if (isMounted) setSocials(cachedSocials);
          return;
        }

        const { data, error } = await supabase
          .from('socials')
          .select('platform, url')
          .order('id', { ascending: true });

        if (error) {
          console.error('[Footer] Socials error:', error.message);
          return;
        }

        const socialRows = data ?? [];
        setCachedData('footer-socials', socialRows);

        if (isMounted) {
          setSocials(socialRows);
        }
      } catch (error) {
        console.error('[Footer] Socials exception:', error);
      }
    };

    fetchSocials();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950/80 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="mb-6 inline-flex items-center gap-3" aria-label="QCU Robotics home">
              <Image src="/logo-96.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
              <span className="font-display text-lg font-bold tracking-tight">QCU Robotics</span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Competing at the highest level. QCU Robotics Team brings innovation, teamwork, and technical excellence to every event.
            </p>
            <div className="flex items-center gap-4">
              {socials.length > 0 ? (
                socials.map((social) => {
                  const Icon = getSocialIcon(social.platform);
                  const href = getSafeExternalUrl(social.url) || '#';

                  return (
                    <a
                      key={`${social.platform}-${href}`}
                      href={href}
                      target={href !== '#' ? '_blank' : undefined}
                      rel={href !== '#' ? 'noreferrer' : undefined}
                      aria-label={social.platform}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })
              ) : (
                <p className="text-slate-500 text-sm">No social links available.</p>
              )}
            </div>
          </div>

          {/* Contact CTA */}
          <div className="rounded-2xl border border-slate-700/40 bg-slate-900 p-8">
            <p className="kicker mb-3">Get in touch</p>
            <h4 className="text-2xl font-bold text-white mb-4">Message the QCU Robotics Team</h4>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-md">
              Have questions, want to collaborate, need event information, or just want to send a general message? Reach out and the QCU Robotics Team will get back to you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={gmailComposeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hi"
              >
                Send a Message
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <span className="inline-flex items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/60 px-5 py-3 text-sm text-slate-300">
                {contactEmail}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">© 2026 QCU Robotics. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

// ─── Page Root ────────────────────────────────────────────────────────────────
export default function App({
  initialHeroStats,
  initialSeasons,
  initialCompetitions,
  initialTeamMembers,
  initialMediaTeam,
  initialMembers,
  initialCoaches,
  initialSponsors,
}: HomeClientProps) {
  useEffect(() => {
    if (window.location.hash !== '#competitions') return;

    const scrollToCompetitions = () => {
      const target = document.getElementById('competitions');
      if (!target) return false;
      const top = target.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: 'smooth' });
      return true;
    };

    const observer = new MutationObserver(() => {
      if (scrollToCompetitions()) observer.disconnect();
    });

    const timeout = setTimeout(() => observer.disconnect(), 5000);

    const onHashChange = () => scrollToCompetitions();
    window.addEventListener('hashchange', onHashChange);

    if (!scrollToCompetitions()) {
      observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return (
    <div className="overflow-x-hidden">
      <main>
        <Hero initialStats={initialHeroStats} />
        <CompetitionsSection initialCompetitions={initialCompetitions} initialSeasons={initialSeasons} />
        <AboutSection />
        <TeamMembersSection initialTeamMembers={initialTeamMembers} initialSeasons={initialSeasons} />
        <MediaTeamSection initialMediaTeam={initialMediaTeam} />
        <MembersSection initialMembers={initialMembers} />
        <CoachesSection initialCoaches={initialCoaches} />
        <SponsorSection initialSponsors={initialSponsors} />
      </main>
      <Footer />
    </div>
  );
}