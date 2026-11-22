"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Bell, BellOff, BellRing, Cake, CheckCheck, ChevronDown, CheckCircle2, ClipboardList, Clock, Loader2, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { notify } from "./notify";
import { sb } from "./supabase";
import { disablePush, enablePush, getPushState, type PushState } from "./push";

/* The notification panel of the admin area: a bell with an unread count, and a side panel listing everything sent to you.
   New notifications arrive live (Supabase Realtime) and, if you turned push on for this device, also as a system notification
   through Firebase Cloud Messaging even when the site isn't open. */
export type Note = { id: string; type: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null };

const COLS = "id, type, title, body, link, created_at, read_at";
const table = () => sb.schema("public").from("notifications");

const KIND: Record<string, { icon: LucideIcon; tone: string }> = {
  task_assigned: { icon: ClipboardList, tone: "bg-accent/15 text-accent" },
  task_done: { icon: CheckCircle2, tone: "bg-accent/15 text-accent" },
  task_due: { icon: Clock, tone: "bg-[#fbbf24]/15 text-[#fbbf24]" },
  task_late: { icon: Clock, tone: "bg-[#ef4444]/15 text-[#f87171]" },
  birthday: { icon: Cake, tone: "bg-pink-400/15 text-pink-300" },
  registration: { icon: UserPlus, tone: "bg-sky-400/15 text-sky-300" },
  registration_approved: { icon: UserPlus, tone: "bg-accent/15 text-accent" },
  registration_rejected: { icon: UserPlus, tone: "bg-[#ef4444]/15 text-[#f87171]" },
  account_rejected: { icon: ShieldCheck, tone: "bg-[#ef4444]/15 text-[#f87171]" },
  access_request: { icon: ShieldCheck, tone: "bg-violet-400/15 text-violet-300" },
  account_approved: { icon: ShieldCheck, tone: "bg-accent/15 text-accent" },
};

/* Task notices carry a different title each time, so these are grouped by type alone: five new tasks = one row. */
const GROUP_BY_TYPE = new Set(["task_assigned", "task_done", "task_due", "task_late"]);

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  const units: [number, Intl.RelativeTimeFormatUnit][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"], [2629800, "month"], [31557600, "year"]];
  let i = 0;
  while (i < units.length - 1 && abs >= units[i + 1][0]) i++;
  return rtf.format(Math.round(diff / units[i][0]), units[i][1]);
}

/** Loads your notifications and keeps them current. Call once (in the dashboard) and share the result. */
export function useNotifications() {
  const [items, setItems] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await table().select(COLS).order("created_at", { ascending: false }).limit(60);
    setItems((data ?? []) as Note[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    let off = false;
    let channel: ReturnType<typeof sb.channel> | null = null;
    (async () => {
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid || off) return;
      channel = sb.channel(`notifications-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (p) => {
          const n = p.new as Note;
          setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
          notify.info(n.title, { description: n.body ?? undefined });
        })
        .subscribe();
    })();
    const timer = window.setInterval(load, 90_000); // safety net if the live connection drops
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { off = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); if (channel) sb.removeChannel(channel); };
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const at = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? at } : n)));
    await table().update({ read_at: at }).in("id", ids).is("read_at", null);
  }
  async function remove(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await table().delete().eq("id", id);
  }
  async function removeMany(ids: string[]) {
    if (!ids.length) return;
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    await table().delete().in("id", ids);
  }
  async function clearRead() {
    const ids = items.filter((n) => n.read_at).map((n) => n.id);
    if (!ids.length) return;
    setItems((prev) => prev.filter((n) => !n.read_at));
    await table().delete().in("id", ids);
  }

  return { items, unread, loaded, open, setOpen, markRead, remove, removeMany, clearRead, reload: load };
}
export type NotificationsApi = ReturnType<typeof useNotifications>;

/** The bell in the sidebar / top bar. */
export function BellButton({ api, className = "" }: { api: NotificationsApi; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => api.setOpen(true)}
      aria-label={api.unread > 0 ? `Notifications, ${api.unread} unread` : "Notifications"}
      className={`relative grid place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-slate-500 hover:text-white ${className}`}
    >
      {api.unread > 0 ? <BellRing className="h-4 w-4 text-accent" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
      {api.unread > 0 && (
        <span className="tk-pop absolute -right-1.5 -top-1.5 grid min-w-[1.15rem] place-items-center rounded-full bg-accent px-1 py-0.5 font-mono text-[.6rem] font-bold leading-none text-accent-ink" aria-hidden="true">{api.unread > 99 ? "99+" : api.unread}</span>
      )}
    </button>
  );
}

/* Switch for system notifications on this device. */
function PushControl() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getPushState().then(setState); }, []);

  async function toggle() {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") notify.created("Notifications are on", { description: "This device will get a notification even when the site isn't open." });
      else if (next === "denied") notify.error("Notifications are blocked", { description: "Allow them for this site in your browser's settings, then try again." });
    } catch {
      notify.error("Couldn't change notifications on this device.");
    }
    setBusy(false);
  }

  if (state === null) return null;
  const copy: Record<PushState, string> = {
    unconfigured: "Push notifications aren't set up on this site yet.",
    unsupported: "This browser can't show push notifications.",
    denied: "Blocked in your browser. Allow notifications for this site to turn them on.",
    off: "Get a notification on this device even when the site is closed.",
    on: "On for this device. You'll be notified even when the site is closed.",
  };
  const can = state === "on" || state === "off";
  return (
    <div className="flex items-center gap-3 border-t border-slate-700 p-4">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${state === "on" ? "bg-accent/15 text-accent" : "bg-slate-800 text-slate-400"}`}>
        {state === "on" ? <BellRing className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
      </span>
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-400">{copy[state]}</p>
      {can && (
        <button type="button" onClick={toggle} disabled={busy} className={`btn btn-sm shrink-0 disabled:opacity-60 ${state === "on" ? "btn-ghost" : "btn-primary"}`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{state === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}

/** For the "waiting" and "declined" screens: lets someone who isn't inside the admin yet get a notification when they are approved or declined. */
export function NotifyMe() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getPushState().then(setState); }, []);
  if (state === null || state === "unconfigured" || state === "unsupported") return null;
  const on = state === "on";
  async function click() {
    setBusy(true);
    try { setState(on ? await disablePush() : await enablePush()); } catch { notify.error("Couldn't change notifications on this device."); }
    setBusy(false);
  }
  return (
    <div className="mt-8 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${on ? "bg-accent/15 text-accent" : "bg-slate-800 text-slate-400"}`}>{on ? <BellRing className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}</span>
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-400">
        {state === "denied" ? "Notifications are blocked in your browser. Allow them for this site to be told the decision." : on ? "You'll get a notification here when an admin decides." : "Want to be told when an admin decides? Turn on notifications."}
      </p>
      {state !== "denied" && (
        <button type="button" onClick={click} disabled={busy} className={`btn btn-sm shrink-0 disabled:opacity-60 ${on ? "btn-ghost" : "btn-primary"}`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{on ? "Turn off" : "Notify me"}
        </button>
      )}
    </div>
  );
}

/** The side panel. `onNavigate` receives the section id of a "/admin#section" link. */
export function NotificationPanel({ api, onNavigate }: { api: NotificationsApi; onNavigate: (id: string) => void }) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const shown = useMemo(() => (tab === "unread" ? api.items.filter((n) => !n.read_at) : api.items), [api.items, tab]);
  // "The same" = same type and same heading (e.g. several "New registration to review"). Different headings, like each task or birthday, stay separate.
  const groups = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of shown) { const k = GROUP_BY_TYPE.has(n.type) ? n.type : `${n.type}\u0000${n.title}`; const g = m.get(k); if (g) g.push(n); else m.set(k, [n]); }
    return [...m.entries()].map(([key, items]) => ({ key, items, latest: items[0], unread: items.filter((x) => !x.read_at).length })); // items are newest first
  }, [shown]);
  const toggleGroup = (k: string) => setOpenGroups((o) => { const n = new Set(o); if (!n.delete(k)) n.add(k); return n; });

  function openGroup(g: { items: Note[]; latest: Note }) {
    api.markRead(g.items.filter((x) => !x.read_at).map((x) => x.id));
    api.setOpen(false);
    const hash = g.latest.link?.split("#")[1];
    if (hash) onNavigate(hash);
    else if (g.latest.link && g.latest.link !== "/admin") window.location.assign(g.latest.link);
  }

  function openNote(n: Note) {
    api.markRead([n.id]);
    api.setOpen(false);
    const hash = n.link?.split("#")[1];
    if (hash) onNavigate(hash);
    else if (n.link && n.link !== "/admin") window.location.assign(n.link);
  }

  return (
    <Dialog.Root open={api.open} onOpenChange={api.setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 overflow-clip">
          <Dialog.Popup className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-700 bg-slate-950 shadow-[0_0_60px_rgba(0,0,0,.6)] outline-none transition-transform duration-300 ease-out-quint data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
              <div>
                <Dialog.Title className="font-display text-lg font-semibold text-white">Notifications</Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">{api.unread > 0 ? `${api.unread} unread` : "You're all caught up"}</Dialog.Description>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => api.markRead(api.items.filter((n) => !n.read_at).map((n) => n.id))} disabled={api.unread === 0} title="Mark all as read" aria-label="Mark all as read" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"><CheckCheck className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" onClick={api.clearRead} disabled={!api.items.some((n) => n.read_at)} title="Clear read notifications" aria-label="Clear read notifications" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                <Dialog.Close aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
              </div>
            </div>

            <div className="shrink-0 px-5 pt-4">
              <div className="inline-flex gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1" role="tablist" aria-label="Filter notifications">
                {(["all", "unread"] as const).map((f) => (
                  <button key={f} type="button" role="tab" aria-selected={tab === f} onClick={() => setTab(f)} className={`h-8 rounded-lg px-4 text-sm font-semibold capitalize transition-colors duration-200 ${tab === f ? "bg-accent text-accent-ink" : "text-slate-300 hover:text-white"}`}>
                    {f}{f === "unread" && api.unread > 0 && <span className={`ml-1.5 font-mono text-xs ${tab === f ? "text-accent-ink/70" : "text-slate-500"}`}>{api.unread}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              {!api.loaded ? (
                <div className="space-y-2 px-2" aria-hidden="true">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-900" />)}</div>
              ) : shown.length === 0 ? (
                <div className="grid place-items-center px-6 py-16 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-500"><Bell className="h-5 w-5" aria-hidden="true" /></span>
                  <p className="mt-4 font-medium text-white">{tab === "unread" ? "Nothing unread" : "No notifications yet"}</p>
                  <p className="mt-1 max-w-xs text-sm text-slate-400">New tasks, registrations, access requests and birthdays show up here.</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {groups.map((g) => {
                    const k = KIND[g.latest.type] ?? { icon: Bell, tone: "bg-slate-800 text-slate-300" };
                    const Icon = k.icon;
                    const many = g.items.length > 1;
                    const expanded = many && openGroups.has(g.key);
                    const unread = g.unread > 0;
                    return (
                      <li key={g.key} className="group relative">
                        <button type="button" onClick={() => openGroup(g)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${unread ? "bg-accent/[.05] hover:bg-accent/[.09]" : "hover:bg-slate-900"}`}>
                          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${k.tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1 pr-14">
                            <span className={`flex items-center gap-2 text-sm ${unread ? "font-semibold text-white" : "font-medium text-slate-300"}`}>
                              <span className="min-w-0 truncate">{g.latest.title}</span>
                              {many && <span className="shrink-0 rounded-full border border-slate-600 px-1.5 py-0.5 font-mono text-[.62rem] leading-none text-slate-300" title={`${g.items.length} notifications`}>×{g.items.length}</span>}
                            </span>
                            {g.latest.body && <span className="mt-0.5 block text-sm leading-snug text-slate-400">{g.latest.body}{many && <span className="text-slate-500"> · and {g.items.length - 1} more</span>}</span>}
                            <span className="mt-1 block font-mono text-[.68rem] text-slate-500" title={new Date(g.latest.created_at).toLocaleString()}>{ago(g.latest.created_at)}{many && unread && ` · ${g.unread} unread`}</span>
                          </span>
                          {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                        </button>
                        <span className="absolute right-2 top-2 flex items-center gap-0.5">
                          {many && (
                            <button type="button" onClick={() => toggleGroup(g.key)} aria-expanded={expanded} aria-label={expanded ? "Hide the grouped notifications" : `Show all ${g.items.length}`} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ease-out-quint ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                            </button>
                          )}
                          <button type="button" onClick={() => api.removeMany(g.items.map((x) => x.id))} aria-label={many ? `Delete all ${g.items.length}` : "Delete notification"} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 opacity-0 transition-[opacity,background-color,color] hover:bg-slate-800 hover:text-[#f87171] focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                        </span>

                        {many && (
                          <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={!expanded}>
                            <ul className="min-h-0 overflow-hidden">
                              {g.items.map((n) => (
                                <li key={n.id} className="group/item relative ml-9 border-l border-slate-800 pl-3">
                                  <button type="button" onClick={() => openNote(n)} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-900">
                                    <span className="min-w-0 flex-1 pr-6">
                                      <span className={`block text-[.82rem] leading-snug ${n.read_at ? "text-slate-400" : "font-medium text-slate-200"}`}>{n.body || n.title}</span>
                                      <span className="mt-0.5 block font-mono text-[.66rem] text-slate-500" title={new Date(n.created_at).toLocaleString()}>{ago(n.created_at)}</span>
                                    </span>
                                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                                  </button>
                                  <button type="button" onClick={() => api.remove(n.id)} aria-label="Delete this one" className="absolute right-1 top-1.5 grid h-6 w-6 place-items-center rounded-md text-slate-500 opacity-0 transition-[opacity,background-color,color] hover:bg-slate-800 hover:text-[#f87171] focus-visible:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100"><X className="h-3 w-3" aria-hidden="true" /></button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <PushControl />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
