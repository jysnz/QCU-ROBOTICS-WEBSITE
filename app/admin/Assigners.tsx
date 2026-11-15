"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Clock, Crown, Loader2, Search, ShieldCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { notify } from "./notify";
import { adminFetch, sb } from "./supabase";
import { markHeadPosition } from "./MediaHeadMenu";
import { isHead, type AdminRole } from "./useAdminRole";

type Person = { id: string; email: string; full_name: string | null; avatar_url: string | null };
type RoleName = "super_admin" | "media_head" | "media_assistant";
type RoleRow = { user_id: string; role: RoleName };
/** Someone who can be named: an admin account and/or a /member-reg registration, joined by email. No accountId = no account yet. */
type Cand = { email: string; name: string; avatar_url: string | null; accountId: string | null; approved: boolean; registered: boolean };
/** A role saved for an email that has no account yet; it is handed over when the account is created. */
type Pending = { email: string; full_name: string | null; role: "media_head" | "media_assistant" };

const nameOf = (p?: { full_name?: string | null; name?: string; email?: string }) => p?.full_name || p?.name || p?.email || "Someone";
const initial = (s: string) => (/[\p{L}\p{N}]/u.exec(s)?.[0] ?? "?").toUpperCase();
const ORDER = { super_admin: 0, media_head: 1, media_assistant: 2 } as const;
const BADGE = {
  super_admin: { label: "Super admin", cls: "border-accent/40 bg-accent/10 text-accent", Icon: ShieldCheck },
  media_head: { label: "Media head", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300", Icon: Crown },
  media_assistant: { label: "Assistant", cls: "border-sky-400/40 bg-sky-400/10 text-sky-300", Icon: Users },
} as const;
const MODES = {
  media_assistant: { label: "Assistant", Icon: Users, hint: "Can assign tasks on the media head’s behalf.", action: "Add assistant" },
  media_head: { label: "Media head", Icon: Crown, hint: "Hands out the competition tasks to the media team. Replaces the current media head.", action: "Make media head" },
} as const;

function Face({ name, src, size = 9 }: { name: string; src?: string | null; size?: 7 | 9 }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-slate-600 bg-slate-800 font-display font-semibold text-slate-300 ${size === 9 ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs"}`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : initial(name)}
    </span>
  );
}

/* Who hands out tasks, shown on the Assign and To do pages. The super admin names the media head; the media head (and the
   super admin) name assistants. Both are picked from everyone who registered at /member-reg, whether or not they have an account:
   someone without an account gets the role the moment they create one with the same email (supabase/pending-roles.sql). */
export default function Assigners({ role }: { role: AdminRole | undefined }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RoleRow[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [cands, setCands] = useState<Cand[]>([]);
  const [me, setMe] = useState("");
  const [modeSel, setMode] = useState<"media_assistant" | "media_head">("media_assistant");
  const [pick, setPick] = useState("");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const manage = isHead(role);

  const load = useCallback(async () => {
    const { data } = await sb.from("admin_roles").select("user_id, role");
    setRows((data ?? []) as RoleRow[]);
  }, []);
  const loadPending = useCallback(async () => {
    const { data } = await sb.schema("public").rpc("list_pending_roles");
    setPending(((data ?? []) as Pending[]));
  }, []);
  const loadCands = useCallback(async () => {
    const b = await adminFetch<{ people: Cand[] }>("/api/admin/role-candidates").catch(() => null);
    if (b) setCands(b.people);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    adminFetch<{ people: Person[]; me: string }>("/api/admin/people").then((b) => { setPeople(b.people); setMe(b.me); }).catch(() => {});
  }, [load]);
  useEffect(() => {
    if (!manage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPending(); loadCands();
  }, [manage, loadPending, loadCands]);

  // name + photo by account id, from whichever list knows the person
  const face = useMemo(() => {
    const m = new Map<string, { name: string; email: string; avatar_url: string | null }>();
    for (const p of people) m.set(p.id, { name: nameOf(p), email: p.email, avatar_url: p.avatar_url });
    for (const c of cands) if (c.accountId) m.set(c.accountId, { name: c.name, email: c.email, avatar_url: c.avatar_url });
    return m;
  }, [people, cands]);
  const sorted = useMemo(() => [...(rows ?? [])].sort((a, b) => ORDER[a.role] - ORDER[b.role]), [rows]);
  const waiting = useMemo(() => [...pending].sort((a, b) => (a.role === b.role ? 0 : a.role === "media_head" ? -1 : 1)), [pending]);
  // One media head at a time (one who has no account yet counts). The super admin can name a head only when there isn't one (remove the
  // current head first to change it); the media head herself can hand the role over, and stops being head.
  const headExists = sorted.some((r) => r.role === "media_head") || waiting.some((p) => p.role === "media_head");
  const canNameHead = (role === "super_admin" && !headExists) || role === "media_head";
  const mode = canNameHead ? modeSel : "media_assistant";
  const roleOf = useMemo(() => new Map((rows ?? []).map((r) => [r.user_id, r.role])), [rows]);
  const waitingRole = useMemo(() => new Map(pending.map((p) => [p.email.toLowerCase(), p.role])), [pending]);
  // Who can be picked. Adding an assistant: nobody who already has a role (super admin, media head, assistant) or is waiting for one.
  // Naming the media head: not the super admin, the current head, or someone already waiting to be head (an assistant can move up).
  const options = useMemo(() => cands.filter((c) => {
    const have = c.accountId ? roleOf.get(c.accountId) : undefined;
    const wait = waitingRole.get(c.email.toLowerCase());
    return mode === "media_assistant" ? !have && !wait : have !== "super_admin" && have !== "media_head" && wait !== "media_head";
  }), [cands, roleOf, waitingRole, mode]);
  const q = find.trim().toLowerCase();
  const matches = useMemo(() => (q ? options.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q)) : options), [options, q]);
  const picked = options.find((c) => c.email === pick); // only someone still on the list can be picked (switching the role may remove them)
  const assistants = sorted.filter((r) => r.role === "media_assistant").length;
  const hasHead = sorted.some((r) => r.role === "media_head");
  const m = mode === "media_head"
    ? role === "media_head"
      ? { ...MODES.media_head, hint: "Takes over as media head, and you stop being media head.", action: "Transfer media head" }
      : { ...MODES.media_head, hint: "Becomes the media head. There is none right now; to change it later, remove them first." }
    : MODES.media_assistant;

  const rpcError = (e: { message: string }) => /could not find the function|assign_role_by_email|list_pending_roles/i.test(e.message)
    ? "The database isn't set up for this yet. Run supabase/pending-roles.sql in the Supabase SQL editor first."
    : e.message;

  async function add() {
    if (!picked) return;
    setBusy("add");
    // A media head is tied to their Media team entry (matched by name), so their card there shows "Media head"
    let teamId: number | null = null;
    if (mode === "media_head") {
      const { data: mt } = await sb.from("media_team").select("id, name");
      teamId = (mt ?? []).find((r) => String(r.name ?? "").trim().toLowerCase() === picked.name.trim().toLowerCase())?.id ?? null;
    }
    // Someone who already has an account gets the role the way it always worked (no extra database setup needed);
    // someone without one is saved against their email by assign_role_by_email (supabase/pending-roles.sql).
    const { data, error } = picked.accountId
      ? mode === "media_head"
        ? await sb.schema("public").rpc("set_media_head", { uid: picked.accountId, member: teamId })
        : await sb.from("admin_roles").insert({ user_id: picked.accountId, role: "media_assistant", granted_by: me || null })
      : await sb.schema("public").rpc("assign_role_by_email", { p_email: picked.email, p_role: mode, p_name: picked.name, p_media_team: teamId });
    setBusy(null);
    if (error) { notify.error(mode === "media_head" ? "Couldn't assign the media head." : "Couldn't add the assistant.", { description: rpcError(error) }); return; }
    if (mode === "media_head" && teamId !== null) await markHeadPosition(teamId);
    const later = !picked.accountId || (data as unknown) === "pending";
    notify.created(picked.name, {
      description: later
        ? `Gets the ${mode === "media_head" ? "media head" : "assistant"} role as soon as they create an account with ${picked.email}.`
        : mode === "media_head" ? "Is now the media head." : "Can now assign tasks on the media head's behalf.",
    });
    setPick(""); setFind("");
    load(); loadPending(); loadCands();
  }
  async function removeRole(r: RoleRow) {
    setBusy(r.user_id);
    const label = nameOf(face.get(r.user_id));
    const { error } = r.role === "media_head"
      ? await sb.schema("public").rpc("clear_media_head")
      : await sb.from("admin_roles").delete().eq("user_id", r.user_id).eq("role", "media_assistant");
    setBusy(null);
    if (error) { notify.error(r.role === "media_head" ? "Couldn't remove the media head." : "Couldn't remove the assistant.", { description: error.message }); return; }
    if (r.role === "media_head") await markHeadPosition(null);
    notify.deleted(`${label} is no longer ${r.role === "media_head" ? "the media head" : "an assistant"}`);
    load(); loadCands();
  }
  async function removePending(p: Pending) {
    setBusy(p.email);
    const { error } = await sb.schema("public").rpc("clear_pending_role", { p_email: p.email });
    setBusy(null);
    if (error) { notify.error("Couldn't cancel that.", { description: rpcError(error) }); return; }
    if (p.role === "media_head") await markHeadPosition(null);
    notify.deleted(`${nameOf({ full_name: p.full_name, email: p.email })} won't get a role`);
    loadPending(); loadCands();
  }

  const summary = rows === null ? "Loading…" : `${hasHead ? "Media head" : waiting.some((p) => p.role === "media_head") ? "Media head waiting for an account" : "No media head yet"}${assistants ? ` + ${assistants} ${assistants === 1 ? "assistant" : "assistants"}` : ""}${pending.some((p) => p.role !== "media_head") ? ` · ${pending.filter((p) => p.role !== "media_head").length} waiting for an account` : ""}`;

  return (
    <section aria-label="Who can assign tasks" className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/60">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Users className="h-4 w-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">Who can assign tasks</span>
          <span className="block truncate text-xs text-slate-400">{summary}</span>
        </span>
        <span className="hidden -space-x-2 sm:flex">
          {sorted.slice(0, 4).map((r) => { const f = face.get(r.user_id); return <span key={r.user_id} className="rounded-full ring-2 ring-slate-900"><Face name={f?.name ?? "?"} src={f?.avatar_url} size={7} /></span>; })}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out-quint motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="border-t border-slate-700 p-4">
            <p className="text-sm leading-relaxed text-slate-400">
              Only the media head can assign tasks, along with the super admin. The media head can make some people assistants, and an assistant can assign tasks on the head&rsquo;s behalf.{" "}
              {manage ? `You can add or remove ${canNameHead ? "the media head and " : ""}assistants below, even for people who haven't made an account yet.` : "Everyone else sees just their own list here."}
            </p>

            {rows === null ? <div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-800" aria-hidden="true" /> : (
              <ul className="mt-4 space-y-1.5">
                {sorted.map((r, i) => {
                  const b = BADGE[r.role];
                  const f = face.get(r.user_id);
                  const canRemove = manage && (r.role === "media_assistant" || (r.role === "media_head" && role === "super_admin"));
                  return (
                    <li key={r.user_id} className="tk-rise flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                      <Face name={f?.name ?? "?"} src={f?.avatar_url} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{f?.name ?? "Someone"}{r.user_id === me && <span className="ml-2 text-xs font-normal text-slate-500">you</span>}</span>
                        <span className="block truncate text-xs text-slate-500">{f?.email}</span>
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${b.cls}`}><b.Icon className="h-3 w-3" aria-hidden="true" /> {b.label}</span>
                      {canRemove && (
                        <button type="button" onClick={() => removeRole(r)} disabled={busy === r.user_id} aria-label={`Remove ${f?.name ?? "this person"} as ${r.role === "media_head" ? "media head" : "assistant"}`} title={r.role === "media_head" ? "Remove as media head" : "Remove as assistant"} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-[#f87171] disabled:opacity-50"><UserMinus className="h-4 w-4" aria-hidden="true" /></button>
                      )}
                    </li>
                  );
                })}
                {manage && waiting.map((p) => {
                  const b = BADGE[p.role];
                  const name = nameOf({ full_name: p.full_name, email: p.email });
                  return (
                    <li key={p.email} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-950/30 px-3 py-2.5">
                      <Face name={name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{name}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-slate-500"><Clock className="h-3 w-3 shrink-0" aria-hidden="true" /> Waiting for them to create an account with {p.email}</span>
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${b.cls}`}><b.Icon className="h-3 w-3" aria-hidden="true" /> {b.label}</span>
                      {(p.role === "media_assistant" || role === "super_admin") && (
                        <button type="button" onClick={() => removePending(p)} disabled={busy === p.email} aria-label={`Cancel ${name}'s role`} title="Cancel" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-[#f87171] disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" /></button>
                      )}
                    </li>
                  );
                })}
                {!headExists && <li className="px-1 pt-1 text-xs text-slate-500">{role === "super_admin" ? "Choose a media head below." : "The super admin chooses the media head."}</li>}
                {headExists && role === "super_admin" && <li className="px-1 pt-1 text-xs text-slate-500">To choose a different media head, remove the current one first.</li>}
              </ul>
            )}

            {manage && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/40 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold text-white">Add someone</h3>
                  {canNameHead && (
                    <div role="group" aria-label="Role to give" className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                      {(Object.keys(MODES) as (keyof typeof MODES)[]).map((k) => {
                        const on = mode === k, M = MODES[k];
                        return (
                          <button key={k} type="button" aria-pressed={on} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${on ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}>
                            <M.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {M.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="mb-3 text-xs leading-relaxed text-slate-400">{m.hint} Pick anyone who registered at the member page; if they have no account yet, they get the role as soon as they create one with the same email.</p>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input
                    type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search by name or email" aria-label="Search people by name or email"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) setPick(matches[0].email); } }}
                    className="h-11 w-full rounded-xl border border-slate-600 bg-slate-950 pl-10 pr-4 text-sm text-white outline-none! transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent"
                  />
                </div>
                <div className="mt-1.5 flex justify-end">
                  <span className="font-mono text-xs text-slate-500">{q ? `${matches.length} of ${options.length}` : `${options.length}`} {options.length === 1 ? "person" : "people"}</span>
                </div>
                <ul className="mt-1 max-h-64 space-y-0.5 overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-950/50 p-1.5" aria-label="People">
                  {matches.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">{options.length === 0 ? "Everyone is already on the list." : `No one matches “${find.trim()}”.`}</li>}
                  {matches.map((c) => {
                    const on = c.email === pick;
                    const state = !c.accountId ? "No account yet" : c.approved ? "Has an account" : "Waiting for approval";
                    return (
                      <li key={c.email}>
                        <button type="button" aria-pressed={on} onClick={() => setPick(on ? "" : c.email)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${on ? "bg-accent/[.1]" : "hover:bg-slate-800/70"}`}>
                          <Face name={c.name} src={c.avatar_url} size={7} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-white">{c.name}</span>
                            <span className="block truncate text-xs text-slate-500">{c.email}</span>
                          </span>
                          <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[.68rem] sm:inline ${c.accountId && c.approved ? "border-accent/30 text-accent" : "border-slate-600 text-slate-400"}`}>{state}</span>
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${on ? "border-accent bg-accent text-accent-ink" : "border-slate-600 text-transparent"}`}><Check className="h-3 w-3" aria-hidden="true" /></span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 truncate text-sm text-slate-400" aria-live="polite">
                    {picked ? <>Selected: <span className="font-medium text-white">{picked.name}</span> <button type="button" onClick={() => setPick("")} aria-label="Clear selection" className="ml-1 inline-grid h-5 w-5 place-items-center rounded-md align-middle text-slate-500 hover:bg-slate-800 hover:text-white"><X className="h-3 w-3" aria-hidden="true" /></button></> : "Pick a person from the list."}
                  </p>
                  <button type="button" onClick={add} disabled={!picked || busy === "add"} className="btn btn-primary shrink-0 disabled:opacity-50">
                    {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />} {m.action}
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
