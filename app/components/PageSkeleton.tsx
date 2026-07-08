'use client';

/**
 * Full page skeleton shown while the main client bundle loads/streams.
 * Uses CSS animations only — no JavaScript required.
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 overflow-x-hidden">
      {/* Navbar skeleton */}
      <nav className="fixed w-full z-50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between px-6 py-3 rounded-xl bg-slate-950/40 border border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-slate-800 animate-pulse" />
              <div className="h-5 w-28 bg-slate-800 rounded animate-pulse" />
            </div>
            <div className="hidden lg:flex items-center gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 w-20 bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
            <div className="h-10 w-24 bg-red-900/30 rounded-lg animate-pulse" />
          </div>
        </div>
      </nav>

      {/* Hero skeleton */}
      <section className="relative min-h-screen pt-32 pb-12 sm:pt-40 sm:pb-16">
        <div className="absolute inset-0 bg-slate-900 animate-pulse" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="h-8 w-48 bg-slate-800/50 rounded-full mb-6 animate-pulse" />
            {/* Title */}
            <div className="space-y-3 mb-6">
              <div className="h-12 w-3/4 bg-slate-800/50 rounded animate-pulse" />
              <div className="h-12 w-1/2 bg-slate-800/50 rounded animate-pulse" />
            </div>
            {/* Description */}
            <div className="space-y-2 mb-8">
              <div className="h-5 w-full bg-slate-800/30 rounded animate-pulse" />
              <div className="h-5 w-4/5 bg-slate-800/30 rounded animate-pulse" />
            </div>
            {/* Buttons */}
            <div className="flex gap-4">
              <div className="h-12 w-36 bg-red-900/30 rounded-lg animate-pulse" />
              <div className="h-12 w-36 bg-slate-800/50 rounded-lg animate-pulse" />
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 animate-pulse">
                <div className="h-8 w-12 bg-slate-700/50 rounded mb-2" />
                <div className="h-4 w-20 bg-slate-700/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitions section skeleton */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="h-8 w-48 bg-slate-800/50 rounded mx-auto mb-4 animate-pulse" />
            <div className="h-5 w-72 bg-slate-800/30 rounded mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-800/30 border border-slate-700/30 p-8 animate-pulse">
                <div className="h-40 bg-slate-700/30 rounded-lg mb-6" />
                <div className="flex gap-2 mb-4">
                  <div className="h-6 w-16 bg-slate-700/30 rounded-full" />
                  <div className="h-6 w-20 bg-slate-700/30 rounded-full" />
                </div>
                <div className="h-6 w-3/4 bg-slate-700/30 rounded mb-2" />
                <div className="h-4 w-1/2 bg-slate-700/30 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Section-level skeleton for individual sections loaded with Suspense
 */
export function SectionSkeleton({ title }: { title?: string }) {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="h-8 w-48 bg-slate-800/50 rounded mx-auto mb-4 animate-pulse" />
          {title && <p className="text-slate-500 text-sm">{title}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-slate-800/30 border border-slate-700/30 overflow-hidden animate-pulse">
              <div className="h-48 bg-slate-700/30" />
              <div className="p-4">
                <div className="h-5 w-2/3 bg-slate-700/30 rounded mb-2" />
                <div className="h-4 w-1/2 bg-slate-700/30 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
