export const LoadingSpinner = () => (
  <div className="flex items-center justify-center">
    <div className="relative w-12 h-12">
      {/* Outer rotating ring */}
      <div className="absolute inset-0 rounded-full border-3 border-slate-700 border-t-red-500 animate-spin" />
      
      {/* Inner pulsing dot */}
      <div className="absolute inset-3 rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/30 animate-pulse" />
      
      {/* Center dot */}
      <div className="absolute inset-4 rounded-full bg-red-500/50" />
    </div>
  </div>
);

export const SkeletonCompetitionCard = () => (
  <div className="rounded-2xl overflow-hidden bg-slate-800/50 border border-slate-700/50 p-8 animate-pulse">
    <div className="mb-6 h-40 bg-slate-700/50 rounded-lg" />
    <div className="flex gap-2 mb-4">
      <div className="h-6 w-16 bg-slate-700/50 rounded-full" />
      <div className="h-6 w-20 bg-slate-700/50 rounded-full" />
    </div>
    <div className="h-6 w-3/4 bg-slate-700/50 rounded mb-2" />
    <div className="h-4 w-1/2 bg-slate-700/50 rounded mb-6" />
    <div className="h-4 w-32 bg-slate-700/50 rounded mt-auto" />
  </div>
);

export const SkeletonTeamMemberCard = () => (
  <div className="rounded-xl overflow-hidden bg-slate-800/50 border border-slate-700/50 p-4 animate-pulse">
    <div className="h-32 w-32 bg-slate-700/50 rounded-lg mx-auto mb-4" />
    <div className="h-4 w-2/3 bg-slate-700/50 rounded mb-2 mx-auto" />
    <div className="h-3 w-1/2 bg-slate-700/50 rounded mx-auto" />
  </div>
);

export const SkeletonMatchCard = () => (
  <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-6 animate-pulse">
    <div className="h-5 w-2/3 bg-slate-700/50 rounded mb-4" />
    <div className="space-y-3">
      <div className="h-4 w-full bg-slate-700/50 rounded" />
      <div className="h-4 w-4/5 bg-slate-700/50 rounded" />
      <div className="h-6 w-1/3 bg-slate-700/50 rounded-full mt-4" />
    </div>
  </div>
);

export const SkeletonCoachCard = () => (
  <div className="rounded-2xl overflow-hidden bg-slate-800/50 border border-slate-700/50 animate-pulse">
    <div className="h-64 bg-slate-700/50" />
    <div className="p-6">
      <div className="h-5 w-2/3 bg-slate-700/50 rounded mb-2" />
      <div className="h-4 w-1/2 bg-slate-700/50 rounded" />
    </div>
  </div>
);
