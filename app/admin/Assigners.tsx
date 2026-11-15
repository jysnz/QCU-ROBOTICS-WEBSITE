"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Crown, Loader2, Search, ShieldCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { notify } from "./notify";
import { adminFetch, sb } from "./supabase";
import { isHead, type AdminRole } from "./useAdminRole";

type Person = { id: string; email: string; full_name: string | null; avatar_url: string | null };
type RoleRow = { user_id: string; role: "super_admin" | "media_head" | "media_assistant" };

const nameOf = (p?: Person) => p?.full_name || p?.email || "Someone";
const ORDER = { super_admin: 0, media_head: 1, media_assistant: 2 } as const;
const BADGE = {
  super_admin: { label: "Super admin", cls: "border-accent/40 bg-accent/10 text-accent", Icon: ShieldCheck },
  media_head: { label: "Media head", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300", Icon: Crown },
  media_assistant: { label: "Assistant", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300", Icon: Users },
} as const;

function Face({ p, size = 9 }: { p?: Person; size?: 7 | 9 }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-slate-600 bg-slate-800 font-display font-semibold text-slate-300 ${size === 9 ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs"}`}>
      {p?.avatar_url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (nameOf(p).trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/* Shown on the To do page so everyone knows who hands out tasks. Only the media head (and the super admin) can
   make or remove assistants; an assistant can assign tasks on the head's behalf. */
export default function Assigners({ role }: { role: AdminRole | undefined }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [me, setMe] = useState("");
  const [pick, setPick] = useState("");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const manage = isHead(role);

  const load = useCallback(async () => {
    const { data } = await sb.from("admin_roles").select("user_id, role");
    setRows((data ?? []) as RoleRow[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    adminFetch<{ people: Person[]; me: string }>("/api/admin/people").then((b) => { setPeople(b.people); setMe(b.me); }).catch(() => {});
  }, [load]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => ORDER[a.role] - ORDER[b.role]), [rows]);
  const taken = new Set((rows ?? []).map((r) => r.user_id));
  const options = people.filter((p) => !taken.has(p.id));
  const q = find.trim().toLowerCase();
  const matches = useMemo(() => (q ? options.filter((p) => `${p.full_name ?? ""} ${p.email}`.toLowerCase().includes(q)) : options), [options, q]);
  const picked = byId.get(pick);
  const assistants = sorted.filter((r) => r.role === "media_assistant").length;
  const hasHead = sorted.some((r) => r.role === "media_head");

  async function add() {
    if (!pick) return;
    setBusy("add");
    const { error } = await sb.from("admin_roles").insert({ user_id: pick, role: "media_assistant", granted_by: me || null });
    setBusy(null);
    if (error) { notify.error("Couldn't add the assistant.", { description: error.message }); return; }
    notify.created(nameOf(byId.get(pick)), { description: "Can now assign tasks on the media head's behalf." });
    setPick("");
    setFind("");
    load();
  }
  async function remove(id: string) {
    setBusy(id);
    const { error } = await sb.from("admin_roles").delete().eq("user_id", id).eq("role", "media_assistant");
    setBusy(null);
    if (error) { notify.error("Couldn't remove the assistant."); return; }
    notify.deleted(`${nameOf(byId.get(id))} is no longer an assistant`);
    load();
  }

  return (
    <section aria-label="Who can assign tasks" className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/60">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Users className="h-4 w-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">Who can assign tasks</span>
          <span className="block truncate text-xs text-slate-400">{rows === null ? "Loading…" : `${hasHead ? "Media head" : "No media head yet"}${assistants ? ` + ${assistants} ${assistants === 1 ? "assistant" : "assistants"}` : ""}`}</span>
        </span>
        <span className="hidden -space-x-2 sm:flex">
          {sorted.slice(0, 4).map((r) => <span key={r.user_id} className="rounded-full ring-2 ring-slate-900"><Face p={byId.get(r.user_id)} size={7} /></span>)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out-quint motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="border-t border-slate-700 p-4">
            <p className="text-sm leading-relaxed text-slate-400">
              Only the media head can assign tasks, along with the super admin. The media head can make some people assistants, and an assistant can assign tasks on the head&rsquo;s behalf. {manage ? "You can add or remove assistants below." : "Everyone else sees just their own list here."}
            </p>

            {rows === null ? <div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-800" aria-hidden="true" /> : (
              <ul className="mt-4 space-y-1.5">
                {sorted.map((r, i) => {
                  const b = BADGE[r.role];
                  return (
                    <li key={r.user_id} className="tk-rise flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                      <Face p={byId.get(r.user_id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{nameOf(byId.get(r.user_id))}{r.user_id === me && <span className="ml-2 text-xs font-normal text-slate-500">you</span>}</span>
                        <span className="block truncate text-xs text-slate-500">{byId.get(r.user_id)?.email}</span>
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${b.cls}`}><b.Icon className="h-3 w-3" aria-hidden="true" /> {b.label}</span>
                      {manage && r.role === "media_assistant" && (
                        <button type="button" onClick={() => remove(r.user_id)} disabled={busy === r.user_id} aria-label={`Remove ${nameOf(byId.get(r.user_id))} as assistant`} title="Remove as assistant" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-[#f87171] disabled:opacity-50"><UserMinus className="h-4 w-4" aria-hidden="true" /></button>
                      )}
                    </li>
                  );
                })}
                {!hasHead && <li className="px-1 pt-1 text-xs text-slate-500">The super admin picks the media head from the Media team page.</li>}
              </ul>
            )}

            {manage && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-3 sm:p-4">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold text-white">Add an assistant</h3>
                  <span className="font-mono text-xs text-slate-500">{q ? `${matches.length} of ${options.length}` : `${options.length}`} {options.length === 1 ? "account" : "accounts"}</span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input
                    type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search people by name" aria-label="Search people by name"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) setPick(matches[0].id); } }}
                    className="h-11 w-full rounded-xl border border-slate-600 bg-slate-950 pl-10 pr-4 text-sm text-white outline-none! transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent"
                  />
                </div>
                <ul className="mt-2 max-h-60 space-y-0.5 overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-950/50 p-1.5" aria-label="Accounts">
                  {matches.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">{options.length === 0 ? "Everyone is already on the list." : `No one matches “${find.trim()}”.`}</li>}
                  {matches.map((p) => {
                    const on = p.id === pick;
                    return (
                      <li key={p.id}>
                        <button type="button" aria-pressed={on} onClick={() => setPick(on ? "" : p.id)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${on ? "bg-accent/[.1]" : "hover:bg-slate-800/70"}`}>
                          <Face p={p} size={7} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white">{nameOf(p)}</span>
                            {p.full_name && <span className="block truncate text-xs text-slate-500">{p.email}</span>}
                          </span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${on ? "border-accent bg-accent text-accent-ink" : "border-slate-600 text-transparent"}`}><Check className="h-3 w-3" aria-hidden="true" /></span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 truncate text-sm text-slate-400" aria-live="polite">
                    {picked ? <>Selected: <span className="font-medium text-white">{nameOf(picked)}</span> <button type="button" onClick={() => setPick("")} aria-label="Clear selection" className="ml-1 inline-grid h-5 w-5 place-items-center rounded-md align-middle text-slate-500 hover:bg-slate-800 hover:text-white"><X className="h-3 w-3" aria-hidden="true" /></button></> : "Pick a person from the list."}
                  </p>
                  <button type="button" onClick={add} disabled={!pick || busy === "add"} className="btn btn-primary shrink-0 disabled:opacity-50">
                    {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />} Add assistant
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
