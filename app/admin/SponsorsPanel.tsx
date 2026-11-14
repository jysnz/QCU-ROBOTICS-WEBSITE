"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@base-ui/react/dialog";
import NumberFlow from "@number-flow/react";
import { Building2, ChevronDown, HeartHandshake, Loader2, Pencil, Plus, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { notify } from "./notify";
import PhotoDropzone from "./PhotoDropzone";
import { sb } from "./supabase";

type Company = { id: number; company_name: string | null; image_url: string | null };
type Person = { id: number; name: string; image_url: string | null; company_id: number | null };

const BUCKET = "images";
const FOLDER = "Sponsor_pictures";
const input = "h-11 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-medium text-white outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.18)] focus-visible:outline-none";
const lbl = "mb-2 block font-mono text-[.7rem] font-medium uppercase tracking-[.16em] text-slate-400";
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; };

function Thumb({ src, name, className }: { src: string | null; name: string; className: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden border border-slate-600 bg-slate-800 font-display font-semibold text-slate-500 ${className}`}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain" />
      ) : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}

/* Sponsors: every company with its people underneath (this replaces the separate "Sponsor companies" and
   "Sponsor people" pages, since a person always belongs to a company). */
export default function SponsorsPanel() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<number | "none">>(new Set());
  const [companyDialog, setCompanyDialog] = useState<Company | "new" | null>(null);
  const [personDialog, setPersonDialog] = useState<{ person: Person | null; companyId: number | null } | null>(null);
  const [del, setDel] = useState<{ kind: "company"; company: Company; people: number } | { kind: "person"; person: Person } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      sb.from("sponsor_company").select("id, company_name, image_url").order("company_name", { ascending: true }),
      sb.from("sponsors").select("id, name, image_url, company_id").order("name", { ascending: true }),
    ]);
    if (c.error || p.error) { setError((c.error ?? p.error)!.message); return; }
    setError("");
    setCompanies((c.data ?? []) as Company[]);
    setPeople((p.data ?? []) as Person[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const byCompany = useMemo(() => {
    const m = new Map<number | "none", Person[]>();
    for (const p of people) { const k = p.company_id ?? "none"; if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); }
    return m;
  }, [people]);

  const cards = useMemo(() => {
    return (companies ?? []).map((c) => {
      const all = byCompany.get(c.id) ?? [];
      const nameHit = !q || (c.company_name ?? "").toLowerCase().includes(q);
      const shown = nameHit ? all : all.filter((p) => p.name.toLowerCase().includes(q));
      return { c, all, shown, visible: nameHit || shown.length > 0 };
    }).filter((x) => x.visible);
  }, [companies, byCompany, q]);

  const orphans = (byCompany.get("none") ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  const toggle = (k: number | "none") => setClosed((s) => { const n = new Set(s); if (!n.delete(k)) n.add(k); return n; });

  async function confirmDelete() {
    if (!del || deleting) return;
    setDeleting(true);
    let err: string | null = null;
    if (del.kind === "company") {
      // people reference the company, so they go first
      const a = await sb.from("sponsors").delete().eq("company_id", del.company.id);
      const b = a.error ? a : await sb.from("sponsor_company").delete().eq("id", del.company.id);
      err = b.error?.message ?? null;
    } else {
      err = (await sb.from("sponsors").delete().eq("id", del.person.id)).error?.message ?? null;
    }
    setDeleting(false);
    if (err) { notify.error(`Couldn't delete: ${err}`); setDel(null); return; }
    if (del.kind === "company") notify.deleted("Sponsor company deleted", { description: `${del.company.company_name}${del.people ? ` and ${del.people} ${del.people === 1 ? "person" : "people"}` : ""}` });
    else notify.deleted("Sponsor deleted", { description: del.person.name });
    setDel(null);
    await load();
  }

  const loading = companies === null;

  return (
    <section aria-labelledby="panel-title" className="pb-20">
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/60 p-6 sm:p-8" style={{ animation: "rise .6s var(--ease) both" }}>
        <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><HeartHandshake className="h-6 w-6" aria-hidden="true" /></span>
            <div>
              <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white">Sponsors</h1>
              <p className="mt-2 text-slate-400">The companies that support the team and the people who represent them, shown in the Sponsors section of the site.</p>
            </div>
          </div>
          <dl className="flex gap-3">
            {([["Companies", companies?.length ?? 0], ["People", people.length]] as const).map(([k, n]) => (
              <div key={k} className="min-w-28 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <dt className="text-xs text-slate-400">{k}</dt>
                <dd className="mt-1 font-display text-3xl font-bold leading-none tabular-nums text-white"><NumberFlow value={n} /></dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="sticky top-3 z-20 mb-5 rounded-2xl border border-slate-700 bg-slate-950/85 p-2 shadow-[0_10px_30px_rgba(0,0,0,.35)] backdrop-blur" style={{ animation: "rise .6s var(--ease) both", animationDelay: "80ms" }}>
        <label className="relative block">
          <span className="sr-only">Search companies and people</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies or people" className="h-11 w-full rounded-xl bg-slate-900 pl-11 pr-4 text-sm font-medium text-white outline-none transition-shadow placeholder:text-slate-500 focus-visible:shadow-[0_0_0_2px_rgba(200,245,96,.5)]" />
        </label>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}

      {loading ? (
        <div className="space-y-4" aria-hidden="true">{[...Array(3)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-700 bg-slate-900" style={{ animationDelay: `${i * 80}ms` }} />)}</div>
      ) : cards.length === 0 && orphans.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-slate-600 px-6 py-20 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/40 bg-accent/10 text-accent"><Building2 className="h-6 w-6" aria-hidden="true" /></span>
          <p className="mt-5 font-display text-lg font-semibold text-white">{companies.length === 0 ? "No sponsors yet" : "Nothing matches that search"}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-400">{companies.length === 0 ? "Add the first sponsor company, then add the people who represent it." : "Try a different name."}</p>
          {companies.length === 0 && <button type="button" onClick={() => setCompanyDialog("new")} className="btn btn-primary btn-sm mt-6"><Plus className="h-4 w-4" aria-hidden="true" /> Add company</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map(({ c, all, shown }, i) => {
            const open = !closed.has(c.id) || !!q;
            return (
              <section key={c.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60 transition-colors duration-200 hover:border-slate-600" style={{ animation: "rise .5s var(--ease) both", animationDelay: `${Math.min(i, 6) * 60}ms` }}>
                <div className="flex items-center gap-2 pr-3">
                  <button type="button" onClick={() => toggle(c.id)} aria-expanded={open} aria-controls={`sp-${c.id}`} className="group flex min-w-0 flex-1 items-center gap-4 px-4 py-4 text-left outline-none focus-visible:bg-slate-900">
                    <Thumb src={c.image_url} name={c.company_name ?? "?"} className="h-14 w-14 rounded-xl bg-white/5 p-1 text-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-display text-lg font-semibold text-white">{c.company_name || "Untitled company"}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400"><Users className="h-3.5 w-3.5" aria-hidden="true" />{all.length} {all.length === 1 ? "person" : "people"}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out-quint group-hover:text-white ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setCompanyDialog(c)} aria-label={`Edit ${c.company_name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => setDel({ kind: "company", company: c, people: all.length })} aria-label={`Delete ${c.company_name}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-[#f87171]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>

                <div id={`sp-${c.id}`} inert={!open} className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="min-h-0 overflow-hidden">
                    <ul className="grid gap-3 border-t border-slate-800 p-4 sm:grid-cols-2 xl:grid-cols-3">
                      {shown.map((p, j) => <PersonCard key={p.id} p={p} j={j} onEdit={() => setPersonDialog({ person: p, companyId: c.id })} onDelete={() => setDel({ kind: "person", person: p })} />)}
                      <li style={{ animation: "rise .4s var(--ease) both", animationDelay: `${Math.min(shown.length, 8) * 30}ms` }}>
                        <button type="button" onClick={() => setPersonDialog({ person: null, companyId: c.id })} className="flex h-16 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 text-sm font-medium text-slate-400 transition-[border-color,color,background-color] duration-200 hover:border-accent/60 hover:bg-accent/5 hover:text-accent">
                          <UserPlus className="h-4 w-4" aria-hidden="true" /> Add person
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            );
          })}

          {orphans.length > 0 && (
            <section className="rounded-2xl border border-dashed border-slate-600 p-4" style={{ animation: "rise .5s var(--ease) both" }}>
              <h2 className="font-display text-base font-semibold text-white">Not linked to a company <span className="ml-1 font-mono text-xs font-normal text-slate-500">{orphans.length}</span></h2>
              <p className="mt-1 text-sm text-slate-400">These people have no company, so they can&rsquo;t be shown properly on the site. Open one to choose a company.</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {orphans.map((p, j) => <PersonCard key={p.id} p={p} j={j} onEdit={() => setPersonDialog({ person: p, companyId: null })} onDelete={() => setDel({ kind: "person", person: p })} />)}
              </ul>
            </section>
          )}
        </div>
      )}

      {typeof document !== "undefined" && createPortal(
        <button type="button" onClick={() => setCompanyDialog("new")} className="btn btn-primary animate-fadeIn shadow-[0_10px_30px_rgba(0,0,0,.5)]" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 30 }}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add company
        </button>,
        document.body,
      )}

      <CompanyDialog value={companyDialog} onClose={() => setCompanyDialog(null)} onSaved={load} />
      <PersonDialog state={personDialog} companies={companies ?? []} onClose={() => setPersonDialog(null)} onSaved={load} />

      <Dialog.Root open={del !== null} onOpenChange={(o) => { if (!o && !deleting) setDel(null); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <Dialog.Title className="font-display text-xl font-semibold text-white">{del?.kind === "company" ? "Delete this company?" : "Delete this person?"}</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm text-slate-400">
                {del?.kind === "company"
                  ? <><span className="text-white">{del.company.company_name}</span>{del.people > 0 ? <> and its <span className="text-white">{del.people} {del.people === 1 ? "person" : "people"}</span></> : null} will be removed from the live website. This can&rsquo;t be undone.</>
                  : <><span className="text-white">{del?.person.name}</span>{" "}will be removed from the live website. This can&rsquo;t be undone.</>}
              </Dialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <Dialog.Close className="btn btn-ghost" disabled={deleting}>Cancel</Dialog.Close>
                <button type="button" onClick={confirmDelete} disabled={deleting} className="btn bg-[#ef4444] text-white hover:bg-[#f87171] disabled:opacity-60">{deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Delete</button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function PersonCard({ p, j, onEdit, onDelete }: { p: Person; j: number; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="group flex h-16 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 pl-2.5 pr-1.5 transition-[border-color,transform] duration-200 hover:border-slate-500" style={{ animation: "rise .4s var(--ease) both", animationDelay: `${Math.min(j, 8) * 30}ms` }}>
      <Thumb src={p.image_url} name={p.name} className="h-11 w-11 rounded-lg object-cover text-sm" />
      <span className="min-w-0 flex-1 break-words text-sm font-semibold text-white">{p.name}</span>
      <span className="flex gap-0.5 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button type="button" onClick={onEdit} aria-label={`Edit ${p.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${p.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-[#f87171]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
      </span>
    </li>
  );
}

const popup = "my-4 w-full max-w-lg rounded-2xl border border-slate-600 bg-slate-900 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:translate-y-2 data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0";
const backdrop = "fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0";
const viewport = "fixed inset-0 z-50 grid place-items-start justify-items-center overflow-y-auto p-4 sm:place-items-center";

function DialogHead({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string }) {
  return (
    <div className="flex items-start gap-4 p-6 pb-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/40 bg-accent/10 text-accent"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <Dialog.Title className="break-words font-display text-xl font-semibold text-white">{title}</Dialog.Title>
        <Dialog.Description className="mt-0.5 text-sm text-slate-400">{text}</Dialog.Description>
      </div>
      <Dialog.Close aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
    </div>
  );
}

function CompanyDialog({ value, onClose, onSaved }: { value: Company | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const editing = value !== null && value !== "new" ? value : null;
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(editing?.company_name ?? ""); setLogo(editing?.image_url ?? ""); setErr("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    if (!name.trim()) { setErr("Company name is required."); return; }
    setSaving(true); setErr("");
    const payload = { company_name: name.trim(), image_url: logo || null };
    const { error } = editing ? await sb.from("sponsor_company").update(payload).eq("id", editing.id) : await sb.from("sponsor_company").insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); notify.error(`Couldn't save: ${error.message}`); return; }
    if (editing) notify.updated("Sponsor company updated", { description: payload.company_name }); else notify.created("Sponsor company added", { description: payload.company_name });
    await onSaved();
    onClose();
  }

  return (
    <Dialog.Root open={value !== null} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={backdrop} />
        <Dialog.Viewport className={viewport}>
          <Dialog.Popup className={popup}>
            <DialogHead icon={Building2} title={editing ? editing.company_name || "Edit company" : "Add sponsor company"} text={editing ? "Update the company's name or logo." : "Add the company, then add the people who represent it."} />
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5 px-6 pb-6" noValidate>
              <div>
                <label className={lbl} htmlFor="sc-name">Company name <span className="text-accent">*</span></label>
                <input id="sc-name" className={`${input} ${err && !name.trim() ? "!border-[#f87171]" : ""}`} value={name} maxLength={100} onChange={(e) => { setName(e.target.value); if (err) setErr(""); }} placeholder="e.g. Acme Robotics" autoComplete="off" autoFocus={!editing} />
              </div>
              <div><span className={lbl}>Logo</span><PhotoDropzone value={logo} onChange={setLogo} name={name} folder={FOLDER} bucket={BUCKET} /></div>
              {err && <p role="alert" className="animate-fadeIn text-sm text-[#f87171]">{err}</p>}
              <div className="flex justify-end gap-3 border-t border-slate-700 pt-5">
                <Dialog.Close className="btn btn-ghost btn-sm" disabled={saving}>Cancel</Dialog.Close>
                <button type="submit" disabled={saving} className="btn btn-primary btn-sm min-w-28 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editing ? "Save changes" : "Add company"}</button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PersonDialog({ state, companies, onClose, onSaved }: { state: { person: Person | null; companyId: number | null } | null; companies: Company[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const editing = state?.person ?? null;
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(editing?.name ?? ""); setPhoto(editing?.image_url ?? ""); setCompany(state?.companyId ? String(state.companyId) : ""); setErr("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (saving) return;
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!company) { setErr("Choose the company this person represents."); return; }
    setSaving(true); setErr("");
    const payload = { name: name.trim(), image_url: photo || null, company_id: Number(company) };
    const { error } = editing ? await sb.from("sponsors").update(payload).eq("id", editing.id) : await sb.from("sponsors").insert(payload);
    setSaving(false);
    if (error) { setErr(error.message); notify.error(`Couldn't save: ${error.message}`); return; }
    const co = companies.find((c) => String(c.id) === company)?.company_name ?? undefined;
    if (editing) notify.updated("Sponsor updated", { description: `${payload.name}${co ? ` · ${co}` : ""}` }); else notify.created("Sponsor added", { description: `${payload.name}${co ? ` · ${co}` : ""}` });
    await onSaved();
    onClose();
  }

  return (
    <Dialog.Root open={state !== null} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={backdrop} />
        <Dialog.Viewport className={viewport}>
          <Dialog.Popup className={popup}>
            <DialogHead icon={UserPlus} title={editing ? editing.name : "Add sponsor person"} text={editing ? "Update their details or move them to another company." : "Add someone who represents a sponsor company."} />
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-5 px-6 pb-6" noValidate>
              <div>
                <label className={lbl} htmlFor="sp-company">Company <span className="text-accent">*</span></label>
                <select id="sp-company" value={company} onChange={(e) => { setCompany(e.target.value); if (err) setErr(""); }} className={`${input} ${err && !company ? "!border-[#f87171]" : ""}`}>
                  <option value="">Choose a company…</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl} htmlFor="sp-name">Full name <span className="text-accent">*</span></label>
                <input id="sp-name" className={`${input} ${err && !name.trim() ? "!border-[#f87171]" : ""}`} value={name} maxLength={80} onChange={(e) => { setName(e.target.value); if (err) setErr(""); }} placeholder="e.g. Maria Santos" autoComplete="off" autoFocus={!editing} />
              </div>
              <div><span className={lbl}>Photo</span><PhotoDropzone value={photo} onChange={setPhoto} name={name} folder={FOLDER} bucket={BUCKET} /></div>
              {err && <p role="alert" className="animate-fadeIn text-sm text-[#f87171]">{err}</p>}
              <div className="flex justify-end gap-3 border-t border-slate-700 pt-5">
                <Dialog.Close className="btn btn-ghost btn-sm" disabled={saving}>Cancel</Dialog.Close>
                <button type="submit" disabled={saving} className="btn btn-primary btn-sm min-w-28 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editing ? "Save changes" : "Add person"}</button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
