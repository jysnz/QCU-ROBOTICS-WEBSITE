"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import NumberFlow from "@number-flow/react";
import { Award, CalendarRange, ExternalLink, FileText, Link2, Loader2, MapPin, Pencil, Play, Plus, Search, Shield, Swords, Tag, Trash2, Trophy, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Dropdown from "../components/Dropdown";
import HlsPlayer from "./HlsPlayer";
import RolePlayersDialog from "./RolePlayersDialog";
import { notify } from "./notify";
import PhotoDropzone from "./PhotoDropzone";
import SocialIcon from "./SocialIcon";
import type { Field, Resource } from "./resources";
import { sb } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Labels = Record<string, Map<string, string>>; // relation table -> id -> label

const ICONS: Record<string, LucideIcon> = { season: CalendarRange, team: Shield, competition: Trophy, match: Swords, achievement: Award, role: Tag, social: Link2, text: FileText };
const PAGE = 30;

const input = "h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.18)] focus-visible:outline-none";
const fieldLabel = "mb-2 block font-mono text-[.7rem] font-medium uppercase tracking-[.16em] text-slate-400";
const switchRoot = "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-slate-600 bg-slate-800 outline-none transition-colors duration-200 focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.25)] data-[checked]:border-accent data-[checked]:bg-accent disabled:opacity-60";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function badgeTone(v: string) {
  const k = v.toLowerCase();
  if (["active", "win", "won"].includes(k)) return "border-accent/40 bg-accent/10 text-accent";
  if (k === "recent") return "border-violet-400/40 bg-violet-400/10 text-violet-300";
  if (["loss", "lost"].includes(k)) return "border-[#f87171]/40 bg-[#f87171]/10 text-[#f87171]";
  if (["tie", "draw"].includes(k)) return "border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]";
  return "border-slate-600 bg-slate-800 text-slate-300";
}
const Pill = ({ v }: { v: string }) => (
  <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[.64rem] uppercase tracking-[.12em] ${badgeTone(v)}`}>{v}</span>
);

/* ───────── shared bits for the three list layouts ───────── */
type Ctx = {
  res: Resource; fields: Field[]; labels: Labels; display: (f: Field, r: Row) => string; title: (r: Row) => string;
  onPlay: (r: Row) => void;
  onOpen: (r: Row) => void;
  playingId: number | null;
  usage: Record<string, number>;
  onEdit: (r: Row) => void; onDelete: (r: Row) => void; onToggle: (r: Row, v: boolean) => void; toggling: number | null; hasToggle: boolean;
};

function Actions({ ctx, row, overlay = false }: { ctx: Ctx; row: Row; overlay?: boolean }) {
  const base = overlay ? "bg-slate-950/70 text-white backdrop-blur hover:bg-accent hover:text-accent-ink" : "text-slate-400 hover:bg-slate-800 hover:text-white";
  return (
    <span className="flex shrink-0 gap-1">
      <button type="button" onClick={() => ctx.onEdit(row)} aria-label={`Edit ${ctx.title(row)}`} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${base}`}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" onClick={() => ctx.onDelete(row)} aria-label={`Delete ${ctx.title(row)}`} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${overlay ? "bg-slate-950/70 text-white backdrop-blur hover:bg-[#ef4444]" : "text-slate-400 hover:bg-slate-800 hover:text-[#f87171]"}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
    </span>
  );
}

function Toggle({ ctx, row }: { ctx: Ctx; row: Row }) {
  const k = ctx.res.toggleKey!;
  const on = row[k] === true;
  return (
    <label className="hidden cursor-pointer items-center gap-2 text-xs text-slate-400 sm:flex">
      <Switch.Root checked={on} disabled={ctx.toggling === row.id} onCheckedChange={(v) => ctx.onToggle(row, v)} aria-label={`${ctx.title(row)}: ${ctx.fields.find((f) => f.key === k)?.label ?? k}`} className={`${switchRoot} h-5 w-9`}>
        <Switch.Thumb className="block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-slate-300 transition-transform duration-200 ease-out-quint data-[checked]:translate-x-[17px] data-[checked]:bg-accent-ink" />
      </Switch.Root>
      <span className="w-14">{on ? "Active" : "Inactive"}</span>
    </label>
  );
}

function RowItem({ ctx, row, i }: { ctx: Ctx; row: Row; i: number }) {
  const { res } = ctx;
  const Icon = ICONS[res.icon ?? ""] ?? Tag;
  const metas = ctx.fields.filter((f) => f.list && f.key !== res.titleKey && f.key !== res.toggleKey && f.key !== res.leadKey && f.key !== res.badgeKey && f.key !== res.groupKey && f.type !== "boolean");
  const lead = res.leadKey ? row[res.leadKey] : null;
  const thumb: string | null = res.imageKey ? row[res.imageKey] : null; // sponsors, etc.
  const badge = res.badgeKey ? String(row[res.badgeKey] ?? "") : "";
  const dim = res.toggleKey && res.toggleKey in row && row[res.toggleKey] !== true;
  return (
    <li className={`group flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-900 p-3 pr-3 transition-[border-color,opacity,transform] duration-200 hover:border-slate-500 ${dim ? "opacity-70" : ""}`} style={{ animation: "rise .45s var(--ease) both", animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-600 bg-slate-950/60 font-mono text-sm font-semibold text-accent transition-colors duration-200 group-hover:border-accent/50">
        {lead !== null && lead !== undefined && lead !== "" ? String(lead)
          : thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : <Icon className="h-5 w-5 text-slate-400" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold text-white">{ctx.title(row)}</span>
        {metas.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
            {metas.map((f) => { const v = ctx.display(f, row); return v ? <span key={f.key}><span className="text-slate-500">{f.label}:</span> {v}</span> : null; })}
          </span>
        )}
      </span>
      {badge && <Pill v={badge} />}
      {ctx.fields.filter((f) => f.type === "boolean" && f.list && f.key !== res.toggleKey && row[f.key] === true).map((f) => (
        <span key={f.key} className="hidden shrink-0 rounded-full border border-[#fbbf24]/40 bg-[#fbbf24]/10 px-2.5 py-0.5 font-mono text-[.64rem] uppercase tracking-[.12em] text-[#fbbf24] md:inline-flex">{f.label.replace(/ award$/i, "")}</span>
      ))}
      {ctx.hasToggle && res.toggleKey && res.toggleKey in row && <Toggle ctx={ctx} row={row} />}
      <Actions ctx={ctx} row={row} />
    </li>
  );
}

function CardItem({ ctx, row, i }: { ctx: Ctx; row: Row; i: number }) {
  const { res } = ctx;
  const Icon = ICONS[res.icon ?? ""] ?? Tag;
  const [broken, setBroken] = useState(false);
  const img = res.imageKey ? row[res.imageKey] : null;
  const badge = res.badgeKey ? String(row[res.badgeKey] ?? "") : "";
  const date = ctx.fields.find((f) => f.key === "date");
  const loc = ctx.fields.find((f) => f.key === "location");
  const season = ctx.fields.find((f) => f.key === "season_id");
  return (
    <li className="group" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${Math.min(i, 11) * 45}ms` }}>
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 transition-[transform,border-color,box-shadow] duration-300 ease-out-quint hover:-translate-y-1 hover:border-slate-500 hover:shadow-[0_18px_40px_rgba(0,0,0,.45)]">
        <div className="relative aspect-[16/9] overflow-hidden border-b border-slate-700 bg-slate-800">
          {img && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
          ) : (
            <span className="grid h-full w-full place-items-center text-slate-600"><Icon className="h-10 w-10" aria-hidden="true" /></span>
          )}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent" aria-hidden="true" />
          {badge && <span className="absolute left-3 top-3"><Pill v={badge} /></span>}
          <span className="absolute right-3 top-3 translate-y-[-4px] opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"><Actions ctx={ctx} row={row} overlay /></span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <h3 className="break-words font-display text-base font-semibold leading-snug text-white">{ctx.title(row)}</h3>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {date && row.date && <p className="flex items-center gap-2"><CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />{row.date}</p>}
            {loc && row.location && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />{row.location}</p>}
            {season && row.season_id && res.groupKey !== "season_id" && <p className="flex items-center gap-2"><Tag className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />{ctx.display(season, row)}</p>}
          </div>
        </div>
      </article>
    </li>
  );
}

function ScoreItem({ ctx, row, i }: { ctx: Ctx; row: Row; i: number }) {
  const result = String(row.result ?? "");
  const r = result.toLowerCase();
  const ours = row.our_score ?? 0;
  const theirs = row.opponent_score ?? 0;
  const comp = ctx.fields.find((f) => f.key === "competition_id");
  const team = ctx.fields.find((f) => f.key === "team_id");
  const bits = [comp && ctx.res.groupKey !== "competition_id" ? ctx.display(comp, row) : "", team ? ctx.display(team, row) : "", row.opponent_name ? `vs ${row.opponent_name}` : ""].filter(Boolean);
  const video: string | null = ctx.res.videoKey ? (row[ctx.res.videoKey] || null) : null;
  const poster: string | null = row.thumbnail || null;
  const processing = row.is_processing === true;
  const open = ctx.playingId === row.id;
  const [thumbBroken, setThumbBroken] = useState(false);

  return (
    <li className={`group rounded-xl border bg-slate-900 transition-[border-color,box-shadow] duration-200 hover:border-slate-500 ${open ? "border-accent/60 shadow-[0_0_0_1px_rgba(200,245,96,.25)]" : "border-slate-700"}`} style={{ animation: "rise .45s var(--ease) both", animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <div className="flex items-center gap-3 p-2.5 pr-3 sm:gap-4">
        {/* the video, right in the item: a thumbnail you tap to play in place */}
        {video ? (
          <button type="button" onClick={() => ctx.onPlay(row)} aria-expanded={open} aria-label={`${open ? "Close" : "Play"} video: ${ctx.title(row)}`}
            className="group/play relative hidden aspect-video w-40 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 outline-none transition-[border-color,transform] duration-200 hover:border-accent focus-visible:border-accent sm:block">
            {poster && !thumbBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" loading="lazy" onError={() => setThumbBroken(true)} className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover/play:scale-[1.06]" />
            ) : (
              <span className="grid h-full w-full place-items-center text-slate-600"><Swords className="h-6 w-6" aria-hidden="true" /></span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-slate-950/30 transition-colors duration-200 group-hover/play:bg-slate-950/10" aria-hidden="true">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_6px_20px_rgba(0,0,0,.5)] transition-transform duration-200 group-hover/play:scale-110">
                {open ? <X className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
              </span>
            </span>
            {processing && <span className="absolute bottom-1.5 left-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[.58rem] uppercase tracking-[.1em] text-[#fbbf24]">Processing</span>}
          </button>
        ) : (
          <span className="hidden aspect-video w-40 shrink-0 place-items-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-600 sm:grid">No video</span>
        )}

        <span className={`h-10 w-1 shrink-0 rounded-full ${r.startsWith("w") ? "bg-accent" : r.startsWith("l") ? "bg-[#f87171]" : r ? "bg-[#fbbf24]" : "bg-slate-600"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-white">{ctx.title(row)}</span>
          {bits.length > 0 && <span className="mt-0.5 block break-words text-xs text-slate-400">{bits.join(" · ")}</span>}
          {video && (
            <button type="button" onClick={() => ctx.onPlay(row)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline sm:hidden">
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />{open ? "Close video" : "Watch video"}
            </button>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 font-display text-2xl font-bold tabular-nums" aria-label={`Score ${ours} to ${theirs}`}>
          <span className={r.startsWith("w") ? "text-accent" : "text-white"}>{ours}</span>
          <span className="text-base font-normal text-slate-600">–</span>
          <span className={r.startsWith("l") ? "text-[#f87171]" : "text-slate-400"}>{theirs}</span>
        </span>
        <span className="hidden w-16 md:block">{result && <Pill v={result} />}</span>
        <Actions ctx={ctx} row={row} />
      </div>

      {/* the player opens right under the item */}
      {video && (
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={!open}>
          <div className="min-h-0 overflow-hidden">
            {open && <div className="border-t border-slate-700 p-3 sm:p-4"><div className="mx-auto max-w-3xl"><HlsPlayer url={video} poster={poster} /></div></div>}
          </div>
        </div>
      )}
    </li>
  );
}

function ChipItem({ ctx, row, i }: { ctx: Ctx; row: Row; i: number }) {
  const n = ctx.usage[String(row.id)] ?? 0;
  const max = Math.max(1, ...Object.values(ctx.usage));
  const noun = ctx.res.usage?.noun ?? "item";
  const Icon = ICONS[ctx.res.icon ?? ""] ?? Tag;
  return (
    <li style={{ animation: "rise .45s var(--ease) both", animationDelay: `${Math.min(i, 12) * 45}ms` }}>
      <article className="group h-full rounded-2xl border border-slate-700 bg-slate-900 transition-[border-color,transform,box-shadow] duration-300 ease-out-quint hover:-translate-y-1 hover:border-slate-500 hover:shadow-[0_16px_36px_rgba(0,0,0,.4)]">
        <div className="flex items-start gap-1 p-2 pr-3">
          <button type="button" onClick={() => ctx.onOpen(row)} aria-label={`Show the ${noun}s who hold ${ctx.title(row)}`} className="flex min-w-0 flex-1 cursor-pointer flex-col rounded-xl p-3 text-left outline-none transition-colors duration-150 hover:bg-slate-800/50 focus-visible:bg-slate-800/50 focus-visible:shadow-[0_0_0_2px_rgba(200,245,96,.4)]">
            <span className="flex items-start gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors duration-200 ${n > 0 ? "border-accent/40 bg-accent/10 text-accent" : "border-slate-600 bg-slate-950/60 text-slate-500"}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-display text-lg font-semibold leading-snug text-white">{ctx.title(row)}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{n > 0 ? <><span className="font-mono tabular-nums text-white">{n}</span> {noun}{n === 1 ? "" : "s"} hold this role</> : "Not used yet"}</span>
              </span>
            </span>
            <span className="mt-4 block h-1.5 overflow-hidden rounded-full bg-slate-800" role="img" aria-label={`${n} of the most-used role's ${max}`}>
              <span className="block h-full rounded-full bg-accent transition-[width] duration-[900ms] ease-out-quint" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent opacity-70 transition-opacity duration-200 group-hover:opacity-100">
              View {noun}s <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </span>
          </button>
          <Actions ctx={ctx} row={row} />
        </div>
      </article>
    </li>
  );
}

function LinkItem({ ctx, row, i }: { ctx: Ctx; row: Row; i: number }) {
  const name = String(row.platform ?? "");
  const url = String(row.url ?? "").trim();
  let host = "";
  let ok = false;
  try { const u = new URL(url); ok = /^https?:$/.test(u.protocol); host = u.host.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""); } catch { /* not a URL */ }
  return (
    <li className="group flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-slate-500" style={{ animation: "rise .45s var(--ease) both", animationDelay: `${Math.min(i, 12) * 45}ms` }}>
      <SocialIcon name={name} className="h-12 w-12 rounded-xl transition-transform duration-300 ease-out-quint group-hover:scale-105 group-hover:-rotate-3" />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-semibold text-white">{name}</span>
        {url ? (
          <span className={`mt-0.5 block break-all text-xs ${ok ? "text-slate-400" : "text-[#fbbf24]"}`}>{ok ? host : `${url} (not a valid web link)`}</span>
        ) : (
          <span className="mt-0.5 block text-xs text-[#fbbf24]">No link yet</span>
        )}
      </span>
      {ok && (
        <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${name} in a new tab`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-accent"><ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
      )}
      <Actions ctx={ctx} row={row} />
    </li>
  );
}

function TextItem({ ctx, row, i }: { ctx: Ctx; row: Row; i: number }) {
  const text = String(row.description ?? "").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return (
    <li className="group rounded-2xl border border-slate-700 bg-slate-900 p-5 transition-[border-color] duration-200 hover:border-slate-500" style={{ animation: "rise .45s var(--ease) both", animationDelay: `${Math.min(i, 10) * 50}ms` }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[.68rem] uppercase tracking-[.14em] text-accent">{ctx.title(row)}</span>
          <span className="ml-3 font-mono text-[.68rem] text-slate-500">{words} {words === 1 ? "word" : "words"}</span>
        </div>
        <Actions ctx={ctx} row={row} />
      </div>
      {text ? (
        <button type="button" onClick={() => ctx.onEdit(row)} className="mt-3 block w-full rounded-lg text-left outline-none focus-visible:shadow-[0_0_0_2px_rgba(200,245,96,.4)]" aria-label={`Edit ${ctx.title(row)} text`}>
          <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300 transition-colors group-hover:text-slate-200">{text}</p>
        </button>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No text yet.</p>
      )}
    </li>
  );
}

/* Options for a relation field; when the relation has headings (competitions -> season) they come back grouped and ordered. */
function groupItems(f: Field, labels: Labels, grouping: Record<string, { of: Map<string, string>; order: string[] }>): { label: string; value: string; group?: string }[] {
  const t = f.relation!.table;
  const base = [...(labels[t] ?? new Map<string, string>()).entries()].map(([value, label]) => ({ label, value, group: grouping[t]?.of.get(value) }));
  const order = grouping[t]?.order ?? [];
  return order.length ? [...base].sort((a, b) => order.indexOf(a.group ?? "") - order.indexOf(b.group ?? "")) : base.map(({ label, value }) => ({ label, value }));
}

/* ───────── the panel ───────── */
export default function CrudPanel({ resource: res, startNew = false }: { resource: Resource; startNew?: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Labels>({});
  const [grouping, setGrouping] = useState<Record<string, { of: Map<string, string>; order: string[] }>>({}); // relation table -> option id -> heading
  const [graduated, setGraduated] = useState<Record<string, Set<string>>>({}); // relation table -> ids that can't be picked
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [shown, setShown] = useState(PAGE);
  const [draft, setDraft] = useState<Row | null>(null); // the row being created/edited
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<string, Row[]>>({}); // fieldKey -> rows of its link table (e.g. team_competitions)
  const [present, setPresent] = useState<Set<string>>(new Set()); // optional columns that really exist in the table
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [roleView, setRoleView] = useState<Row | null>(null); // the role whose players are shown
  const [playingId, setPlayingId] = useState<number | null>(null); // one match plays at a time
  // optional fields (e.g. seasons.is_active) only appear once the database actually has that column
  const fields = useMemo(() => res.fields.filter((f) => !f.optional || present.has(f.key)), [res, present]);
  const pk = res.pk ?? "id";
  const Icon = ICONS[res.icon ?? ""] ?? Tag;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [main, ...rels] = await Promise.all([
      sb.from(res.table).select("*").order(res.orderBy, { ascending: res.ascending ?? true }).limit(1000),
      ...[...new Map(res.fields.filter((f) => f.relation).map((f) => [f.relation!.table, f.relation!])).values()].map(async (r) => {
        const { data } = await sb.from(r.table).select(`id, ${r.labelKey}${r.notGraduated ? ", is_graduated" : ""}${r.groupBy ? `, ${r.groupBy.key}` : ""}`).order(r.orderBy ?? "id", { ascending: r.orderBy === "id" ? false : true });
        const rowsOut = (data ?? []) as unknown as Row[];
        // headings (e.g. the season a competition belongs to), newest heading first
        const grp = { of: new Map<string, string>(), order: [] as string[] };
        if (r.groupBy) {
          const { data: heads } = await sb.from(r.groupBy.table).select(`id, ${r.groupBy.labelKey}`).order("id", { ascending: false });
          const names = new Map(((heads ?? []) as unknown as Row[]).map((h) => [String(h.id), String(h[r.groupBy!.labelKey] ?? h.id)]));
          grp.order = [...names.values()];
          for (const x of rowsOut) grp.of.set(String(x.id), names.get(String(x[r.groupBy.key])) ?? "No season");
          grp.order.push("No season");
        }
        return [r.table, new Map(rowsOut.map((x) => [String(x.id), String(x[r.labelKey] ?? x.id)])), new Set(r.notGraduated ? rowsOut.filter((x) => x.is_graduated === true).map((x) => String(x.id)) : []), grp] as const;
      }),
    ]);
    if (main.error) setError(main.error.message);
    else setRows((main.data ?? []).map((r: Row) => (pk === "id" ? r : { ...r, id: r[pk] })));
    // an optional field (e.g. a photo column added by a SQL file) is only offered once the column exists
    const probes = await Promise.all(res.fields.filter((f) => f.optional).map(async (f) => {
      const { error: pe } = await sb.from(res.table).select(f.key).limit(1);
      return !pe || !(pe.code === "42703" || /column|does not exist/i.test(pe.message)) ? f.key : null;
    }));
    setPresent(new Set(probes.filter((k): k is string => !!k)));
    if (res.usage) {
      const { data: u } = await sb.from(res.usage.table).select(res.usage.key).limit(10000);
      const counts: Record<string, number> = {};
      for (const x of (u ?? []) as unknown as Row[]) counts[String(x[res.usage.key])] = (counts[String(x[res.usage.key])] ?? 0) + 1;
      setUsage(counts);
    }
    const lk = await Promise.all(res.fields.filter((f) => f.limitBy).map(async (f) => {
      const { data } = await sb.from(f.limitBy!.table).select(`${f.limitBy!.matchKey}, ${f.limitBy!.valueKey}`).limit(5000);
      return [f.key, (data ?? []) as unknown as Row[]] as const;
    }));
    setLinks(Object.fromEntries(lk));
    setLabels(Object.fromEntries(rels.map(([t, m]) => [t, m])));
    setGraduated(Object.fromEntries(rels.map(([t, , g]) => [t, g])));
    setGrouping(Object.fromEntries(rels.map(([t, , , g]) => [t, g])));
    setLoading(false);
  }, [res, pk]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Arriving from a dashboard quick action: open the "add" form straight away.
  useEffect(() => {
    if (startNew) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const display = useCallback((f: Field, row: Row): string => {
    const v = row[f.key];
    if (v === null || v === undefined || v === "") return "";
    if (f.type === "boolean") return v ? "Yes" : "No";
    if (f.type === "relation") return labels[f.relation!.table]?.get(String(v)) ?? `#${v}`;
    return String(v);
  }, [labels]);

  const title = useCallback((row: Row) => {
    const f = fields.find((x) => x.key === res.titleKey)!;
    return display(f, row) || `#${row.id}`;
  }, [fields, res.titleKey, display]);

  const titleField = fields.find((f) => f.key === res.titleKey)!;
  const filterFields = (res.filterKeys ?? []).map((k) => fields.find((f) => f.key === k)).filter((f): f is Field => !!f);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      Object.entries(filters).every(([k, v]) => v === "all" || String(r[k] ?? "") === v) &&
      (!q || fields.some((f) => f.type !== "image" && display(f, r).toLowerCase().includes(q))),
    );
  }, [rows, query, filters, fields, display]);

  const visible = filtered.slice(0, shown);

  // group the visible rows (relation -> in the relation's own order, date -> by year, newest first)
  const groups = useMemo(() => {
    const gf = res.groupKey ? fields.find((f) => f.key === res.groupKey) : undefined;
    if (!gf) return null;
    const EMPTY = res.groupEmpty ?? "Other";
    const map = new Map<string, Row[]>();
    for (const r of visible) {
      const v = r[gf.key];
      const g = v === null || v === undefined || v === "" ? EMPTY : gf.type === "date" ? String(v).slice(0, 4) : gf.type === "relation" ? labels[gf.relation!.table]?.get(String(v)) ?? `#${v}` : String(v);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    }
    const order = gf.type === "relation" ? [...(labels[gf.relation!.table]?.values() ?? [])] : [];
    return [...map.entries()].sort(([a], [b]) => {
      if (a === EMPTY) return 1;
      if (b === EMPTY) return -1;
      if (gf.type === "date") return b.localeCompare(a);
      if (order.length) return order.indexOf(a) - order.indexOf(b);
      return 0;
    });
  }, [visible, fields, res.groupKey, res.groupEmpty, labels]);

  // one chip per team (or whatever chipKey points at) that actually has rows, with a count and the W-L-T record
  const chips = useMemo(() => {
    const k = res.chipKey;
    const f = k ? fields.find((x) => x.key === k) : undefined;
    if (!k || !f?.relation) return [];
    const m = new Map<string, { n: number; w: number; l: number; t: number }>();
    for (const r of rows) {
      const v = r[k];
      if (v === null || v === undefined || v === "") continue;
      const e = m.get(String(v)) ?? { n: 0, w: 0, l: 0, t: 0 };
      e.n++;
      const res_ = String(r.result ?? "").toLowerCase();
      if (res_.startsWith("w")) e.w++; else if (res_.startsWith("l")) e.l++; else if (res_.startsWith("t") || res_.startsWith("d")) e.t++;
      m.set(String(v), e);
    }
    const order = [...(labels[f.relation.table]?.keys() ?? [])];
    return [...m.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([id, e]) => ({ id, label: labels[f.relation!.table]?.get(id) ?? `#${id}`, ...e }));
  }, [rows, fields, labels, res.chipKey]);

  // Season -> competition -> rows (achievements): seasons newest first (Override, Push Back, High Stakes, Over Under),
  // competitions inside each season in the same order as the competition list.
  const tree = useMemo(() => {
    const gf = res.nestGroups && res.groupKey ? fields.find((f) => f.key === res.groupKey) : undefined;
    const rel = gf?.relation;
    if (!gf || !rel?.groupBy) return null;
    const info = grouping[rel.table];
    const EMPTY = res.groupEmpty ?? "Other";
    const seasons = new Map<string, Map<string, Row[]>>();
    for (const r of visible) {
      const v = r[gf.key];
      const empty = v === null || v === undefined || v === "";
      const season = empty ? "No season" : info?.of.get(String(v)) ?? "No season";
      const comp = empty ? EMPTY : labels[rel.table]?.get(String(v)) ?? `#${v}`;
      if (!seasons.has(season)) seasons.set(season, new Map());
      const m = seasons.get(season)!;
      if (!m.has(comp)) m.set(comp, []);
      m.get(comp)!.push(r);
    }
    const seasonOrder = info?.order ?? [];
    const compOrder = [...(labels[rel.table]?.values() ?? [])];
    return [...seasons.entries()]
      .sort(([a], [b]) => seasonOrder.indexOf(a) - seasonOrder.indexOf(b))
      .map(([season, comps]) => ({
        season,
        count: [...comps.values()].reduce((n, x) => n + x.length, 0),
        comps: [...comps.entries()].sort(([a], [b]) => (a === EMPTY ? 1 : b === EMPTY ? -1 : compOrder.indexOf(a) - compOrder.indexOf(b))),
      }));
  }, [visible, fields, res.nestGroups, res.groupKey, res.groupEmpty, grouping, labels]);

  // header tiles: Total + a count per status/result value (or Active for rows with an on/off switch)
  const tiles = useMemo(() => {
    const t: [string, number][] = [["Total", rows.length]];
    if (res.badgeKey) {
      const m = new Map<string, number>();
      rows.forEach((r) => { const v = String(r[res.badgeKey!] ?? "").trim(); if (v) m.set(v, (m.get(v) ?? 0) + 1); });
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).forEach((e) => t.push(e));
    } else if (res.usage) {
      const used = rows.filter((r) => (usage[String(r.id)] ?? 0) > 0).length;
      t.push(["In use", used], ["Unused", rows.length - used]);
    } else if (res.toggleKey && rows[0] && res.toggleKey in rows[0]) {
      t.push(["Active", rows.filter((r) => r[res.toggleKey!] === true).length]);
    }
    return t;
  }, [rows, res.badgeKey, res.toggleKey, res.usage, usage]);

  // ids a limited relation field may offer, given what is chosen in the field it depends on
  const allowedFor = (f: Field): string[] => {
    if (!f.limitBy || !draft) return [];
    const chosen = draft[f.limitBy.field];
    if (!chosen) return [];
    return [...new Set((links[f.key] ?? []).filter((l) => String(l[f.limitBy!.matchKey]) === String(chosen)).map((l) => String(l[f.limitBy!.valueKey])))];
  };

  function openNew() {
    setEditingId(null);
    setFormError("");
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.type === "boolean" ? (f.key === "is_active") : ""])));
  }
  function openEdit(row: Row) {
    setEditingId(row.id);
    setFormError("");
    setDraft({
      ...Object.fromEntries(fields.map((f) => [f.key, row[f.key] ?? (f.type === "boolean" ? false : "")])),
      ...Object.fromEntries(fields.filter((f) => f.allowOther).map((f) => [`${f.key}__other`, !!row[f.key] && !(f.options ?? []).includes(row[f.key])])),
    });
  }

  async function save() {
    if (!draft || saving) return;
    const payload: Row = {};
    for (const f of fields) {
      const v = draft[f.key];
      if (f.type === "boolean") payload[f.key] = !!v;
      else if (f.type === "number" || f.type === "relation") payload[f.key] = v === "" || v === null || v === undefined ? null : Number(v);
      else payload[f.key] = typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null;
      if (f.required && (payload[f.key] === null || Number.isNaN(payload[f.key]))) {
        setFormError(f.allowOther && draft[`${f.key}__other`] ? `Enter the name of the ${f.label.toLowerCase()}.` : `${f.label} is required.`);
        return;
      }
    }
    setSaving(true);
    setFormError("");
    const q = editingId === null ? sb.from(res.table).insert(payload) : sb.from(res.table).update(payload).eq(pk, editingId);
    const { error: e } = await q;
    setSaving(false);
    if (e) { setFormError(e.message); notify.error(`Couldn't save: ${e.message}`); return; }
    const label = String(draft?.[res.titleKey] ?? "").trim();
    if (editingId === null) notify.created(`${cap(res.singular)} added`, { description: label || undefined });
    else notify.updated(`${cap(res.singular)} updated`, { description: label || undefined });
    setDraft(null);
    load();
  }

  async function toggle(row: Row, next: boolean) {
    const k = res.toggleKey!;
    setToggling(row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [k]: next } : r))); // optimistic
    const { error: e } = await sb.from(res.table).update({ [k]: next }).eq(pk, row.id);
    setToggling(null);
    if (e) { setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [k]: row[k] } : r))); notify.error(`Couldn't update: ${e.message}`); return; }
    notify.updated(`${title(row)} ${next ? "is now active" : "marked inactive"}`);
  }

  async function remove() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    const { error: e } = await sb.from(res.table).delete().eq(pk, toDelete.id);
    setDeleting(false);
    if (e) { setError(e.message); notify.error(`Couldn't delete: ${e.message}`); setToDelete(null); return; }
    notify.deleted(`${cap(res.singular)} deleted`, { description: title(toDelete) });
    setToDelete(null);
    load();
  }

  const ctx: Ctx = { res, fields, labels, display, title, onPlay: (r) => setPlayingId((cur) => (cur === r.id ? null : r.id)), onOpen: setRoleView, playingId, usage, onEdit: openEdit, onDelete: setToDelete, onToggle: toggle, toggling, hasToggle: true };
  const layout = res.layout ?? "rows";
  const Item = layout === "cards" ? CardItem : layout === "scores" ? ScoreItem : layout === "chips" ? ChipItem : layout === "links" ? LinkItem : layout === "text" ? TextItem : RowItem;
  const renderItems = (items: Row[]) =>
    layout === "cards" ? (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((r, i) => <Item key={r.id} ctx={ctx} row={r} i={i} />)}</ul>
    ) : layout === "chips" ? (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r, i) => <Item key={r.id} ctx={ctx} row={r} i={i} />)}
        <li style={{ animation: "rise .45s var(--ease) both", animationDelay: `${Math.min(items.length, 12) * 45}ms` }}>
          <button type="button" onClick={openNew} className="flex h-full min-h-[7.5rem] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-600 text-sm font-medium text-slate-400 transition-[border-color,color,background-color] duration-200 hover:border-accent/60 hover:bg-accent/5 hover:text-accent">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add {res.singular}
          </button>
        </li>
      </ul>
    ) : layout === "links" ? (
      <ul className="grid gap-3 md:grid-cols-2">{items.map((r, i) => <Item key={r.id} ctx={ctx} row={r} i={i} />)}</ul>
    ) : (
      <ul className="space-y-2.5">{items.map((r, i) => <Item key={r.id} ctx={ctx} row={r} i={i} />)}</ul>
    );
  const hasFilters = Object.values(filters).some((v) => v !== "all") || query.trim() !== "";

  return (
    <section aria-labelledby="panel-title" className="pb-20">
      {/* Header */}
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/60 p-6 sm:p-8" style={{ animation: "rise .6s var(--ease) both" }}>
        <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><Icon className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white">{res.label}</h1>
              <p className="mt-2 text-slate-400">{res.description}</p>
            </div>
          </div>
          <dl className="flex flex-wrap gap-3">
            {tiles.map(([k, n]) => (
              <div key={k} className="min-w-24 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <dt className="text-xs text-slate-400">{k}</dt>
                <dd className="mt-1 font-display text-3xl font-bold leading-none tabular-nums text-white"><NumberFlow value={n} /></dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* Toolbar */}
      <div className="sticky top-3 z-20 mb-4 rounded-2xl border border-slate-700 bg-slate-950/85 p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur" style={{ animation: "rise .6s var(--ease) both", animationDelay: "80ms" }}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search {res.label}</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder={`Search ${res.label.toLowerCase()}`} className="h-11 w-full rounded-xl bg-slate-900 pl-11 pr-4 text-sm font-medium text-white outline-none transition-shadow placeholder:text-slate-500 focus-visible:shadow-[0_0_0_2px_rgba(200,245,96,.5)]" />
          </label>
          {filterFields.map((f) => {
            const items = f.relation
              ? groupItems(f, labels, grouping)
              : (f.options ?? []).map((o) => ({ label: o, value: o }));
            return (
              <Dropdown key={f.key} hideLabel className="w-full lg:w-52" label={f.label}
                items={[{ label: `All ${f.label.toLowerCase()}s`, value: "all" }, ...items]}
                value={filters[f.key] ?? "all"}
                onValueChange={(v) => { setFilters((p) => ({ ...p, [f.key]: v })); setShown(PAGE); }} />
            );
          })}
        </div>
      </div>

      {res.chipKey && chips.length > 0 && (
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={`Filter by ${fields.find((f) => f.key === res.chipKey)?.label.toLowerCase()}`} style={{ animation: "rise .5s var(--ease) both", animationDelay: "120ms" }}>
          {[{ id: "all", label: `All ${fields.find((f) => f.key === res.chipKey)?.label.toLowerCase()}s`, n: rows.length, w: 0, l: 0, t: 0 }, ...chips].map((c) => {
            const on = (filters[res.chipKey!] ?? "all") === c.id;
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => { setFilters((p) => ({ ...p, [res.chipKey!]: c.id })); setShown(PAGE); }}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition-[border-color,background-color,color,transform] duration-200 active:scale-[.97] ${on ? "border-accent bg-accent/10 text-accent" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"}`}>
                <span className="text-sm font-semibold">{c.label}</span>
                <span className={`font-mono text-xs tabular-nums ${on ? "text-accent/80" : "text-slate-500"}`}>
                  {c.id !== "all" && c.w + c.l + c.t > 0 ? `${c.w}-${c.l}-${c.t}` : c.n}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {!loading && filtered.length > 0 && (
        <p className="mb-4 px-1 text-sm text-slate-400" aria-live="polite">
          <span className="font-mono tabular-nums text-white">{String(filtered.length).padStart(2, "0")}</span> {filtered.length === 1 ? "entry" : "entries"}{filtered.length !== rows.length && <> of {rows.length}</>}
        </p>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          {[...Array(5)].map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-xl border border-slate-700 bg-slate-900" style={{ animationDelay: `${i * 80}ms` }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-slate-600 px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><Icon className="h-6 w-6" aria-hidden="true" /></span>
          <p className="mt-5 font-display text-lg font-semibold text-white">{rows.length === 0 ? `No ${res.label.toLowerCase()} yet` : "Nothing matches those filters"}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{rows.length === 0 ? `Add the first ${res.singular} to get started.` : "Try a different search or filter."}</p>
          {rows.length === 0 ? (
            <button type="button" onClick={openNew} className="btn btn-primary btn-sm mt-6"><Plus className="h-4 w-4" aria-hidden="true" /> Add {res.singular}</button>
          ) : hasFilters ? (
            <button type="button" onClick={() => { setQuery(""); setFilters({}); }} className="btn btn-ghost btn-sm mt-6">Clear filters</button>
          ) : null}
        </div>
      ) : tree ? (
        <div className="space-y-12" key={JSON.stringify(filters)}>
          {tree.map((t, ti) => (
            <section key={t.season} aria-label={t.season} style={{ animation: "rise .5s var(--ease) both", animationDelay: `${Math.min(ti, 5) * 80}ms` }}>
              <div className="mb-5 flex items-center gap-4 border-b border-slate-700 pb-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent"><CalendarRange className="h-5 w-5" aria-hidden="true" /></span>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white">{t.season}</h2>
                <span className="rounded-full border border-slate-600 px-3 py-0.5 font-mono text-xs tabular-nums text-slate-400">{t.count}</span>
              </div>
              <div className="space-y-6 sm:pl-5">
                {t.comps.map(([name, items]) => (
                  <div key={name}>
                    <div className="mb-3 flex items-center gap-3 px-1">
                      <Trophy className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                      <h3 className="font-display text-base font-semibold text-slate-200">{name}</h3>
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[.68rem] tabular-nums text-slate-500">{items.length}</span>
                      <span className="h-px flex-1 bg-slate-800" aria-hidden="true" />
                    </div>
                    {renderItems(items)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : groups ? (
        <div className="space-y-8" key={JSON.stringify(filters)}>
          {groups.map(([name, items], gi) => (
            <section key={name} aria-label={name} style={{ animation: "rise .5s var(--ease) both", animationDelay: `${Math.min(gi, 6) * 70}ms` }}>
              <div className="mb-3 flex items-center gap-3 px-1">
                <h2 className="font-display text-lg font-semibold text-white">{name}</h2>
                <span className="rounded-full border border-slate-600 px-2.5 py-0.5 font-mono text-xs tabular-nums text-slate-400">{items.length}</span>
                <span className="h-px flex-1 bg-slate-800" aria-hidden="true" />
              </div>
              {renderItems(items)}
            </section>
          ))}
        </div>
      ) : (
        <div key={JSON.stringify(filters)}>{renderItems(visible)}</div>
      )}

      {filtered.length > visible.length && (
        <div className="mt-8 flex justify-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn btn-ghost">Show {Math.min(PAGE, filtered.length - visible.length)} more <span className="font-mono text-xs text-slate-500">({filtered.length - visible.length} left)</span></button>
        </div>
      )}

      {/* Add button: rendered into <body> so it sits flush in the screen corner */}
      {typeof document !== "undefined" && createPortal(
        <button type="button" onClick={openNew} className="btn btn-primary animate-fadeIn shadow-[0_10px_30px_rgba(0,0,0,.5)]" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 30 }}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add {res.singular}
        </button>,
        document.body,
      )}

      {res.usage && <RolePlayersDialog role={roleView ? { id: roleView.id, name: title(roleView) } : null} onClose={() => setRoleView(null)} />}

      {/* Create / edit */}
      <Dialog.Root open={draft !== null} onOpenChange={(o) => { if (!o && !saving) setDraft(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto p-4 sm:place-items-center">
            <Dialog.Popup className="my-4 w-full max-w-2xl rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:translate-y-2 data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <div className="flex items-start gap-4 p-6 pb-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent">{editingId === null ? <Plus className="h-5 w-5" aria-hidden="true" /> : <Pencil className="h-5 w-5" aria-hidden="true" />}</span>
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="break-words font-display text-xl font-semibold text-white">{editingId === null ? `Add ${res.singular}` : `Edit ${res.singular}`}</Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-sm text-slate-400">{res.description}</Dialog.Description>
                </div>
                <Dialog.Close aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
              </div>

              {draft && (
                <form onSubmit={(e) => { e.preventDefault(); save(); }} className="px-6 pb-6" noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {res.fields.filter((f) => !f.optional || present.has(f.key) || f.type === "image").map((f) => {
                      const id = `f-${f.key}`;
                      const missing = !!f.optional && !present.has(f.key);
                      // choosing a value clears any dependent field (e.g. the team) whose choice is no longer allowed
                      const set = (v: unknown) => setDraft((d) => {
                        const n: Row = { ...d, [f.key]: v };
                        for (const dep of fields.filter((x) => x.limitBy?.field === f.key)) {
                          const ok = (links[dep.key] ?? []).some((l) => String(l[dep.limitBy!.matchKey]) === String(v) && String(l[dep.limitBy!.valueKey]) === String(n[dep.key]));
                          if (!ok) n[dep.key] = "";
                        }
                        return n;
                      });
                      const wide = f.type === "textarea" || f.type === "image" || f.type === "boolean" || f.key === res.titleKey;
                      return (
                        <div key={f.key} className={wide ? "sm:col-span-2" : ""}>
                          {f.type === "boolean" ? (
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3">
                              <div><p id={id} className="text-sm font-medium text-white">{f.label}</p>{f.hint && <p className="text-xs text-slate-500">{f.hint}</p>}</div>
                              <Switch.Root checked={!!draft[f.key]} onCheckedChange={set} aria-labelledby={id} className={`${switchRoot} h-6 w-11`}>
                                <Switch.Thumb className="block h-[18px] w-[18px] translate-x-[3px] rounded-full bg-slate-300 transition-transform duration-200 ease-out-quint data-[checked]:translate-x-[22px] data-[checked]:bg-accent-ink" />
                              </Switch.Root>
                            </div>
                          ) : (
                            <>
                              <label className={fieldLabel} htmlFor={id}>{f.label}{f.required ? <span className="text-accent"> *</span> : ""}</label>
                              {f.type === "textarea" ? (
                                <textarea id={id} rows={res.layout === "text" ? 10 : 5} value={draft[f.key] ?? ""} onChange={(e) => set(e.target.value)} className={`${input} h-auto py-3`} />
                              ) : f.type === "select" && f.allowOther ? (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                  <SocialIcon name={String(draft[f.key] ?? "")} className="h-11 w-11 shrink-0 rounded-xl transition-all duration-300" />
                                  <select
                                    id={id}
                                    value={draft[`${f.key}__other`] ? "__other__" : draft[f.key] ?? ""}
                                    onChange={(e) => setDraft((d) => e.target.value === "__other__" ? { ...d, [f.key]: "", [`${f.key}__other`]: true } : { ...d, [f.key]: e.target.value, [`${f.key}__other`]: false })}
                                    className={`${input} ${formError.startsWith(f.label) ? "!border-[#f87171]" : ""}`}
                                    autoFocus={f.key === titleField.key}
                                  >
                                    <option value="">Choose a {f.label.toLowerCase()}…</option>
                                    {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                                    <option value="__other__">Other…</option>
                                  </select>
                                  </div>
                                  {draft[`${f.key}__other`] && (
                                    <div className="animate-fadeIn">
                                      <label className={fieldLabel} htmlFor={`${id}-other`}>{f.otherLabel ?? `Name of the ${f.label.toLowerCase()}`} <span className="text-accent">*</span></label>
                                      <input id={`${id}-other`} className={`${input} ${formError.startsWith("Enter the name") ? "!border-[#f87171]" : ""}`} value={draft[f.key] ?? ""} maxLength={60} onChange={(e) => set(e.target.value)} placeholder="e.g. Threads, Pinterest, Facebook Group" autoComplete="off" autoFocus />
                                    </div>
                                  )}
                                </div>
                              ) : f.type === "select" ? (
                                <select id={id} value={draft[f.key] ?? ""} onChange={(e) => set(e.target.value)} className={input}>
                                  <option value="">—</option>
                                  {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : f.type === "relation" ? (
                                <select id={id} value={draft[f.key] ?? ""} onChange={(e) => set(e.target.value)} className={`${input} disabled:cursor-not-allowed disabled:opacity-60`} required={f.required}
                                  disabled={!!f.limitBy && (!draft[f.limitBy.field] || allowedFor(f).length === 0)}>
                                  <option value="">{f.limitBy ? (!draft[f.limitBy.field] ? f.limitBy.chooseHint : allowedFor(f).length === 0 ? f.limitBy.emptyHint : "—") : "—"}</option>
                                  {(() => {
                                    // graduated players can't be picked (unless they're already the saved value)
                                    const allowed = f.limitBy ? new Set(allowedFor(f)) : null;
                                    const opts = groupItems(f, labels, grouping).filter((o) => (!allowed || allowed.has(o.value)) && (!graduated[f.relation!.table]?.has(o.value) || String(draft[f.key]) === o.value));
                                    const heads = [...new Set(opts.map((o) => o.group ?? ""))];
                                    if (heads.length <= 1 && !heads[0]) return opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>);
                                    return heads.map((h) => <optgroup key={h} label={h || "Other"}>{opts.filter((o) => (o.group ?? "") === h).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>);
                                  })()}
                                </select>
                              ) : f.type === "image" && missing ? (
                                <div className="rounded-xl border border-[#fbbf24]/40 bg-[#fbbf24]/5 p-4 text-sm text-slate-300">
                                  <p className="font-medium text-white">The photo column isn&rsquo;t in the database yet</p>
                                  <p className="mt-1 text-slate-400">Run this once in the Supabase SQL editor, then reload this page. Until then achievements are saved without a photo.</p>
                                  {f.sql && (
                                    <div className="mt-3 flex items-start gap-2">
                                      <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">{f.sql}</code>
                                      <button type="button" onClick={() => { navigator.clipboard?.writeText(f.sql!); notify.info("SQL copied"); }} className="btn btn-ghost btn-sm shrink-0">Copy</button>
                                    </div>
                                  )}
                                </div>
                              ) : f.type === "image" ? (
                                <PhotoDropzone value={draft[f.key] ?? ""} onChange={set} name={String(draft[res.titleKey] ?? "")} folder={f.folder ?? "uploads"} bucket={f.bucket} />
                              ) : (
                                <input
                                  id={id}
                                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                                  value={draft[f.key] ?? ""}
                                  onChange={(e) => set(e.target.value)}
                                  className={`${input} ${formError.startsWith(f.label) ? "!border-[#f87171]" : ""}`}
                                  required={f.required}
                                  autoFocus={f.key === titleField.key}
                                />
                              )}
                              {f.hint && <p className="mt-2 text-xs text-slate-500">{f.hint}</p>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {formError && <p role="alert" className="animate-fadeIn mt-5 text-sm text-[#f87171]">{formError}</p>}

                  <div className="mt-6 flex justify-end gap-3 border-t border-slate-700 pt-5">
                    <Dialog.Close className="btn btn-ghost btn-sm" disabled={saving}>Cancel</Dialog.Close>
                    <button type="submit" disabled={saving} className="btn btn-primary btn-sm min-w-28 disabled:opacity-60">
                      {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {editingId === null ? `Add ${res.singular}` : "Save changes"}
                    </button>
                  </div>
                </form>
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation */}
      <Dialog.Root open={toDelete !== null} onOpenChange={(o) => { if (!o && !deleting) setToDelete(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <Dialog.Title className="font-display text-xl font-semibold text-white">Delete {res.singular}?</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-slate-400">
                <span className="text-white">{toDelete ? title(toDelete) : ""}</span> will be removed from the live website. This can&rsquo;t be undone.
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <Dialog.Close className="btn btn-ghost" disabled={deleting}>Cancel</Dialog.Close>
                <button type="button" onClick={remove} disabled={deleting} className="btn bg-[#ef4444] text-white hover:bg-[#f87171] disabled:opacity-60">
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Delete
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
