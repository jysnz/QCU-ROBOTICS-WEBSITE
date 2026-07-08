import { Suspense } from 'react';
import HomeClient from './HomeClient';
import { PageSkeleton } from './components/PageSkeleton';
import {
  getHeroStats,
  getSeasons,
  getCompetitions,
  getTeamMembers,
  getMediaTeam,
  getMembers,
  getCoaches,
  getSponsors,
} from './lib/data';

export default async function Page() {
  // Prefetch all data on the server using React cache
  // Eliminates client-side waterfall fetches
  const [
    heroStats,
    seasons,
    competitions,
    teamMembers,
    mediaTeam,
    members,
    coaches,
    sponsors,
  ] = await Promise.all([
    getHeroStats(),
    getSeasons(),
    getCompetitions(),
    getTeamMembers(),
    getMediaTeam(),
    getMembers(),
    getCoaches(),
    getSponsors(),
  ]);

  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeClient
        initialHeroStats={heroStats}
        initialSeasons={seasons}
        initialCompetitions={competitions}
        initialTeamMembers={teamMembers}
        initialMediaTeam={mediaTeam}
        initialMembers={members}
        initialCoaches={coaches}
        initialSponsors={sponsors}
      />
    </Suspense>
  );
}
