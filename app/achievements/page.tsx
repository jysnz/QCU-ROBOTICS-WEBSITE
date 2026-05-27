"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trophy, Star, Zap, Award } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Mock achievements data
const mockAchievements = {
  1: [
    {
      id: 1,
      title: "Championship Winners",
      description: "Won the regional championship competition",
      icon: "trophy",
      date: "2024-05-15",
      team: "QCU1",
      points: 100
    },
    {
      id: 2,
      title: "Perfect Autonomous",
      description: "Achieved perfect autonomous scoring in all matches",
      icon: "zap",
      date: "2024-05-10",
      team: "QCU1",
      points: 50
    },
    {
      id: 3,
      title: "Most Improved",
      description: "Showed the most improvement throughout the season",
      icon: "star",
      date: "2024-04-28",
      team: "QCU1",
      points: 40
    }
  ],
  2: [
    {
      id: 4,
      title: "Finalist Achievement",
      description: "Reached the finals in this competition",
      icon: "award",
      date: "2024-05-12",
      team: "QCU2",
      points: 75
    },
    {
      id: 5,
      title: "Best Robot Design",
      description: "Won best robot design award",
      icon: "star",
      date: "2024-05-08",
      team: "QCU2",
      points: 60
    },
    {
      id: 6,
      title: "Teamwork Medal",
      description: "Outstanding teamwork and collaboration",
      icon: "zap",
      date: "2024-04-30",
      team: "QCU2",
      points: 35
    }
  ]
};

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'trophy':
      return <Trophy className="w-6 h-6" />;
    case 'star':
      return <Star className="w-6 h-6" />;
    case 'zap':
      return <Zap className="w-6 h-6" />;
    case 'award':
      return <Award className="w-6 h-6" />;
    default:
      return <Trophy className="w-6 h-6" />;
  }
};

export default function AchievementsPage() {
  const searchParams = useSearchParams();
  const competitionIdParam = searchParams?.get('id');
  
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | number | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate competition loading
    const mockCompetitions = [
      { id: 1, title: 'FIRST Robotics Regional' },
      { id: 2, title: 'VEX Robotics Championship' },
      { id: 3, title: 'Tech Challenge Invitational' }
    ];
    
    setCompetitions(mockCompetitions);
    
    // Set selected competition from URL or default to first
    const selectedId = competitionIdParam ? parseInt(competitionIdParam, 10) : mockCompetitions[0].id;
    setSelectedComp(selectedId);
    
    // Load achievements for selected competition
    const achievementsForComp = (mockAchievements as any)[selectedId] || [];
    setAchievements(achievementsForComp);
    setLoading(false);
  }, [competitionIdParam]);

  // Update achievements when selected competition changes
  useEffect(() => {
    if (selectedComp) {
      const achievementsForComp = (mockAchievements as any)[selectedComp] || [];
      setAchievements(achievementsForComp);
    }
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
              {achievements.map((achievement, idx) => (
                <div
                  key={achievement.id}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-md border border-slate-700/50 p-8 transition-all duration-300 hover:border-amber-500/30 hover:shadow-[0_0_20px_rgba(217,119,6,0.2)] animate-fadeIn"
                >
                  {/* Background gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Content */}
                  <div className="relative z-10">
                    {/* Icon */}
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 mb-4 group-hover:scale-110 transition-transform duration-300">
                      {getIconComponent(achievement.icon)}
                    </div>

                    {/* Title and Description */}
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-100 transition-colors">
                      {achievement.title}
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                      {achievement.description}
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                      <div className="flex gap-2">
                        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
                          {achievement.team}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-semibold text-yellow-400">{achievement.points}pts</span>
                      </div>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-slate-500 mt-3">
                      {new Date(achievement.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>

                  {/* Border glow effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl bg-gradient-to-br from-amber-500/20 via-transparent to-orange-500/20" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
