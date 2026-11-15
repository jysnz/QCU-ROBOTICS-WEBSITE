"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { JOIN_TEAM_FORM_URL } from "../lib/joinForm";
import { ArrowRight, Menu, X } from "lucide-react";

const NAV = [
  { label: "Competitions", section: "competitions" },
  { label: "Matches", href: "/matches" },
  { label: "Achievements", href: "/achievements" },
  { label: "About", section: "about-us" },
  { label: "Teams", section: "team-members" },
  { label: "Sponsors", section: "sponsors" },
] as const;

export default function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState("");
  const active = isHome ? seen : "";

  // Close the mobile menu whenever the route changes (derived during render, not in an effect).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) { setPrevPath(pathname); setOpen(false); }

  // Highlight the section currently in view on the home page.
  useEffect(() => {
    if (!isHome) return;
    const ids = NAV.flatMap((n) => ("section" in n ? [n.section] : []));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setSeen(e.target.id); }),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    const attach = () => ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    attach();
    const t = window.setTimeout(attach, 1200); // sections that render after data loads
    return () => { io.disconnect(); clearTimeout(t); };
  }, [isHome]);

  const goTo = (e: React.MouseEvent, section: string) => {
    if (!isHome) return; // normal link to /#section
    e.preventDefault();
    const el = document.getElementById(section);
    if (!el) return;
    window.history.replaceState(null, "", `#${section}`);
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 84, behavior: "smooth" });
    setOpen(false);
  };

  if (pathname.startsWith("/admin")) return null; // the admin area has its own chrome

  const link = (n: (typeof NAV)[number]) => {
    const isSection = "section" in n;
    const href = isSection ? `/#${n.section}` : n.href;
    const on = isSection ? active === n.section : pathname.startsWith(n.href);
    return (
      <Link
        key={n.label}
        href={href}
        onClick={isSection ? (e) => goTo(e, n.section) : undefined}
        aria-current={on ? "page" : undefined}
        className={`relative px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${on ? "text-white" : "text-slate-400 hover:text-white"}`}
      >
        {n.label}
        <span className={`absolute left-3 right-3 -bottom-px h-px bg-accent origin-left transition-transform duration-300 ${on ? "scale-x-100" : "scale-x-0"}`} />
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-700 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] md:h-[68px] max-w-[1200px] items-center justify-between gap-4 px-4 md:px-7">
        <Link href="/" className="flex items-center gap-3 rounded-lg" aria-label="QCU Robotics home">
          <Image className="site-logo h-10 w-10 md:h-11 md:w-11 object-contain" src="/logo-96.png" alt="" width={44} height={44} priority />
          <span className="flex flex-col leading-tight">
            <strong className="font-display text-[1.05rem] font-bold tracking-tight">QCU Robotics</strong>
            <small className="hidden sm:block text-xs text-slate-400">Quezon City University</small>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Main">{NAV.map(link)}</nav>

        <div className="flex items-center gap-2">
          <a href={JOIN_TEAM_FORM_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm group">
            Join the team
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-lg border border-slate-600 text-slate-300 transition-colors hover:text-white"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* mobile menu: height animates with a grid-row transition */}
      <div id="mobile-nav" className={`lg:hidden grid transition-[grid-template-rows] duration-300 ease-out-quint ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <nav className="overflow-hidden" aria-label="Mobile" inert={!open}>
          <div className="flex flex-col gap-1 border-t border-slate-700 px-4 py-3">
            {NAV.map((n) => {
              const isSection = "section" in n;
              return (
                <Link
                  key={n.label}
                  href={isSection ? `/#${n.section}` : n.href}
                  onClick={isSection ? (e) => goTo(e, n.section) : () => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-[0.95rem] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
