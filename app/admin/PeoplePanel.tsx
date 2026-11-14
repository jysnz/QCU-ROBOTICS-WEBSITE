"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import NumberFlow from "@number-flow/react";
import { Camera, Check, LayoutGrid, List, Loader2, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import Dropdown from "../components/Dropdown";
import { notify } from "./notify";
import PhotoDropzone from "./PhotoDropzone";
import { sb } from "./supabase";
import { AssignHeadDialog, clearMediaHead, HeadBadge, HeadMenu, useMediaHead } from "./MediaHeadMenu";
import { useAdminRole } from "./useAdminRole";

/* One manager for the three public rosters that share the same shape:
   media team (has a position), members and coaches. Grid or list view, sorting, bulk actions. */
type Kind = "media" | "members" | "coaches";
type Person = { id: number; name: string; position?: string | null; image_url: string | null; is_active: boolean | null };
type Sort = "name" | "name-desc" | "newest" | "active";

type Tone = { text: string; border: string; tint: string; chipOn: string; glow: string; bar: string };
const TONES: Record<"violet" | "lime" | "sky", Tone> = {
  violet: { text: "text-violet-300", border: "border-violet-400/40", tint: "bg-violet-400/10", chipOn: "border-violet-400 bg-violet-400/10 text-violet-300", glow: "bg-violet-500/20", bar: "bg-violet-400" },
  lime: { text: "text-accent", border: "border-accent/40", tint: "bg-accent/10", chipOn: "border-accent bg-accent/10 text-accent", glow: "bg-accent/15", bar: "bg-accent" },
  sky: { text: "text-sky-300", border: "border-sky-400/40", tint: "bg-sky-400/10", chipOn: "border-sky-400 bg-sky-400/10 text-sky-300", glow: "bg-sky-500/20", bar: "bg-sky-400" },
};

const KINDS: Record<Kind, {
  table: string; cols: string; label: string; singular: string; plural: string; desc: string; note?: string; position: boolean; folder: string;
  tone: keyof typeof TONES; role: string; shows: string; empty: string; suggest: string[];
}> = {
  media: {
    table: "media_team", cols: "id, name, position, image_url, is_active", label: "Media team", singular: "media team member", plural: "media team members",
    desc: "The photographers, videographers and editors shown in the Media team section of the site.", position: true, folder: "media_team",
    tone: "violet", role: "Media team", shows: "the Media team section", empty: "Add the first person to show them on the site.",
    suggest: ["Photographer", "Videographer", "Editor", "Graphic Designer", "Social Media", "Content Writer"],
  },
  members: {
    table: "members", cols: "id, name, image_url, is_active", label: "Members", singular: "member", plural: "members",
    desc: "Approved members shown in the Members section of the site.", position: false, folder: "members",
    note: "New sign-ups from /member-reg wait under Registrations until they're approved, then appear here.",
    tone: "lime", role: "Member", shows: "the Members section", empty: "Approved registrations appear here, or add someone yourself.", suggest: [],
  },
  coaches: {
    table: "Coaches", cols: "id, name, image_url, is_active", label: "Coaches", singular: "coach", plural: "coaches",
    desc: "The coaches and mentors shown in the Meet our coaches section of the site.", position: false, folder: "coaches",
    tone: "sky", role: "Team coach", shows: "the Coaches section", empty: "Add the first coach to show them on the site.", suggest: [],
  },
};

const PAGE = 24;
const input = "h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.18)] focus-visible:outline-none";
const lbl = "mb-2 block font-mono text-[.7rem] font-medium uppercase tracking-[.16em] text-slate-400";
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const switchRoot = "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-slate-600 bg-slate-800 outline-none transition-colors duration-200 focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.25)] data-[checked]:border-accent data-[checked]:bg-accent disabled:opacity-60";

function Photo({ m, className }: { m: Person; className: string }) {
  const [broken, setBroken] = useState(false);
  return m.image_url && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.image_url} alt="" loading="lazy" onError={() => setBroken(true)} className={className} />
  ) : (
    <span className="grid h-full w-full place-items-center font-display font-semibold text-slate-600" aria-hidden="true"><span className="text-[1.6em]">{initials(m.name)}</span></span>
  );
}

/* Tick box used on cards and rows. A real button so it works with the keyboard. */
function Tick({ on, label, onToggle, className = "" }: { on: boolean; label: string; onToggle: () => void; className?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`grid h-6 w-6 place-items-center rounded-md border outline-none transition-[background-color,border-color,opacity,transform] duration-150 focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.3)] ${on ? "border-accent bg-accent text-accent-ink" : "border-slate-500 bg-slate-950/70 text-transparent hover:border-white"} ${className}`}>
      <Check className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default function PeoplePanel({ kind, startNew = false }: { kind: Kind; startNew?: boolean }) {
  const cfg = KINDS[kind];
  const adminRole = useAdminRole();
  const sup = kind === "media" && adminRole === "super_admin"; // only the super admin can assign the media head
  const { head, reload: reloadHead } = useMediaHead(kind === "media");
  const [assigning, setAssigning] = useState<{ id: number; name: string } | null>(null);
  const tone = TONES[cfg.tone];
  const [rows, setRows] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [position, setPosition] = useState("all");
  const [sort, setSort] = useState<Sort>("name");
  const [view, setView] = useState<"grid" | "list">(() => {
    try { return localStorage.getItem("admin-people-view") === "list" ? "list" : "grid"; } catch { return "grid"; }
  });
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<Person | "new" | null>(startNew ? "new" : null);
  const [toDelete, setToDelete] = useState<Person[] | null>(null); // one person, or the whole selection
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    // Explicit columns: the database only lets the admin read some columns of the members table, so select("*") is refused.
    const { data, error: e } = await sb.from(cfg.table).select(cfg.cols).order("name").limit(3000);
    if (e) { setError(e.message); return; }
    setError("");
    setRows((data ?? []) as unknown as Person[]);
  }, [cfg]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const changeView = (v: "grid" | "list") => { setView(v); try { localStorage.setItem("admin-people-view", v); } catch { /* private window */ } };

  const positions = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) { const k = (r.position ?? "").trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (rows ?? []).filter((r) =>
      (status === "all" || (status === "active") === (r.is_active !== false)) &&
      (position === "all" || (r.position ?? "").trim() === position) &&
      (!q || `${r.name} ${r.position ?? ""}`.toLowerCase().includes(q)),
    );
    const byName = (a: Person, b: Person) => a.name.localeCompare(b.name);
    return list.sort(
      sort === "name-desc" ? (a, b) => byName(b, a)
      : sort === "newest" ? (a, b) => b.id - a.id
      : sort === "active" ? (a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || byName(a, b)
      : byName,
    );
  }, [rows, query, status, position, sort]);

  const shown = filtered.slice(0, limit);
  const total = rows?.length ?? 0;
  const activeCount = (rows ?? []).filter((r) => r.is_active !== false).length;
  const pct = total ? Math.round((activeCount / total) * 100) : 0;
  const selectedRows = (rows ?? []).filter((r) => selected.has(r.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const resetPaging = () => setLimit(PAGE);
  const toggleSel = (id: number) => setSelected((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });

  async function toggleActive(m: Person, next: boolean) {
    setToggling(m.id);
    setRows((prev) => prev && prev.map((r) => (r.id === m.id ? { ...r, is_active: next } : r))); // optimistic
    const { error: e } = await sb.from(cfg.table).update({ is_active: next }).eq("id", m.id);
    setToggling(null);
    if (e) { setRows((prev) => prev && prev.map((r) => (r.id === m.id ? { ...r, is_active: m.is_active } : r))); notify.error(`Couldn't update ${m.name}: ${e.message}`); return; }
    notify.updated(`${m.name} ${next ? "is now active" : "marked inactive"}`);
  }

  async function bulkActive(next: boolean) {
    const ids = selectedRows.map((r) => r.id);
    if (!ids.length || bulkBusy) return;
    setBulkBusy(true);
    const { error: e } = await sb.from(cfg.table).update({ is_active: next }).in("id", ids);
    setBulkBusy(false);
    if (e) { notify.error(`Couldn't update: ${e.message}`); return; }
    notify.updated(`${ids.length} ${ids.length === 1 ? cfg.singular : cfg.plural} ${next ? "activated" : "marked inactive"}`);
    setSelected(new Set());
    await load();
  }

  async function remove() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    const ids = toDelete.map((r) => r.id);
    const { error: e } = await sb.from(cfg.table).delete().in("id", ids);
    setDeleting(false);
    if (e) { notify.error(`Couldn't delete: ${e.message}`); setToDelete(null); return; }
    if (toDelete.length === 1) notify.deleted(`${cap(cfg.singular)} deleted`, { description: toDelete[0].name });
    else notify.deleted(`${toDelete.length} ${cfg.plural} deleted`);
    setToDelete(null);
    setSelected(new Set());
    await load();
  }

  const selecting = selected.size > 0;

  const inactiveCount = total - activeCount;
  const stack = (rows ?? []).filter((r) => r.image_url).slice(0, 5);

  return (
    <section aria-labelledby="panel-title" className={selecting ? "pb-24" : "pb-16"}>
      {/* ───── Header ───── */}
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/60 p-6 sm:p-8" style={{ animation: "rise .6s var(--ease) both" }}>
        <span className={`pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl ${tone.glow}`} aria-hidden="true" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className={`font-mono text-[.7rem] uppercase tracking-[.2em] ${tone.text}`}>Website roster</p>
            <h1 id="panel-title" className="mt-2 font-display text-4xl font-bold tracking-[-0.03em] text-white">{cfg.label}</h1>
            <p className="mt-3 text-slate-400">{cfg.desc}</p>
            {cfg.note && <p className="mt-2 text-sm text-slate-500">{cfg.note}</p>}
            {stack.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                <div className="flex -space-x-2.5" aria-hidden="true">
                  {stack.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={p.image_url!} alt="" loading="lazy" className="h-9 w-9 rounded-full border-2 border-slate-900 object-cover" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${i * 70 + 250}ms` }} />
                  ))}
                </div>
                {total > stack.length && <span className="text-sm text-slate-400">+{total - stack.length} more</span>}
              </div>
            )}
          </div>

          <div className="w-full max-w-md lg:w-[22rem]">
            <dl className="grid grid-cols-3 gap-3">
              {([["Total", total, "text-white"], ["Active", activeCount, tone.text], ["Inactive", inactiveCount, "text-slate-400"]] as const).map(([k, n, c]) => (
                <div key={k} className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className={`mt-1 font-display text-3xl font-bold leading-none tabular-nums ${c}`}><NumberFlow value={n} /></dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800" role="img" aria-label={`${pct}% of ${cfg.plural} are active`}>
                <div className={`h-full rounded-full transition-[width] duration-[900ms] ease-out-quint ${tone.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right text-xs text-slate-400"><span className="font-mono tabular-nums text-white">{pct}%</span> active</span>
            </div>
          </div>
        </div>
      </header>

      {/* ───── Toolbar (stays in view while you scroll) ───── */}
      <div className="sticky top-3 z-20 mb-4 rounded-2xl border border-slate-700 bg-slate-950/85 p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur" style={{ animation: "rise .6s var(--ease) both", animationDelay: "80ms" }}>
        <div className="grid gap-2 lg:grid-cols-[1fr_auto_13rem_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">Search {cfg.label.toLowerCase()}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); resetPaging(); }} placeholder={cfg.position ? "Search name or position" : "Search by name"} className="h-11 w-full rounded-xl bg-slate-900 pl-11 pr-4 text-sm font-medium text-white outline-none transition-shadow placeholder:text-slate-500 focus-visible:shadow-[0_0_0_2px_rgba(200,245,96,.5)]" />
          </label>
          <div className="relative inline-flex w-fit gap-1 rounded-xl bg-slate-900 p-1" role="group" aria-label="Status">
            {(["all", "active", "inactive"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={status === k} onClick={() => { setStatus(k); resetPaging(); }}
                className={`h-9 rounded-lg px-4 text-sm font-semibold capitalize transition-[background-color,color] duration-200 ${status === k ? "bg-accent text-accent-ink" : "text-slate-300 hover:text-white"}`}>{k}</button>
            ))}
          </div>
          <Dropdown
            className="w-full"
            hideLabel
            label="Sort"
            items={[{ label: "Name A to Z", value: "name" }, { label: "Name Z to A", value: "name-desc" }, { label: "Recently added", value: "newest" }, { label: "Active first", value: "active" }]}
            value={sort}
            onValueChange={(v) => setSort(v as Sort)}
          />
          <div className="inline-flex w-fit gap-1 rounded-xl bg-slate-900 p-1" role="group" aria-label="View">
            {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([k, Icon, label]) => (
              <button key={k} type="button" aria-pressed={view === k} aria-label={label} title={label} onClick={() => changeView(k)}
                className={`grid h-9 w-9 place-items-center rounded-lg transition-[background-color,color] duration-200 ${view === k ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}><Icon className="h-4 w-4" aria-hidden="true" /></button>
            ))}
          </div>
        </div>

        {cfg.position && positions.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto px-1 pb-1 pt-1" role="group" aria-label="Filter by position">
            {[["all", "All positions", total] as const, ...positions.map(([p, n]) => [p, p, n] as const)].map(([k, label, n]) => (
              <button key={k} type="button" aria-pressed={position === k} onClick={() => { setPosition(k); resetPaging(); }}
                className={`shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors duration-150 ${position === k ? tone.chipOn : "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"}`}>
                {label} <span className="ml-1 font-mono text-xs opacity-70">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {rows !== null && filtered.length > 0 && (
        <div className="mb-4 flex items-center justify-between px-1 text-sm text-slate-400" aria-live="polite">
          <p><span className="font-mono tabular-nums text-white">{String(filtered.length).padStart(2, "0")}</span> {filtered.length === 1 ? cfg.singular : cfg.plural}{filtered.length !== total && <> of {total}</>}</p>
          <button type="button" onClick={() => setSelected((s) => { const n = new Set(s); filtered.forEach((r) => (allFilteredSelected ? n.delete(r.id) : n.add(r.id))); return n; })} className="font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
            {allFilteredSelected ? "Clear selection" : `Select all ${filtered.length}`}
          </button>
        </div>
      )}

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {/* ───── Results ───── */}
      {rows === null ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-slate-700 bg-slate-900" style={{ animationDelay: `${i * 80}ms` }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-slate-600 px-6 py-20 text-center">
          <span className={`grid h-14 w-14 place-items-center rounded-2xl border ${tone.border} ${tone.tint} ${tone.text}`}><Camera className="h-6 w-6" aria-hidden="true" /></span>
          <p className="mt-5 font-display text-lg font-semibold text-white">{total === 0 ? `No ${cfg.plural} yet` : "No one matches those filters"}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{total === 0 ? cfg.empty : "Try a different search or status."}</p>
          {total === 0 ? (
            <button type="button" onClick={() => setEdit("new")} className="btn btn-primary btn-sm mt-6"><UserPlus className="h-4 w-4" aria-hidden="true" /> Add {cfg.singular}</button>
          ) : (
            <button type="button" onClick={() => { setQuery(""); setStatus("all"); setPosition("all"); }} className="btn btn-ghost btn-sm mt-6">Clear filters</button>
          )}
        </div>
      ) : view === "grid" ? (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" key={`g-${status}-${position}-${sort}`}>
          {shown.map((m, i) => {
            const on = m.is_active !== false;
            const sel = selected.has(m.id);
            const role = cfg.position ? (m.position?.trim() || "No position") : cfg.role;
            return (
              <li key={m.id} className="group" style={{ animation: "rise .55s var(--ease) both", animationDelay: `${Math.min(i, 11) * 45}ms` }}>
                <article className={`relative aspect-[4/5] overflow-hidden rounded-2xl border bg-slate-800 transition-[transform,border-color,box-shadow] duration-300 ease-out-quint hover:-translate-y-1 ${sel ? "border-accent shadow-[0_0_0_2px_rgba(200,245,96,.35)]" : "border-slate-700 hover:border-slate-500 hover:shadow-[0_18px_40px_rgba(0,0,0,.45)]"}`}>
                  <div className={`absolute inset-0 transition-[filter,opacity] duration-500 ${on ? "" : "opacity-60 saturate-0"}`}>
                    <div className="h-full w-full text-sm transition-transform duration-700 ease-out group-hover:scale-[1.05]"><Photo m={m} className="h-full w-full object-cover" /></div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/30" aria-hidden="true" />

                  <Tick on={sel} label={`Select ${m.name}`} onToggle={() => toggleSel(m.id)} className={`absolute left-3 top-3 ${selecting ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"}`} />

                  {/* the status pill is also the switch */}
                  <button type="button" disabled={toggling === m.id} onClick={() => toggleActive(m, !on)} aria-pressed={on} aria-label={`${m.name}: ${on ? "active, click to make inactive" : "inactive, click to make active"}`}
                    className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-slate-950/70 px-2.5 py-1 font-mono text-[.62rem] uppercase tracking-[.12em] outline-none backdrop-blur transition-[border-color,color,transform] duration-200 hover:scale-105 focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.3)] disabled:opacity-60 ${on ? "border-accent/40 text-accent" : "border-slate-600 text-slate-400"}`}>
                    {toggling === m.id ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-slate-500"}`} aria-hidden="true" />}
                    {on ? "Active" : "Inactive"}
                  </button>

                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words font-display text-lg font-semibold leading-tight text-white">{m.name}</h2>
                      <p className={`mt-1 break-words font-mono text-[.68rem] uppercase leading-snug tracking-[.14em] ${tone.text}`}>{role}</p>
                      {kind === "media" && head?.media_team_id === m.id && <HeadBadge className="mt-2" />}
                    </div>
                    <span className="flex shrink-0 translate-y-2 gap-1 opacity-0 transition-[opacity,transform] duration-200 ease-out-quint focus-within:translate-y-0 focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100">
                      {sup && <HeadMenu variant="grid" name={m.name} isHead={head?.media_team_id === m.id} onAssign={() => setAssigning({ id: m.id, name: m.name })} onRemove={() => clearMediaHead(m.name, reloadHead)} />}
                      <button type="button" onClick={() => setEdit(m)} aria-label={`Edit ${m.name}`} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950/70 text-white backdrop-blur transition-colors hover:bg-accent hover:text-accent-ink"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                      <button type="button" onClick={() => setToDelete([m])} aria-label={`Delete ${m.name}`} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950/70 text-white backdrop-blur transition-colors hover:bg-[#ef4444]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                    </span>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900" key={`l-${status}-${position}-${sort}`}>
          <div className={`hidden ${sup ? "grid-cols-[1.5rem_2.75rem_1fr_9rem_8.5rem]" : "grid-cols-[1.5rem_2.75rem_1fr_9rem_6rem]"} items-center gap-4 border-b border-slate-700 bg-slate-950/50 px-4 py-2.5 font-mono text-[.66rem] uppercase tracking-[.16em] text-slate-500 sm:grid`}>
            <span /><span /><span>Name</span><span>Status</span><span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-slate-800">
            {shown.map((m, i) => {
              const on = m.is_active !== false;
              const sel = selected.has(m.id);
              return (
                <li key={m.id} className={`group grid grid-cols-[1.5rem_2.75rem_1fr_auto] items-center gap-4 px-4 py-3 transition-colors duration-150 ${sup ? "sm:grid-cols-[1.5rem_2.75rem_1fr_9rem_8.5rem]" : "sm:grid-cols-[1.5rem_2.75rem_1fr_9rem_6rem]"} ${sel ? "bg-accent/[.07]" : "hover:bg-slate-800/50"}`} style={{ animation: "rise .4s var(--ease) both", animationDelay: `${Math.min(i, 14) * 25}ms` }}>
                  <Tick on={sel} label={`Select ${m.name}`} onToggle={() => toggleSel(m.id)} />
                  <span className={`h-11 w-11 overflow-hidden rounded-xl border border-slate-600 bg-slate-800 text-sm transition-[filter,opacity] ${on ? "" : "opacity-60 saturate-0"}`}><Photo m={m} className="h-full w-full object-cover" /></span>
                  <span className="min-w-0">
                    <span className={`block break-words text-sm font-semibold ${on ? "text-white" : "text-slate-400"}`}>{m.name}</span>
                    <span className={`block break-words font-mono text-[.68rem] uppercase tracking-[.12em] ${tone.text}`}>{cfg.position ? (m.position?.trim() || "No position") : cfg.role}</span>
                    {kind === "media" && head?.media_team_id === m.id && <HeadBadge className="mt-1.5" />}
                  </span>
                  <label className="hidden cursor-pointer items-center gap-2.5 text-xs text-slate-400 sm:flex">
                    <Switch.Root checked={on} disabled={toggling === m.id} onCheckedChange={(v) => toggleActive(m, v)} aria-label={`${m.name} is active`} className={`${switchRoot} h-5 w-9`}>
                      <Switch.Thumb className="block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-slate-300 transition-transform duration-200 ease-out-quint data-[checked]:translate-x-[17px] data-[checked]:bg-accent-ink" />
                    </Switch.Root>
                    {on ? "Active" : "Inactive"}
                  </label>
                  <span className="flex justify-end gap-1">
                    {sup && <HeadMenu variant="list" name={m.name} isHead={head?.media_team_id === m.id} onAssign={() => setAssigning({ id: m.id, name: m.name })} onRemove={() => clearMediaHead(m.name, reloadHead)} />}
                    <button type="button" onClick={() => setEdit(m)} aria-label={`Edit ${m.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => setToDelete([m])} aria-label={`Delete ${m.name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-[#f87171]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {filtered.length > shown.length && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="btn btn-ghost">Show {Math.min(PAGE, filtered.length - shown.length)} more <span className="font-mono text-xs text-slate-500">({filtered.length - shown.length} left)</span></button>
        </div>
      )}

      {/* Add button: pinned to the corner of the screen. It is rendered straight into <body> (a portal) so no padded or
          animated parent can offset it, and it sits flush with the window edge. */}
      {!selecting && typeof document !== "undefined" && createPortal(
        <button type="button" onClick={() => setEdit("new")} className="btn btn-primary animate-fadeIn shadow-[0_10px_30px_rgba(0,0,0,.5)]" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 30 }}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add {cfg.singular}
        </button>,
        document.body,
      )}

      {/* Bulk action bar */}
      {selecting && (
        <div role="region" aria-label="Selection actions" className="fixed inset-x-0 bottom-5 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-2xl border border-slate-600 bg-slate-900 p-2 pl-4 shadow-[0_12px_40px_rgba(0,0,0,.55)]" style={{ animation: "rise .35s var(--ease) both" }}>
          <span className="mr-1 text-sm text-slate-300"><span className="font-display text-base font-bold tabular-nums text-white">{selected.size}</span> selected</span>
          <button type="button" disabled={bulkBusy} onClick={() => bulkActive(true)} className="btn btn-ghost btn-sm disabled:opacity-60">{bulkBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Activate</button>
          <button type="button" disabled={bulkBusy} onClick={() => bulkActive(false)} className="btn btn-ghost btn-sm disabled:opacity-60">Deactivate</button>
          <button type="button" disabled={bulkBusy} onClick={() => setToDelete(selectedRows)} className="btn btn-sm text-[#f87171] hover:bg-slate-800 disabled:opacity-60"><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</button>
          <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      )}

      {kind === "media" && <AssignHeadDialog member={assigning} currentName={(rows ?? []).find((r) => r.id === head?.media_team_id)?.name ?? null} onClose={() => setAssigning(null)} onDone={reloadHead} />}

      <PersonDialog kind={kind} person={edit} positions={positions.map(([p]) => p)} onClose={() => setEdit(null)} onSaved={load} />

      <Dialog.Root open={toDelete !== null} onOpenChange={(o) => { if (!o && !deleting) setToDelete(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <Dialog.Title className="font-display text-xl font-semibold text-white">{toDelete && toDelete.length > 1 ? `Delete ${toDelete.length} ${cfg.plural}?` : `Delete this ${cfg.singular}?`}</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-slate-400">
                <span className="text-white">{toDelete && toDelete.length > 1 ? `${toDelete.length} ${cfg.plural}` : toDelete?.[0]?.name}</span>{" "}will be removed from the live website. This can&rsquo;t be undone. To keep them here without showing them on the site, mark them inactive instead.
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <Dialog.Close className="btn btn-ghost" disabled={deleting}>Cancel</Dialog.Close>
                <button type="button" onClick={remove} disabled={deleting} className="btn bg-[#ef4444] text-white hover:bg-[#f87171] disabled:opacity-60">{deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Delete</button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function PersonDialog({ kind, person, positions, onClose, onSaved }: { kind: Kind; person: Person | "new" | null; positions: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const cfg = KINDS[kind];
  const tone = TONES[cfg.tone];
  const editing = person !== null && person !== "new" ? person : null;
  const [name, setName] = useState("");
  const [pos, setPos] = useState("");
  const [photo, setPhoto] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(editing?.name ?? "");
    setPos(editing?.position ?? "");
    setPhoto(editing?.image_url ?? "");
    setActive(editing ? editing.is_active !== false : true);
    setErr("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [person]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = [...new Set([...positions, ...cfg.suggest])];

  async function save() {
    if (saving) return;
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr("");
    const payload: Record<string, unknown> = { name: name.trim(), image_url: photo || null, is_active: active };
    if (cfg.position) payload.position = pos.trim() || null;
    const { error } = editing ? await sb.from(cfg.table).update(payload).eq("id", editing.id) : await sb.from(cfg.table).insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); notify.error(`Couldn't save: ${error.message}`); return; }
    if (editing) notify.updated(`${cap(cfg.singular)} updated`, { description: String(payload.name) });
    else notify.created(`${cap(cfg.singular)} added`, { description: String(payload.name) });
    await onSaved();
    onClose();
  }

  return (
    <Dialog.Root open={person !== null} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto p-4 sm:place-items-center">
          <Dialog.Popup className="my-4 w-full max-w-xl rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:translate-y-2 data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
            <div className="flex items-start gap-4 p-6 pb-4">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${tone.border} ${tone.tint} ${tone.text}`}>{editing ? <Pencil className="h-5 w-5" aria-hidden="true" /> : <UserPlus className="h-5 w-5" aria-hidden="true" />}</span>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="break-words font-display text-xl font-semibold text-white">{editing ? editing.name : `Add ${cfg.singular}`}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-slate-400">{editing ? "Update their details." : `Add someone to ${cfg.shows}.`}</Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5 px-6 pb-6" noValidate>
              <div>
                <label className={lbl} htmlFor="pp-name">Full name <span className="text-accent">*</span></label>
                <input id="pp-name" className={`${input} ${err && !name.trim() ? "!border-[#f87171]" : ""}`} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); if (err) setErr(""); }} placeholder="e.g. Maria Santos" autoComplete="off" autoFocus={!editing} />
              </div>

              {cfg.position && (
                <div>
                  <label className={lbl} htmlFor="pp-pos">Position</label>
                  <input id="pp-pos" className={input} value={pos} maxLength={60} onChange={(e) => setPos(e.target.value)} placeholder="e.g. Videographer" autoComplete="off" />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.slice(0, 8).map((s) => (
                      <button key={s} type="button" onClick={() => setPos(s)} aria-pressed={pos.trim() === s}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 ${pos.trim() === s ? tone.chipOn : "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className={lbl}>Photo</span>
                <PhotoDropzone value={photo} onChange={setPhoto} name={name} folder={cfg.folder} />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                <div><p id="pp-active" className="text-sm font-medium text-white">Active</p><p className="text-xs text-slate-500">Turn off to keep them here without showing them on the site</p></div>
                <Switch.Root checked={active} onCheckedChange={setActive} aria-labelledby="pp-active" className={`${switchRoot} h-6 w-11`}>
                  <Switch.Thumb className="block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-slate-300 transition-transform duration-200 ease-out-quint data-[checked]:translate-x-[22px] data-[checked]:bg-accent-ink" />
                </Switch.Root>
              </div>

              {err && <p role="alert" className="animate-fadeIn text-sm text-[#f87171]">{err}</p>}

              <div className="flex justify-end gap-3 border-t border-slate-700 pt-5">
                <Dialog.Close className="btn btn-ghost btn-sm" disabled={saving}>Cancel</Dialog.Close>
                <button type="submit" disabled={saving} className="btn btn-primary btn-sm min-w-28 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editing ? "Save changes" : `Add ${cfg.singular}`}</button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
