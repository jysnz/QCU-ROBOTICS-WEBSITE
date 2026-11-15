"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import NumberFlow from "@number-flow/react";
import { notify } from "./notify";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ImageOff, Inbox, Loader2, RotateCcw, Search, Trash2, X } from "lucide-react";
import { adminFetch } from "./supabase";
import { announceReviewChange } from "./useReviewCounts";
import { bustContent } from "./cache";

type Registration = {
  id: number;
  name: string;
  gender: string | null;
  birthday: string | null;
  email: string | null;
  student_id: string | null;
  program: string | null;
  year_level: string | null;
  section: string | null;
  hobbies: string[] | null;
  likes: string[] | null;
  about: string | null;
  registration_status: string | null;
  role: string;
  roles?: string[];
  is_accepted: boolean;
  submitted_at: string | null;
  rejected_at?: string | null;
  photos: string[];
};

const rolesOf = (r: { role: string; roles?: string[] }) => (r.roles?.length ? r.roles : [r.role]); // everything they signed up as
const ROLE_LABEL: Record<string, string> = { member: "Member", media: "Media team", player: "Player" };
const ROLE_TONE: Record<string, string> = { member: "text-accent border-accent/40", media: "text-violet-300 border-violet-400/40", player: "text-sky-300 border-sky-400/40" };
const PROGRAM_SHORT = (p: string | null) => (p ?? "").replace(/^Bachelor of (Science in|Early)\s*/i, "").trim();

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string | null) {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  const units: [number, Intl.RelativeTimeFormatUnit][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"], [2629800, "month"], [31557600, "year"]];
  let i = 0;
  while (i < units.length - 1 && abs >= units[i + 1][0]) i++;
  return rtf.format(Math.round(diff / units[i][0]), units[i][1]);
}

const ARCHIVE_DAYS = 30;
const daysLeft = (iso?: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() + ARCHIVE_DAYS * 86_400_000 - Date.now()) / 86_400_000)) : ARCHIVE_DAYS);

const chip = "rounded-md border border-slate-600 px-2 py-0.5 text-[.72rem] text-slate-300";

/* What the person is registered as. Pick one or more, then Save: this decides where they show up (Members, Media team, and the player picker). */
function RoleEditor({ r, onSave }: { r: Registration; onSave: (roles: string[]) => Promise<boolean> }) {
  const current = rolesOf(r);
  const key = current.join(",");
  const [sel, setSel] = useState<string[]>(current);
  const [seen, setSeen] = useState(key);
  const [saving, setSaving] = useState(false);
  if (seen !== key) { setSeen(key); setSel(current); } // follow the saved value after it changes
  const same = sel.length === current.length && sel.every((k) => current.includes(k));
  const toggle = (k: string) => setSel((v) => (v.includes(k) ? (v.length > 1 ? v.filter((x) => x !== k) : v) : [...v, k])); // at least one stays picked
  async function save() { setSaving(true); await onSave(sel); setSaving(false); }
  return (
    <div className="mb-5">
      <p className="font-mono text-[.66rem] uppercase tracking-[.14em] text-slate-500" id={`ra-${r.id}`}>Registered as</p>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-labelledby={`ra-${r.id}`}>
        {Object.keys(ROLE_LABEL).map((k) => {
          const on = sel.includes(k);
          return (
            <button key={k} type="button" aria-pressed={on} disabled={saving} onClick={() => toggle(k)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-60 ${on ? `${ROLE_TONE[k]} bg-white/5` : "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white"}`}>
              {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />} {ROLE_LABEL[k]}
            </button>
          );
        })}
        {!same && (
          <span className="ml-1 inline-flex items-center gap-2">
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary btn-sm disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save</button>
            <button type="button" onClick={() => setSel(current)} disabled={saving} className="btn btn-ghost btn-sm">Undo</button>
          </span>
        )}
      </div>
    </div>
  );
}

function Details({ r, onOpenPhoto, onRoles }: { r: Registration; onOpenPhoto: (i: number) => void; onRoles?: (roles: string[]) => Promise<boolean> }) {
  const rows: [string, string | null | undefined][] = [
    ["Email", r.email], ["Student ID", r.student_id], ["Program", r.program],
    ["Year / section", [r.year_level, r.section].filter(Boolean).join(" · ")],
    ["Gender", r.gender], ["Birthday", r.birthday],
  ];
  return (
    <div className="grid gap-6 border-t border-slate-700 p-5 md:grid-cols-[auto_1fr]">
      <div>
        {r.photos.length === 0 ? (
          <div className="grid h-32 w-32 place-items-center rounded-xl border border-slate-600 bg-slate-800 text-slate-500"><ImageOff className="h-6 w-6" aria-hidden="true" /></div>
        ) : (
          <ul className="grid grid-cols-3 gap-2 md:w-[17rem]">
            {r.photos.map((src, i) => (
              <li key={src}>
                <button type="button" onClick={() => onOpenPhoto(i)} aria-label={`Open photo ${i + 1} of ${r.photos.length}`} className="group block aspect-square w-full overflow-hidden rounded-xl border border-slate-600 bg-slate-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0">
        {onRoles && <RoleEditor r={r} onSave={onRoles} />}
        <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => v ? (
            <div key={k} className="min-w-0"><dt className="font-mono text-[.66rem] uppercase tracking-[.14em] text-slate-500">{k}</dt><dd className="mt-0.5 break-words text-slate-200">{v}</dd></div>
          ) : null)}
        </dl>
        {r.about && <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm leading-relaxed text-slate-300">{r.about}</p>}
        {(r.hobbies?.length || r.likes?.length) ? (
          <div className="mt-4 space-y-2">
            {r.hobbies?.length ? <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-xs text-slate-500">Hobbies</span>{r.hobbies.map((h) => <span key={h} className={chip}>{h}</span>)}</div> : null}
            {r.likes?.length ? <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-xs text-slate-500">Likes</span>{r.likes.map((h) => <span key={h} className={chip}>{h}</span>)}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RegCard({
  r, open, leaving, busy, status, delay, onToggle, onApprove, onReject, onRestore, onOpenPhoto, onRoles,
}: {
  delay: number;
  r: Registration; open: boolean; leaving: boolean; busy: boolean; status: string | null;
  onToggle: () => void; onApprove: () => void; onReject: () => void; onRestore: () => void; onOpenPhoto: (i: number) => void;
  onRoles: (roles: string[]) => Promise<boolean>; // not offered for a rejected registration
}) {
  return (
    // the grid-rows trick collapses the card smoothly when it is decided (leaving) and again when it is opened/closed
    <li style={{ animation: "rise .5s var(--ease) both", animationDelay: `${delay}ms` }} className={`grid transition-[grid-template-rows,opacity] duration-[380ms] ease-out-quint ${leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="min-h-0 overflow-hidden">
        <article className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 transition-colors duration-200 hover:border-slate-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
            <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-4 text-left outline-none focus-visible:[&_.nm]:text-accent">
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-600 bg-slate-800">
                {r.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center font-display text-lg font-semibold text-slate-400">{(r.name.trim()[0] ?? "?").toUpperCase()}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="nm truncate font-display text-base font-semibold text-white transition-colors">{r.name}</span>
                  {rolesOf(r).map((k) => <span key={k} className={`rounded-md border px-2 py-0.5 font-mono text-[.64rem] uppercase tracking-[.14em] ${ROLE_TONE[k] ?? "text-slate-300 border-slate-600"}`}>{ROLE_LABEL[k] ?? k}</span>)}
                </span>
                <span className="mt-1 block truncate text-xs text-slate-400">
                  {[PROGRAM_SHORT(r.program), r.year_level, r.student_id].filter(Boolean).join(" · ") || r.email}
                </span>
                {r.submitted_at && <span className="mt-0.5 block font-mono text-[.68rem] text-slate-500" title={new Date(r.submitted_at).toLocaleString()}>{ago(r.submitted_at)}</span>}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out-quint ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {status === "pending" ? (
              <div className="flex w-full shrink-0 gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                <button type="button" disabled={busy} onClick={onReject} className="btn btn-ghost btn-sm disabled:opacity-60"><Trash2 className="h-4 w-4" aria-hidden="true" /> Reject</button>
                <button type="button" disabled={busy} onClick={onApprove} className="btn btn-primary btn-sm disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Approve
                </button>
              </div>
            ) : status === "rejected" ? (
              <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
                <span className="font-mono text-[.68rem] text-slate-400">Deleted in {daysLeft(r.rejected_at)} {daysLeft(r.rejected_at) === 1 ? "day" : "days"}</span>
                <button type="button" disabled={busy} onClick={onRestore} className="btn btn-ghost btn-sm disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />} Restore
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent"><Check className="h-4 w-4" aria-hidden="true" /> Approved</span>
            )}
          </div>

          <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={!open}>
            <div className="min-h-0 overflow-hidden"><Details r={r} onOpenPhoto={onOpenPhoto} onRoles={status === "rejected" ? undefined : onRoles} /></div>
          </div>
        </article>
      </div>
    </li>
  );
}

export default function Registrations() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "archived">("pending");
  const [role, setRole] = useState<"all" | "member" | "media" | "player">("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<Registration | null>(null);
  const [photoView, setPhotoView] = useState<{ photos: string[]; i: number; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const body = await adminFetch<{ registrations: Registration[] }>("/api/admin/registrations");
      setRows(body.registrations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load registrations.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function changeRoles(row: Registration, roles: string[]) {
    try {
      const res = await adminFetch<{ role: string; roles: string[] }>("/api/admin/registrations", { method: "PATCH", body: JSON.stringify({ id: row.id, action: "roles", roles }) });
      setRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, role: res.role, roles: res.roles } : x)));
      bustContent(); // Members, Media team and Informations reload fresh
      notify.updated(`${row.name}'s roles updated`, { description: res.roles.map((k) => ROLE_LABEL[k] ?? k).join(" · ") });
      return true;
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Couldn't change the roles.");
      return false;
    }
  }

  async function decide(row: Registration, action: "approve" | "reject" | "restore") {
    setBusy(row.id);
    try {
      await adminFetch("/api/admin/registrations", { method: "PATCH", body: JSON.stringify({ id: row.id, action }) });
      announceReviewChange();
      bustContent(); // Members, Media team, Informations and the Overview numbers reload fresh instead of showing a minute-old list
      if (action === "approve") notify.updated(`${row.name} approved`, { description: "They now appear on the site." });
      else if (action === "restore") notify.updated(`${row.name} restored`, { description: "Back in Needs review." });
      else notify.deleted(`${row.name}'s registration rejected`, { description: `Moved to the archive. It's deleted permanently after ${ARCHIVE_DAYS} days.` });
      // collapse the card first, then update the list so the rows below slide up instead of jumping
      setLeaving((s) => new Set(s).add(row.id));
      setTimeout(() => {
        setRows((prev) => prev.map((x) => x.id !== row.id ? x
          : action === "approve" ? { ...x, registration_status: "approved", is_accepted: true }
          : action === "reject" ? { ...x, registration_status: "rejected", is_accepted: false, rejected_at: new Date().toISOString() }
          : { ...x, registration_status: "pending", is_accepted: false, rejected_at: null }));
        setLeaving((s) => { const n = new Set(s); n.delete(row.id); return n; });
        setOpenId((o) => (o === row.id ? null : o));
      }, 380);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "That didn't work.");
    }
    setBusy(null);
  }

  const pendingAll = useMemo(() => rows.filter((r) => r.registration_status === "pending"), [rows]);
  const reviewedAll = useMemo(() => rows.filter((r) => r.registration_status !== "pending" && r.registration_status !== "rejected"), [rows]);
  const archivedAll = useMemo(() => rows.filter((r) => r.registration_status === "rejected"), [rows]);
  const base = tab === "pending" ? pendingAll : tab === "approved" ? reviewedAll : archivedAll;

  const roleCount = (k: string) => base.filter((r) => k === "all" || rolesOf(r).includes(k)).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((r) =>
      (role === "all" || rolesOf(r).includes(role)) &&
      (!q || [r.name, r.email, r.student_id, r.program].some((v) => (v ?? "").toLowerCase().includes(q))),
    );
  }, [base, role, query]);

  const roleTabs = [["all", "All"], ["member", "Members"], ["media", "Media"], ["player", "Players"]] as const;

  return (
    <section aria-labelledby="panel-title">
      <div className="mb-6 flex flex-col gap-5 sm:mb-8 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h1 id="panel-title" className="font-display text-2xl font-bold sm:text-3xl tracking-[-0.03em] text-white">Registrations</h1>
          <p className="mt-2 text-slate-400">
            Sign-ups from the public <span className="text-slate-200">/member-reg</span> form. Approving puts the person on the site with their name and photo only. Their details stay private to this page.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:flex">
          <div className="min-w-24 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <dt className="text-xs text-slate-400">Waiting</dt>
            <dd className="font-display text-2xl font-bold tabular-nums text-white"><NumberFlow value={pendingAll.length} /></dd>
          </div>
          <div className="min-w-24 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
            <dt className="text-xs text-slate-400">Approved</dt>
            <dd className="font-display text-2xl font-bold tabular-nums text-white"><NumberFlow value={reviewedAll.length} /></dd>
          </div>
        </dl>
      </div>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-600 bg-slate-900 p-1 sm:inline-flex sm:w-fit" role="tablist" aria-label="Registration status">
          {(["pending", "approved", "archived"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={tab === f}
              onClick={() => { setTab(f); setOpenId(null); }}
              className={`relative h-11 rounded-lg px-3 text-sm font-semibold sm:h-10 sm:px-5 transition-colors duration-200 ${tab === f ? "bg-accent text-accent-ink" : "text-slate-300 hover:text-white"}`}
            >
              {f === "pending" ? "Needs review" : f === "approved" ? "Approved" : "Archive"}
              <span className={`ml-2 font-mono text-xs ${tab === f ? "text-accent-ink/70" : "text-slate-500"}`}>{f === "pending" ? pendingAll.length : f === "approved" ? reviewedAll.length : archivedAll.length}</span>
            </button>
          ))}
        </div>

        <label className="relative block w-full lg:w-72">
          <span className="sr-only">Search registrations</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, student ID" className="h-11 w-full rounded-xl border border-slate-600 bg-slate-900 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent" />
        </label>
      </div>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [scrollbar-width:none]" role="group" aria-label="Filter by role">
        {roleTabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={role === k}
            onClick={() => setRole(k)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors duration-150 sm:py-1.5 ${role === k ? "border-accent bg-accent/10 text-accent" : "border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white"}`}
          >
            {label} <span className="ml-1 font-mono text-xs opacity-70">{roleCount(k)}</span>
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <div className="h-14 w-14 rounded-xl bg-slate-800" />
              <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-slate-800" /><div className="h-3 w-1/2 rounded bg-slate-800" /></div>
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-slate-600 px-6 py-16 text-center">
          <Inbox className="h-8 w-8 text-slate-500" aria-hidden="true" />
          <p className="mt-4 font-medium text-white">
            {query || role !== "all" ? "No registrations match your filters" : tab === "pending" ? "You're all caught up" : tab === "approved" ? "Nothing approved yet" : "The archive is empty"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">
            {query || role !== "all" ? "Try a different search or role." : tab === "pending" ? "New sign-ups from /member-reg will show up here for review." : tab === "approved" ? "Approved registrations are listed here." : `Rejected registrations are kept here for ${ARCHIVE_DAYS} days, then deleted permanently.`}
          </p>
          {(query || role !== "all") && <button type="button" onClick={() => { setQuery(""); setRole("all"); }} className="btn btn-ghost btn-sm mt-5">Clear filters</button>}
        </div>
      ) : (
        <ul className="space-y-3" key={`${tab}-${role}`}>
          {shown.map((r, i) => (
            <RegCard
                key={r.id}
                delay={Math.min(i, 8) * 45}
                r={r}
                open={openId === r.id}
                leaving={leaving.has(r.id)}
                busy={busy === r.id}
                status={r.registration_status}
                onToggle={() => setOpenId((o) => (o === r.id ? null : r.id))}
                onApprove={() => decide(r, "approve")}
                onReject={() => setConfirm(r)}
                onRestore={() => decide(r, "restore")}
                onRoles={(roles) => changeRoles(r, roles)}
                onOpenPhoto={(idx) => setPhotoView({ photos: r.photos, i: idx, name: r.name })}
              />
          ))}
        </ul>
      )}

      {/* Reject confirmation */}
      <Dialog.Root open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <Dialog.Title className="font-display text-xl font-semibold text-white">Reject this registration?</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-slate-400">
                <span className="text-white">{confirm?.name}</span>&rsquo;s registration will move to the archive and be permanently deleted, with its photos, after 30 days. You can restore it until then.
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <Dialog.Close className="btn btn-ghost">Cancel</Dialog.Close>
                <button type="button" onClick={() => { const r = confirm; setConfirm(null); if (r) decide(r, "reject"); }} className="btn bg-[#ef4444] text-white hover:bg-[#f87171]">Reject</button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Photo viewer */}
      <Dialog.Root open={photoView !== null} onOpenChange={(o) => { if (!o) setPhotoView(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/85 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup
              className="relative w-full max-w-3xl outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
              onKeyDown={(e) => {
                if (!photoView) return;
                if (e.key === "ArrowRight") setPhotoView({ ...photoView, i: (photoView.i + 1) % photoView.photos.length });
                if (e.key === "ArrowLeft") setPhotoView({ ...photoView, i: (photoView.i - 1 + photoView.photos.length) % photoView.photos.length });
              }}
            >
              <Dialog.Title className="sr-only">{photoView?.name} photos</Dialog.Title>
              {photoView && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img key={photoView.i} src={photoView.photos[photoView.i]} alt={`${photoView.name}, photo ${photoView.i + 1}`} className="animate-fadeIn mx-auto max-h-[78vh] w-auto rounded-2xl border border-slate-600 object-contain" />
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button type="button" aria-label="Previous photo" onClick={() => setPhotoView({ ...photoView, i: (photoView.i - 1 + photoView.photos.length) % photoView.photos.length })} className="grid h-10 w-10 place-items-center rounded-full border border-slate-600 bg-slate-900 text-white hover:border-slate-500"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                    <span className="font-mono text-xs text-slate-300">{photoView.i + 1} / {photoView.photos.length}</span>
                    <button type="button" aria-label="Next photo" onClick={() => setPhotoView({ ...photoView, i: (photoView.i + 1) % photoView.photos.length })} className="grid h-10 w-10 place-items-center rounded-full border border-slate-600 bg-slate-900 text-white hover:border-slate-500"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                  <Dialog.Close aria-label="Close" className="absolute -top-2 right-0 grid h-10 w-10 -translate-y-full place-items-center rounded-full border border-slate-600 bg-slate-900 text-white hover:border-slate-500"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
                </>
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
