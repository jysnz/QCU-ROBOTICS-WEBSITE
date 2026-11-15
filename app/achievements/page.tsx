import { Suspense } from 'react';
import AchievementsClient from './Achievements';
import { getCompetitions, getSeasons } from '../lib/data';

// Competitions and seasons come from the shared server cache (refreshed instantly when an admin edits them, see /api/revalidate).
export const revalidate = 3600;

export default async function Page() {
  const [competitions, seasons] = await Promise.all([getCompetitions(), getSeasons()]);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <AchievementsClient initialCompetitions={competitions} initialSeasons={seasons} />
    </Suspense>
  );
}
