"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cached } from "./cache";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import NumberFlow from "@number-flow/react";
import { Toaster } from "sonner";
import { ArrowUpRight, Award, Building2, Camera, CalendarRange, ClipboardCheck, ExternalLink, FileText, GraduationCap, BookUser, HeartHandshake, LayoutDashboard, LogOut, Medal, Network, Plus, Share2, Shield, ShieldCheck, Swords, Tag, Trophy, ListTodo, Search, Send, UserRound, Users, Menu, X, Bell, Settings as SettingsIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Accounts from "./Accounts";
import CommandPalette, { type PaletteItem } from "./CommandPalette";
import InformationPanel from "./InformationPanel";
import Insights from "./Insights";
import PeoplePanel from "./PeoplePanel";
import SponsorsPanel from "./SponsorsPanel";
import TeamPlayersPanel from "./TeamPlayersPanel";
import TeamRecordChart from "./TeamRecordChart";
import CrudPanel from "./CrudPanel";
import Registrations from "./Registrations";
import Tasks from "./Tasks";
import { canAssignTasks, useAdminRole, usePendingPrompts } from "./useAdminRole";
import { useReviewCounts } from "./useReviewCounts";
import { BellButton, NotificationPanel, useNotifications } from "./Notifications";
import PushPrompt from "./PushPrompt";
import SettingsPage from "./Settings";
import { RESOURCES } from "./resources";
import { sb } from "./supabase";

type View = string; // "overview" | "registrations" | "accounts" | a resource id

const ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard, "tasks-assign": Send, "tasks-todo": ListTodo, registrations: ClipboardCheck, accounts: ShieldCheck,
  "team-players": Users, assignments: Network, "player-roles": Medal, "media-team": Camera, members: UserRound, coaches: GraduationCap,
  seasons: CalendarRange, teams: Shield, competitions: Trophy, matches: Swords, achievements: Award,
  information: BookUser, roles: Tag, "sponsor-companies": Building2, sponsors: HeartHandshake, socials: Share2, descriptions: FileText,
  settings: SettingsIcon,
};

// Team and role are chosen when a player is added, so the separate assignment and player-role pages are gone.
const MERGED: Record<string, string> = { assignments: "team-players", "player-roles": "team-players", "sponsor-companies": "sponsors" };
const GROUPS: { title: string; items: { id: View; label: string }[] }[] = [
  { title: "Overview", items: [{ id: "overview", label: "Dashboard" }] },
  { title: "Review", items: [{ id: "registrations", label: "Registrations" }, { id: "accounts", label: "Accounts" }] },
  { title: "Tasks", items: [{ id: "tasks-assign", label: "Assign" }, { id: "tasks-todo", label: "To do" }] },
  ...(["People", "Competitions", "Site"] as const).map((g) => ({
    title: g,
    items: [
      ...RESOURCES.filter((r) => r.group === g && !(r.id in MERGED)).map((r) => ({ id: r.id, label: r.label })),
      ...(g === "People" ? [{ id: "information", label: "Informations" }] : []), // directory of everyone who registered, with their photos
    ],
  })),
  { title: "Account", items: [{ id: "settings", label: "Settings" }] }, // profile, email, password, privacy & terms, sign out
];
const VALID = new Set([...GROUPS.flatMap((g) => g.items.map((i) => i.id)), ...Object.keys(MERGED)]); // old #assignments / #player-roles links fall back to Team players

const STAT_GROUPS: { title: string; blurb: string; ids: string[] }[] = [
  { title: "People", blurb: "Rosters shown on the site: players, media team, members and coaches.", ids: ["team-players", "media-team", "members", "coaches"] },
  { title: "Competitions", blurb: "Seasons, teams and everything they entered and won.", ids: ["seasons", "teams", "competitions", "matches", "achievements"] },
  { title: "Site", blurb: "Sponsors, social links and the text across the site.", ids: ["sponsor-companies", "sponsors", "socials"] },
];

type Stat = { count: number; active?: number; latest?: string };

const QUICK = [
  { id: "team-players", label: "Assign team player" },
  { id: "matches", label: "Add match" },
  { id: "competitions", label: "Add competition" },
  { id: "achievements", label: "Add achievement" },
];

const rise = (i: number): React.CSSProperties => ({ animation: "rise .6s var(--ease) both", animationDelay: `${Math.min(i, 14) * 45}ms` });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Overview({ name, go, review }: { name: string; go: (v: View, add?: boolean) => void; review: { registrations: number; accounts: number; loaded: boolean } }) {
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [loaded, setLoaded] = useState(false);
  // the two "needs attention" numbers come from the dashboard's single, lightweight count request (shared with the sidebar badges)
  const waiting = review.loaded ? { regs: review.registrations, accounts: review.accounts } : { regs: null, accounts: null };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = STAT_GROUPS.flatMap((g) => g.ids);
      const entries = await cached("overview-stats", () => Promise.all(
        ids.map(async (id): Promise<readonly [string, Stat]> => {
          const r = RESOURCES.find((x) => x.id === id)!;
          const hasActive = r.fields.some((f) => f.key === "is_active");
          const titleIsText = r.fields.find((f) => f.key === r.titleKey)?.type === "text";
          const pk = r.pk ?? "id";
          // counts only (head requests): no rows travel just to be counted
          const [total, act, last] = await Promise.all([
            sb.from(r.table).select(pk, { count: "exact", head: true }),
            hasActive ? sb.from(r.table).select(pk, { count: "exact", head: true }).eq("is_active", true) : Promise.resolve(null),
            titleIsText ? sb.from(r.table).select(r.titleKey).order(pk, { ascending: false }).limit(1) : Promise.resolve(null),
          ]);
          const top = ((last?.data ?? []) as unknown as Record<string, unknown>[])[0];
          return [id, {
            count: total.count ?? 0,
            active: hasActive ? act?.count ?? 0 : undefined,
            latest: titleIsText && top ? String(top[r.titleKey] ?? "") : undefined,
          }] as const;
        }),
      ), 30_000);
      if (!cancelled) { setStats(Object.fromEntries(entries)); setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const attention = [
    { id: "registrations", label: "Registrations to review", n: waiting.regs, icon: ClipboardCheck },
    { id: "accounts", label: "Accounts awaiting approval", n: waiting.accounts, icon: ShieldCheck },
  ];
  let i = 0;

  return (
    <section aria-labelledby="panel-title">
      <div className="mb-8 max-w-2xl" style={rise(i++)}>
        <p className="kicker mb-3">Admin</p>
        <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl">
          {greeting()}, {name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-slate-400">Everything you change here updates the live website.</p>
      </div>

      {/* Needs attention */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {attention.map((a) => {
          const has = (a.n ?? 0) > 0;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => go(a.id)}
              style={rise(i++)}
              className={`lift group flex items-center gap-4 rounded-2xl border p-5 text-left ${has ? "border-accent/50 bg-accent/[.06]" : "border-slate-700 bg-slate-900"}`}
            >
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-600 bg-slate-950/60 text-slate-300">
                <a.icon className="h-5 w-5" aria-hidden="true" />
                {has && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent" style={{ animation: "blink 1.8s ease-in-out infinite" }} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-bold tabular-nums text-white">
                  {a.n === null ? "—" : <NumberFlow value={a.n} />}
                </span>
                <span className="block text-sm text-slate-400">{has ? a.label : a.n === null ? a.label : `${a.label}: all caught up`}</span>
              </span>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-500 transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mb-12" style={rise(i++)}>
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[.16em] text-slate-400">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          {QUICK.map((q) => (
            <button key={q.id} type="button" onClick={() => go(q.id, true)} className="btn btn-ghost btn-sm group">
              <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" aria-hidden="true" />
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-12 space-y-4" style={rise(i++)}><Insights /><TeamRecordChart /></div>

      {/* Content at a glance: one panel per area */}
      <div className="space-y-6">
        {STAT_GROUPS.map((g) => {
          const total = g.ids.reduce((n, id) => n + (stats[id]?.count ?? 0), 0);
          return (
            <section key={g.title} aria-label={g.title} className="rounded-3xl border border-slate-700 bg-slate-950/40 p-5 sm:p-6" style={rise(i++)}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
                <div className="max-w-md">
                  <h2 className="font-display text-xl font-semibold tracking-tight text-white">{g.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{g.blurb}</p>
                </div>
                <p className="text-sm text-slate-400">
                  <span className="font-display text-2xl font-bold tabular-nums text-white"><NumberFlow value={total} /></span> entries
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.ids.map((id, n) => {
                  const r = RESOURCES.find((x) => x.id === id)!;
                  const Icon = ICONS[id];
                  const st = stats[id];
                  return (
                    <li key={id} className="group relative" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${n * 50 + 150}ms` }}>
                      <button type="button" onClick={() => go(id)} className="lift flex h-full w-full flex-col rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left hover:border-slate-500">
                        <span className="flex items-center gap-3 text-slate-400">
                          <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 bg-slate-950/60 transition-colors duration-200 group-hover:border-accent/50 group-hover:text-accent">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="text-sm font-medium text-slate-200">{r.label}</span>
                        </span>
                        <span className={`mt-5 block font-display text-4xl font-bold tabular-nums text-white transition-opacity duration-300 ${loaded ? "" : "opacity-40"}`}>
                          <NumberFlow value={st?.count ?? 0} transformTiming={{ duration: 700, easing: "cubic-bezier(.2,0,0,1)" }} />
                        </span>
                        <span className="mt-3 flex min-h-5 items-center gap-2 text-xs text-slate-400">
                          {st?.active !== undefined && (
                            <>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.active > 0 ? "bg-accent" : "bg-slate-600"}`} aria-hidden="true" />
                              <span><span className="font-mono tabular-nums text-slate-200">{st.active}</span> active</span>
                            </>
                          )}
                          {st?.active === undefined && st?.latest && <span className="truncate">Latest: <span className="text-slate-200">{st.latest}</span></span>}
                          {st && st.count === 0 && <span>Nothing here yet</span>}
                        </span>
                      </button>
                      {/* Add shortcut: a sibling of the card button (buttons can't nest) */}
                      <button
                        type="button"
                        onClick={() => go(id, true)}
                        aria-label={`Add ${r.singular}`}
                        title={`Add ${r.singular}`}
                        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-slate-500 opacity-0 transition-[opacity,color,border-color,background-color] duration-150 hover:border-slate-600 hover:bg-slate-800 hover:text-accent focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default function Dashboard({ name, email, onSignOut, onAccountChanged }: { name: string; email: string; onSignOut: () => void; onAccountChanged?: () => void }) {
  const [view, setView] = useState<View>(() => {
    const h = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (h.startsWith("settings")) return "settings"; // #settings-email etc. open that tab of Settings
    return MERGED[h] ?? (VALID.has(h) ? h : "overview");
  });
  const [startNew, setStartNew] = useState(false); // open the "add" form as soon as the section loads
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mac, setMac] = useState(false);
  const role = useAdminRole();
  const pending = usePendingPrompts(role, view); // competition tasks waiting for the media head
  const review = useReviewCounts(view); // registrations and accounts waiting for a decision
  const notifs = useNotifications(); // the bell + notification panel
  // Assigning tasks is for the super admin, the media head and the head's assistants; everyone else just sees To do.
  const groups = useMemo(() => GROUPS.map((g) => (g.title === "Tasks" ? { ...g, items: g.items.filter((i) => i.id !== "tasks-assign" || canAssignTasks(role)) } : g)), [role]);
  const canAssign = canAssignTasks(role);

  useEffect(() => {
    // someone without access landed on #tasks-assign (old link, or their role changed): send them to their own list
    if (role !== undefined && !canAssign && view === "tasks-assign") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView("tasks-todo");
      window.history.replaceState(null, "", "/admin#tasks-todo");
    }
  }, [role, canAssign, view]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuClose = useRef<HTMLButtonElement>(null); // focus starts on the menu's own close button, so focusing doesn't move the list
  const menuNav = useRef<HTMLElement>(null);
  // every time the menu opens, the button of the page you are on is centred in the list
  const centreCurrent = () => {
    const nav = menuNav.current;
    const cur = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !cur) return;
    const n = nav.getBoundingClientRect(), c = cur.getBoundingClientRect();
    nav.scrollTop += (c.top - n.top) - (n.height - c.height) / 2; // relative positions, so the slide-in animation doesn't matter
  };
  useEffect(() => {
    if (!menuOpen) return;
    const id = requestAnimationFrame(centreCurrent);
    const late = window.setTimeout(centreCurrent, 120); // after the slide-in has started
    return () => { cancelAnimationFrame(id); clearTimeout(late); };
  }, [menuOpen]);
  const go = (v: View, add = false) => {
    setMenuOpen(false);
    const target = MERGED[v] ?? v; // merged pages open their new home
    setStartNew(add);
    setView(target);
    window.history.replaceState(null, "", v === "overview" ? "/admin" : `/admin#${v}`);
    window.scrollTo({ top: 0 });
  };

  const resource = RESOURCES.find((r) => r.id === view);

  const paletteItems: PaletteItem[] = [
    ...groups.flatMap((g) => g.items.map((i) => ({ id: `go-${i.id}`, label: i.label, group: "Go to", icon: ICONS[i.id], run: () => go(i.id) }))),
    ...QUICK.map((q) => ({ id: `add-${q.id}`, label: q.label, group: "Quick actions", icon: Plus, run: () => go(q.id, true) })),
    { id: "notifs", label: "Open notifications", group: "Go to", icon: Bell, run: () => notifs.setOpen(true) },
    { id: "site", label: "Open the website", group: "Account", icon: ExternalLink, run: () => window.open("/", "_blank") },
    { id: "out", label: "Sign out", group: "Account", icon: LogOut, run: onSignOut },
  ];

  const navList = () => (
    <>
          {groups.map((g) => (
            <div key={g.title} className="mt-5 first:mt-0">
              <p className="px-3 pb-2 font-mono text-[.66rem] uppercase tracking-[.18em] text-slate-500 select-none">{g.title}</p>
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const Icon = ICONS[i.id];
                  const on = view === i.id || MERGED[view] === i.id;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => go(i.id)}
                        aria-current={on ? "page" : undefined}
                        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${on ? "bg-slate-800/80 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}
                      >
                        <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent transition-[transform,opacity] duration-300 ease-out-quint ${on ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"}`} aria-hidden="true" />
                        <Icon className={`h-4 w-4 shrink-0 transition-colors duration-150 ${on ? "text-accent" : "text-slate-500 group-hover:text-slate-300"}`} aria-hidden="true" />
                        {i.label}
                        {i.id === "tasks-assign" && pending > 0 && <span className="tk-pop ml-auto rounded-full bg-accent px-1.5 py-0.5 font-mono text-[.62rem] font-bold leading-none text-accent-ink" aria-label={`${pending} competition tasks to assign`}>{pending}</span>}
                        {i.id === "registrations" && review.registrations > 0 && <span className="tk-pop ml-auto rounded-full bg-accent px-1.5 py-0.5 font-mono text-[.62rem] font-bold leading-none text-accent-ink" aria-label={`${review.registrations} registrations waiting for review`}>{review.registrations}</span>}
                        {i.id === "accounts" && review.accounts > 0 && <span className="tk-pop ml-auto rounded-full bg-accent px-1.5 py-0.5 font-mono text-[.62rem] font-bold leading-none text-accent-ink" aria-label={`${review.accounts} accounts waiting for approval`}>{review.accounts}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
  );

  return (
    <>
      {/* Rendered into <body> so the message boxes stay pinned to the screen corner wherever the page is scrolled,
          even if a parent is padded, animated or very tall. */}
      {typeof document !== "undefined" && createPortal(
        <Toaster position="bottom-right" expand visibleToasts={5} gap={10} offset={{ bottom: 76, right: 12 }} mobileOffset={{ bottom: 76, right: 12, left: 12 }} style={{ position: "fixed", zIndex: 2147483000 }} />,
        document.body,
      )}
      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 lg:hidden" />
          <Dialog.Popup initialFocus={menuClose} className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col border-r border-slate-700 bg-slate-950 outline-none transition-transform duration-300 ease-out-quint data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full lg:hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <Dialog.Title className="font-display text-base font-semibold text-white">Menu</Dialog.Title>
              <Dialog.Close ref={menuClose} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Choose a section of the admin</Dialog.Description>
            <nav ref={(el) => { menuNav.current = el; if (el) centreCurrent(); }} aria-label="Admin sections" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">{navList()}</nav>
            <div className="border-t border-slate-700 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="truncate text-sm font-medium text-white">{name}</p>
              <p className="mb-3 truncate text-xs text-slate-500">{email}</p>
              <div className="flex gap-2">
                <Link href="/" target="_blank" className="btn btn-ghost btn-sm flex-1"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Site</Link>
                <button type="button" onClick={onSignOut} className="btn btn-ghost btn-sm flex-1"><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out</button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <NotificationPanel api={notifs} onNavigate={(id) => go(id)} />
      <PushPrompt />
      <CommandPalette items={paletteItems} open={paletteOpen} onOpenChange={setPaletteOpen} />
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 z-30 border-b border-slate-700 bg-slate-950/90 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-5 lg:py-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/logo-96.png" alt="" width={36} height={36} className="site-logo" />
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-semibold text-white whitespace-nowrap">QCU Robotics</span>
              <span className="block font-mono text-[10px] uppercase tracking-[.18em] text-accent">Admin</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <BellButton api={notifs} className="h-11 w-11" />
            <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search" className="grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-slate-500 hover:text-white active:scale-95"><Search className="h-[18px] w-[18px]" aria-hidden="true" /></button>
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent transition-colors hover:bg-accent/15 active:scale-95"><Menu className="h-5 w-5" aria-hidden="true" /></button>
          </div>
        </div>

        <div className="hidden items-center gap-2 px-3 pb-4 lg:flex">
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-10 w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1 text-left">Jump to…</span>
            <kbd className="rounded border border-slate-600 px-1.5 py-0.5 font-mono text-[10px]">{mac ? "⌘K" : "Ctrl K"}</kbd>
          </button>
          <BellButton api={notifs} className="h-10 w-10 shrink-0" />
        </div>

        <nav aria-label="Admin sections" className="hidden min-h-0 flex-1 overflow-y-auto px-3 pb-6 lg:block">{navList()}</nav>

        <div className="hidden border-t border-slate-700 p-4 lg:block">
          <button type="button" onClick={() => go("settings")} aria-label="Open settings" className="group -m-1.5 flex w-[calc(100%+.75rem)] items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-slate-900">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-600 bg-slate-800 font-display text-sm font-semibold text-accent transition-colors group-hover:border-accent" aria-hidden="true">
              {(name.trim()[0] ?? "?").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{name}</span>
              <span className="block truncate text-xs text-slate-500">{email}</span>
            </span>
            <SettingsIcon className="h-4 w-4 shrink-0 text-slate-600 transition-[color,transform] duration-300 group-hover:rotate-90 group-hover:text-accent" aria-hidden="true" />
          </button>
          <div className="mt-3 flex gap-2">
            <Link href="/" target="_blank" className="btn btn-ghost btn-sm flex-1"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Site</Link>
            <button type="button" onClick={onSignOut} className="btn btn-ghost btn-sm flex-1"><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out</button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-12">
        <div className="mx-auto max-w-5xl">
          {/* keyed so every section change fades in instead of snapping */}
          <div key={view} className="animate-fadeIn">
            {view === "overview" && <Overview name={name} go={go} review={review} />}
            {view === "registrations" && <Registrations />}
            {view === "accounts" && <Accounts />}
            {view === "settings" && <SettingsPage onSignOut={onSignOut} onAccountChanged={() => onAccountChanged?.()} />}
            {((view === "tasks-assign" && canAssign) || view === "tasks-todo") && <Tasks mode={view === "tasks-assign" ? "assign" : "todo"} />}
            {view === "team-players" && <TeamPlayersPanel startNew={startNew} />}
            {(view === "media-team" || view === "members" || view === "coaches") && <PeoplePanel key={view} kind={view === "media-team" ? "media" : view} startNew={startNew} />}
            {view === "sponsors" && <SponsorsPanel />}
            {view === "information" && <InformationPanel />}
            {resource && view !== "team-players" && view !== "media-team" && view !== "members" && view !== "coaches" && view !== "sponsors" && <CrudPanel key={resource.id} resource={resource} startNew={startNew} />}
          </div>
        </div>
      </main>
    </div>
    </>
  );
}
