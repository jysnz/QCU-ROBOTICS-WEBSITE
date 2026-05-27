import { Suspense } from 'react';
import MatchesClient from './Matches'; // adjust import name to match your file

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <MatchesClient />
    </Suspense>
  );
}