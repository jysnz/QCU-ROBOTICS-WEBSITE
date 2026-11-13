"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import NumberFlow from "@number-flow/react";
import { BookUser, ChevronLeft, ChevronRight, Download, ImageOff, Images, Loader2, Search, X } from "lucide-react";
import Dropdown from "../components/Dropdown";
import { notify } from "./notify";
import { adminFetch } from "./supabase";

type Person = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
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
  submitted_at: string | null;
  photos: string[];
};
type RoleFilter = "all" | "member" | "media" | "player";

const ROLE_LABEL: Record<string, string> = { member: "Member", media: "Media team", player: "Player" };
const ROLE_TONE: Record<string, string> = { member: "text-accent border-accent/40 bg-accent/10", media: "text-violet-300 border-violet-400/40 bg-violet-400/10", player: "text-sky-300 border-sky-400/40 bg-sky-400/10" };
const PAGE = 24;
const shortProgram = (p: string | null) => (p ?? "").replace(/^Bachelor of (Science in|Early)\s*/i, "").trim();
const age = (iso: string): number | null => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return null; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a >= 0 && a < 120 ? a : null; };
/* Saves a stored photo to disk byte-for-byte: the file is fetched as-is and handed to the browser as a download, so
   nothing is re-compressed or resized on the way. */
async function savePhoto(url: string, base: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The photo couldn't be fetched (${res.status}).`);
  const blob = await res.blob();
  const fromUrl = /\.([a-z0-9]{3,4})(?:\?|$)/i.exec(new URL(url).pathname)?.[1]?.toLowerCase();
  const ext = fromUrl || (blob.type === "image/png" ? "png" : "jpg");
  const a = document.createElement("a");
  const obj = URL.createObjectURL(blob);
  a.href = obj;
  a.download = `${base}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(obj), 10_000);
}
const fileBase = (name: string) => name.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "photo";
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; };

function Cover({ p }: { p: Person }) {
  const [broken, setBroken] = useState(false);
  return p.photos[0] && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photos[0]} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
  ) : (
    <span className="grid h-full w-full place-items-center font-display text-5xl font-semibold text-slate-600" aria-hidden="true">{initials(p.name)}</span>
  );
}

/* Directory of everyone who registered through /member-reg (members, media team and players), with the details and
   the photos each person sent. Reads through the admin API because those columns are private to the database. */
export default function InformationPanel() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Person | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await adminFetch<{ registrations: Person[] }>("/api/admin/registrations");
      setPeople(body.registrations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the information.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const count = (r: RoleFilter) => (people ?? []).filter((p) => r === "all" || p.role === r).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people ?? []).filter((p) =>
      (role === "all" || p.role === role) &&
      (status === "all" || (status === "pending") === (p.registration_status === "pending")) &&
      (!q || [p.name, p.email, p.student_id, p.program, p.section].some((v) => (v ?? "").toLowerCase().includes(q))),
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [people, query, role, status]);
  const shown = filtered.slice(0, limit);
  const total = people?.length ?? 0;

  const roles: [RoleFilter, string][] = [["all", "Everyone"], ["member", "Members"], ["media", "Media team"], ["player", "Players"]];

  return (
    <section aria-labelledby="panel-title" className="pb-16">
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/60 p-6 sm:p-8" style={{ animation: "rise .6s var(--ease) both" }}>
        <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><BookUser className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white">Informations</h1>
              <p className="mt-2 text-slate-400">Everyone who joined the team through the registration form, with their details and the photos they sent. Tap a person to see all of them.</p>
            </div>
          </div>
          <dl className="grid grid-cols-4 gap-3">
            {([["Total", total, "text-white"], ["Members", count("member"), "text-accent"], ["Media", count("media"), "text-violet-300"], ["Players", count("player"), "text-sky-300"]] as const).map(([k, n, c]) => (
              <div key={k} className="min-w-[4.5rem] rounded-2xl border border-slate-700 bg-slate-950/50 px-3.5 py-3">
                <dt className="text-xs text-slate-400">{k}</dt>
                <dd className={`mt-1 font-display text-2xl font-bold leading-none tabular-nums ${c}`}><NumberFlow value={n} /></dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="sticky top-3 z-20 mb-4 rounded-2xl border border-slate-700 bg-slate-950/85 p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur" style={{ animation: "rise .6s var(--ease) both", animationDelay: "80ms" }}>
        <div className="grid gap-2 lg:grid-cols-[1fr_auto_11rem] lg:items-center">
          <label className="relative block">
            <span className="sr-only">Search people</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search name, email, student ID or program" className="h-11 w-full rounded-xl bg-slate-900 pl-11 pr-4 text-sm font-medium text-white outline-none transition-shadow placeholder:text-slate-500 focus-visible:shadow-[0_0_0_2px_rgba(200,245,96,.5)]" />
          </label>
          <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-slate-900 p-1 lg:w-auto" role="group" aria-label="Filter by role">
            {roles.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={role === k} onClick={() => { setRole(k); setLimit(PAGE); }}
                className={`h-9 shrink-0 rounded-lg px-3.5 text-sm font-semibold transition-[background-color,color] duration-200 ${role === k ? "bg-accent text-accent-ink" : "text-slate-300 hover:text-white"}`}>
                {label} <span className={`ml-1 font-mono text-xs ${role === k ? "text-accent-ink/70" : "text-slate-500"}`}>{count(k)}</span>
              </button>
            ))}
          </div>
          <Dropdown hideLabel className="w-full" label="Status" items={[{ label: "All statuses", value: "all" }, { label: "Approved", value: "approved" }, { label: "Pending review", value: "pending" }]} value={status} onValueChange={(v) => { setStatus(v); setLimit(PAGE); }} />
        </div>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {people === null && !error ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
          {[...Array(8)].map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl border border-slate-700 bg-slate-900" style={{ animationDelay: `${i * 80}ms` }} />)}
        </div>
      ) : people && filtered.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-slate-600 px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><BookUser className="h-6 w-6" aria-hidden="true" /></span>
          <p className="mt-5 font-display text-lg font-semibold text-white">{total === 0 ? "No registrations yet" : "No one matches those filters"}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{total === 0 ? "People appear here after they submit the form at /member-reg." : "Try a different search, role or status."}</p>
          {total > 0 && <button type="button" onClick={() => { setQuery(""); setRole("all"); setStatus("all"); }} className="btn btn-ghost btn-sm mt-6">Clear filters</button>}
        </div>
      ) : (
        <>
          <p className="mb-4 px-1 text-sm text-slate-400" aria-live="polite"><span className="font-mono tabular-nums text-white">{String(filtered.length).padStart(2, "0")}</span> {filtered.length === 1 ? "person" : "people"}{filtered.length !== total && <> of {total}</>}</p>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" key={`${role}-${status}`}>
            {shown.map((p, i) => (
              <li key={p.id} className="group" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${Math.min(i, 11) * 45}ms` }}>
                <button type="button" onClick={() => setOpen(p)} aria-label={`Open ${p.name}'s information`}
                  className="relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 text-left outline-none transition-[transform,border-color,box-shadow] duration-300 ease-out-quint hover:-translate-y-1 hover:border-slate-500 hover:shadow-[0_18px_40px_rgba(0,0,0,.45)] focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.3)]">
                  <Cover p={p} />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/20" aria-hidden="true" />
                  <span className={`absolute left-3 top-3 rounded-full border px-2.5 py-1 font-mono text-[.62rem] uppercase tracking-[.12em] backdrop-blur ${ROLE_TONE[p.role] ?? "border-slate-600 text-slate-300"}`}>{ROLE_LABEL[p.role] ?? p.role}</span>
                  {p.registration_status === "pending" && <span className="absolute right-3 top-3 rounded-full border border-[#fbbf24]/50 bg-slate-950/70 px-2.5 py-1 font-mono text-[.62rem] uppercase tracking-[.12em] text-[#fbbf24] backdrop-blur">Pending</span>}
                  <span className="absolute inset-x-0 bottom-0 p-4">
                    <span className="block break-words font-display text-lg font-semibold leading-tight text-white">{p.name}</span>
                    <span className="mt-1 block break-words text-xs leading-snug text-slate-300">{[shortProgram(p.program), p.year_level].filter(Boolean).join(" · ") || p.email}</span>
                    <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-[.66rem] text-slate-400"><Images className="h-3.5 w-3.5" aria-hidden="true" />{p.photos.length} {p.photos.length === 1 ? "photo" : "photos"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > shown.length && (
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="btn btn-ghost">Show {Math.min(PAGE, filtered.length - shown.length)} more <span className="font-mono text-xs text-slate-500">({filtered.length - shown.length} left)</span></button>
            </div>
          )}
        </>
      )}

      <PersonDialog person={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function PersonDialog({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<Person | null>(null);
  const [saving, setSaving] = useState<number | "all" | null>(null);
  // full-resolution originals from Cloudflare R2, keyed by photo number (1-5); empty when none were stored
  const [originals, setOriginals] = useState<Record<number, { url: string; size: number }>>({});
  const personId = person?.id;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOriginals({});
    if (personId === undefined) return;
    let cancelled = false;
    adminFetch<{ originals: { slot: number; size: number; url: string }[] }>(`/api/admin/registrations/originals?id=${personId}`)
      .then((r) => { if (!cancelled) setOriginals(Object.fromEntries(r.originals.map((o) => [o.slot, { url: o.url, size: o.size }]))); })
      .catch(() => { /* no originals: the resized copies are used */ });
    return () => { cancelled = true; };
  }, [personId]);
  const hasOriginals = Object.keys(originals).length > 0;
  const sourceFor = (n: number) => originals[n + 1]?.url ?? photos[n];
  const mb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
  // start on the first photo whenever a different person is opened (adjusting state while rendering, not in an effect)
  if (person !== prev) { setPrev(person); setI(0); }
  const photos = person?.photos ?? [];
  const download = async (n: number) => {
    if (!person || saving !== null) return;
    setSaving(n);
    try { await savePhoto(sourceFor(n), `${fileBase(person.name)}-photo-${n + 1}`); }
    catch (e) { notify.error(e instanceof Error ? e.message : "Couldn't download that photo."); }
    setSaving(null);
  };
  const downloadAll = async () => {
    if (!person || saving !== null) return;
    setSaving("all");
    try {
      for (let n = 0; n < photos.length; n++) { await savePhoto(sourceFor(n), `${fileBase(person.name)}-photo-${n + 1}`); await new Promise((r) => setTimeout(r, 350)); }
      notify.info(`Downloaded ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`, { description: "Your browser may ask to allow multiple downloads." });
    } catch (e) { notify.error(e instanceof Error ? e.message : "Couldn't download the photos."); }
    setSaving(null);
  };
  const go = (d: number) => setI((n) => (photos.length ? (n + d + photos.length) % photos.length : 0));

  return (
    <Dialog.Root open={person !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/80 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto p-4 sm:place-items-center">
          <Dialog.Popup
            className="my-4 w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:translate-y-2 data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0"
            onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}
          >
            <div className="flex items-start gap-4 p-5 pb-4">
              <div className="min-w-0 flex-1">
                <Dialog.Title className="break-words font-display text-xl font-semibold text-white">{person?.name}</Dialog.Title>
                <Dialog.Description className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  {person && <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[.62rem] uppercase tracking-[.12em] ${ROLE_TONE[person.role] ?? ""}`}>{ROLE_LABEL[person.role] ?? person.role}</span>}
                  {person?.registration_status === "pending" && <span className="rounded-full border border-[#fbbf24]/50 px-2.5 py-0.5 font-mono text-[.62rem] uppercase tracking-[.12em] text-[#fbbf24]">Pending review</span>}
                  {person?.submitted_at && <span>Registered {new Date(person.submitted_at).toLocaleDateString()}</span>}
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
            </div>

            <div className="grid gap-0 border-t border-slate-700 lg:grid-cols-[1.15fr_1fr]">
              {/* Photos: the ones this person sent with their registration */}
              <div className="border-b border-slate-700 bg-slate-950/50 p-4 lg:border-b-0 lg:border-r">
                {photos.length === 0 ? (
                  <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-slate-600 text-slate-500"><span className="text-center"><ImageOff className="mx-auto h-8 w-8" aria-hidden="true" /><span className="mt-2 block text-sm">No photos were sent</span></span></div>
                ) : (
                  <>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img key={i} src={photos[i]} alt={`${person?.name}, photo ${i + 1} of ${photos.length}`} className="animate-fadeIn h-full w-full object-contain" />
                      {photos.length > 1 && (
                        <>
                          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-slate-950/70 text-white backdrop-blur transition-colors hover:bg-accent hover:text-accent-ink"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
                          <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-slate-950/70 text-white backdrop-blur transition-colors hover:bg-accent hover:text-accent-ink"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
                        </>
                      )}
                      <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2.5 py-1 font-mono text-[.68rem] tabular-nums text-slate-200 backdrop-blur">{i + 1} / {photos.length}</span>
                      <button type="button" onClick={() => download(i)} disabled={saving !== null} aria-label={`Download photo ${i + 1} in full resolution`} title={originals[i + 1] ? `Download the original (${mb(originals[i + 1].size)})` : "Download this photo"}
                        className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-slate-950/70 text-white backdrop-blur transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-60">
                        {saving === i ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                    <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="All photos">
                      {photos.map((src, n) => (
                        <li key={src}>
                          <button type="button" onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`} aria-current={n === i}
                            className={`block aspect-square w-full overflow-hidden rounded-lg border-2 transition-[border-color,opacity,transform] duration-200 ${n === i ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">{photos.length} of 5 photos sent</p>
                      <button type="button" onClick={downloadAll} disabled={saving !== null} className="btn btn-ghost btn-sm disabled:opacity-60">
                        {saving === "all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                        Download {photos.length > 1 ? `all ${photos.length}` : "photo"}
                      </button>
                    </div>
                    <p className={`mt-2 text-[.7rem] leading-snug ${hasOriginals ? "text-accent/80" : "text-slate-600"}`}>
                      {hasOriginals ? `Downloads are the original full-resolution files${originals[i + 1] ? ` (this one is ${mb(originals[i + 1].size)})` : ""}. The preview above is a lighter copy.` : "Only the resized copy (up to 800 px) was stored for this person, so downloads are that size."}
                    </p>
                  </>
                )}
              </div>

              {/* Everything the person entered on the registration form */}
              <div className="max-h-[70vh] overflow-y-auto p-5">
                <h3 className="mb-3 font-mono text-[.66rem] uppercase tracking-[.16em] text-slate-500">Registration form</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {([
                    ["First name", person?.first_name, false],
                    ["Last name", person?.last_name, false],
                    ["Gender", person?.gender, false],
                    ["Birthday", person?.birthday ? `${new Date(person.birthday).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}${age(person.birthday) !== null ? ` (${age(person.birthday)})` : ""}` : null, false],
                    ["Email", person?.email, true],
                    ["Student ID", person?.student_id, false],
                    ["Year level", person?.year_level, false],
                    ["Program", person?.program, true],
                    ["Section", person?.section, false],
                    ["Registered as", person ? ROLE_LABEL[person.role] ?? person.role : null, false],
                  ] as [string, string | null | undefined, boolean][]).map(([k, v, wide]) => (
                    <div key={k} className={wide ? "col-span-2" : ""}>
                      <dt className="font-mono text-[.64rem] uppercase tracking-[.14em] text-slate-500">{k}</dt>
                      <dd className={`mt-0.5 break-words ${v ? "text-slate-200" : "text-slate-600"}`}>{v || "Not provided"}</dd>
                    </div>
                  ))}
                </dl>

                {([["Hobbies", person?.hobbies], ["Likes", person?.likes]] as const).map(([label, list]) => (
                  <div key={label} className="mt-5">
                    <h3 className="font-mono text-[.64rem] uppercase tracking-[.14em] text-slate-500">{label}</h3>
                    {list && list.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-1.5">{list.map((h) => <li key={h} className="rounded-md border border-slate-600 px-2 py-0.5 text-xs text-slate-300">{h}</li>)}</ul>
                    ) : <p className="mt-1 text-sm text-slate-600">Not provided</p>}
                  </div>
                ))}

                <div className="mt-5">
                  <h3 className="font-mono text-[.64rem] uppercase tracking-[.14em] text-slate-500">About</h3>
                  {person?.about ? <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{person.about}</p> : <p className="mt-1 text-sm text-slate-600">Not provided</p>}
                </div>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
