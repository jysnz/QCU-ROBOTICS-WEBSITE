import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist on the QCU Robotics website.",
};

const digit = "font-display text-[7.5rem] font-bold leading-none tracking-[-0.06em] sm:text-[11rem]";
const digitStyle = { background: "linear-gradient(180deg, #f8fafc 10%, #64748b 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;
const pop = (i: number) => ({ animationDelay: `${i * 110 + 80}ms` }) as React.CSSProperties;

/* A gear that stands in for the "0": the outer teeth turn one way, the inner ring the other. */
function Gear() {
  const teeth = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 120 120" className="h-[6.4rem] w-[6.4rem] sm:h-[9.4rem] sm:w-[9.4rem]" fill="none" aria-hidden="true">
      <g className="nf-spin" stroke="#c8f560" strokeWidth="3" strokeLinejoin="round">
        {teeth.map((deg) => <rect key={deg} x="53" y="3" width="14" height="17" rx="3" transform={`rotate(${deg} 60 60)`} fill="#c8f56018" />)}
        <circle cx="60" cy="60" r="41" fill="#0a0b0f" />
        <circle cx="60" cy="60" r="41" />
      </g>
      <g className="nf-spin-rev" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="60" cy="60" r="25" strokeDasharray="10 8" />
      </g>
      <circle cx="60" cy="60" r="9" fill="#c8f560" />
    </svg>
  );
}

/* Shown for any address that doesn't exist (wrapped by the site header and background from the root layout). */
export default function NotFound() {
  return (
    <main className="relative mx-auto flex min-h-[72vh] max-w-2xl flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      {/* soft pulsing glow behind the number */}
      <span className="nf-glow pointer-events-none absolute left-1/2 top-[34%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl sm:h-96 sm:w-96" aria-hidden="true" />

      <p className="kicker nf-pop relative" style={pop(0)}>Error 404</p>

      <div className="relative mt-5" role="img" aria-label="404">
        <div className="flex items-center justify-center gap-1 sm:gap-3" aria-hidden="true">
          {/* each piece pops in (outer) and then floats gently (inner); two animations can't share one element */}
          <span className="nf-pop" style={{ animationDelay: "160ms" }}><span className={`${digit} nf-float inline-block`} style={digitStyle}>4</span></span>
          <span className="nf-pop" style={{ animationDelay: "420ms" }}><span className="nf-float inline-block" style={{ animationDelay: "-1.8s" }}><Gear /></span></span>
          <span className="nf-pop" style={{ animationDelay: "680ms" }}><span className={`${digit} nf-float inline-block`} style={{ ...digitStyle, animationDelay: "-3.4s" }}>4</span></span>
        </div>
        {/* a bright bar that sweeps along under the number, like a scanner looking for the page */}
        <div className="relative mx-auto mt-3 h-[3px] w-56 overflow-hidden rounded-full bg-slate-800 sm:w-72" aria-hidden="true">
          <span className="nf-scan absolute inset-y-0 left-0 w-1/4 rounded-full bg-accent" />
        </div>
      </div>

      <h1 className="nf-pop relative mt-8 font-display text-2xl font-bold tracking-[-0.02em] text-white sm:text-3xl" style={pop(4)}>This page took a wrong turn</h1>
      <p className="nf-pop relative mt-3 max-w-md text-slate-400" style={pop(5)}>
        We couldn&rsquo;t find the page you were looking for. It may have moved, or the address may have a typo.
      </p>
      <p className="nf-pop relative mt-4 font-mono text-xs text-slate-500" style={pop(6)} aria-hidden="true">
        <span className="text-accent">$</span> route not found<span className="nf-blink ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-accent" />
      </p>

      <div className="nf-pop relative mt-9 flex flex-wrap justify-center gap-3" style={pop(7)}>
        <Link href="/" className="btn btn-primary group"><Home className="h-4 w-4" aria-hidden="true" /> Back to home</Link>
        <Link href="/matches" className="btn btn-ghost group">Matches <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" /></Link>
        <Link href="/achievements" className="btn btn-ghost group">Achievements <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" /></Link>
      </div>
    </main>
  );
}
