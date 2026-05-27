import { Suspense } from 'react';
import AchievementsClient from './Achievements';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <AchievementsClient />
    </Suspense>
  );
}