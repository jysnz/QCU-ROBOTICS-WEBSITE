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
  getActiveCounts,
  getSponsorPeople,
  getSocials,
  getDescriptions,
} from './lib/data';

// The page is rebuilt in the background at most once an hour on its own, and immediately when an admin changes
// something (see /api/revalidate). Without this it would stay exactly as it was at the last deploy.
export const revalidate = 3600;

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
    activeCounts,
    sponsorPeople,
    socials,
    descriptions,
  ] = await Promise.all([
    getHeroStats(),
    getSeasons(),
    getCompetitions(),
    getTeamMembers(),
    getMediaTeam(),
    getMembers(),
    getCoaches(),
    getSponsors(),
    getActiveCounts(),
    getSponsorPeople(),
    getSocials(),
    getDescriptions(),
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
        initialActiveCounts={activeCounts}
        initialSponsorPeople={sponsorPeople}
        initialSocials={socials}
        initialDescriptions={descriptions}
      />
    </Suspense>
  );
}
