"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import NumberFlow from "@number-flow/react";
import { CalendarClock, Cake, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Download, FileImage, FileText, Loader2, Minus, Paperclip, Pencil, Plus, Search, Settings2, Trash2, Trophy, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { notify } from "./notify";
import { adminFetch, sb } from "./supabase";
import { cached } from "./cache";
import Assigners from "./Assigners";
import DateTimeField from "./DateTimeField";
import { canAssignTasks, isHead, useAdminRole } from "./useAdminRole";

type Person = { id: string; email: string; full_name: string | null; avatar_url: string | null };
type Status = "assigned" | "done";
type Task = { id: string; title: string; instructions: string | null; due_at: string | null; created_at: string; created_by: string };
type Assignee = { user_id: string; status: Status; done_at: string | null };
type Mine = Task & { assignees: Assignee[]; files: number };  // a task I assigned
type Todo = Task & { status: Status; done_at: string | null; files: number }; // a task assigned to me

const nameOf = (p?: Person) => p?.full_name || p?.email || "Someone";
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const overdue = (t: { due_at: string | null }) => !!t.due_at && new Date(t.due_at).getTime() < Date.now();
/** Tells the server to notify the people just assigned to a task. Best effort: a failed notification never blocks the task. */
const tellAssigned = (taskId: string, userIds: string[]) => {
  adminFetch("/api/admin/notify", { method: "POST", body: JSON.stringify({ event: "task-assigned", taskId, userIds }) }).catch(() => {});
};

/** True when a "YYYY-MM-DDTHH:mm" local time is still ahead of now. */
const isFuture = (v: string) => new Date(v).getTime() > Date.now();
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

function Avatar({ p, size = 9 }: { p?: Person; size?: 7 | 9 }) {
  const [broken, setBroken] = useState(false);
  const initial = (/[\p{L}\p{N}]/u.exec(nameOf(p))?.[0] ?? "?").toUpperCase();
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-slate-600 bg-slate-800 font-display font-semibold text-slate-300 ${size === 9 ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs"}`}>
      {p?.avatar_url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : initial}
    </span>
  );
}

function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-clip p-4">
          <Dialog.Popup className={`flex max-h-[calc(100svh-2rem)] w-full flex-col ${wide ? "max-w-xl" : "max-w-sm"} rounded-2xl border border-slate-600 bg-slate-900 p-6 outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.97] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0`}>
            <div className="flex shrink-0 items-start justify-between gap-4">
              <Dialog.Title className="font-display text-xl font-semibold text-white">{title}</Dialog.Title>
              <Dialog.Close aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></Dialog.Close>
            </div>
            {/* only the body scrolls, so the popup can never be scrolled off the screen */}
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const inputCls = "w-full rounded-xl border border-slate-600 bg-slate-950 px-4 text-sm text-white outline-none! transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent";

function Empty({ title, hint, icon: Icon = ClipboardList }: { title: string; hint: string; icon?: LucideIcon }) {
  return (
    <div className="tk-rise grid place-items-center rounded-2xl border border-dashed border-slate-600 px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-slate-500" aria-hidden="true" />
      <p className="mt-4 font-medium text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{hint}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="h-10 w-10 rounded-full bg-slate-800" />
          <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-slate-800" /><div className="h-3 w-1/2 rounded bg-slate-800" /></div>
        </div>
      ))}
    </div>
  );
}

function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [me, setMe] = useState("");
  const [mediaIds, setMediaIds] = useState<Set<string>>(new Set()); // accounts that belong to the Media team
  const [error, setError] = useState("");
  useEffect(() => {
    cached("overview-people", () => adminFetch<{ people: Person[]; me: string; mediaIds?: string[] }>("/api/admin/people"), 60_000)
      .then((b) => { setPeople(b.people); setMe(b.me); setMediaIds(new Set(b.mediaIds ?? [])); })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load teammates."));
  }, []);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  return { people, me, byId, error, mediaIds };
}

/* ───────────── Attachments (private Supabase Storage bucket "task-files") ───────────── */
const FILES_BUCKET = "task-files";
const MAX_FILES = 10;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED = /\.(png|jpe?g|gif|webp|avif|heic|heif|pdf|docx?)$/i; // pictures, PDFs and Word documents only
const ACCEPT = "image/*,.pdf,.doc,.docx";
const isImage = (mime: string | null, name = "") => (mime ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(name);
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const safeName = (n: string) => n.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/^[-.]+/, "").slice(-120) || "file";

type TaskFile = { id: string; path: string; name: string; size: number; mime: string | null; store?: "supabase" | "r2" };

/* Deletes stored files wherever they live: Supabase Storage (older files) or Cloudflare R2 (newer ones, via the server). */
async function removeStored(taskId: string, files: { path: string; store?: string }[]) {
  const supa = files.filter((f) => f.store !== "r2").map((f) => f.path);
  const r2 = files.filter((f) => f.store === "r2").map((f) => f.path);
  if (supa.length) await sb.storage.from(FILES_BUCKET).remove(supa);
  if (r2.length) { try { await adminFetch("/api/admin/task-files", { method: "DELETE", body: JSON.stringify({ taskId, keys: r2 }) }); } catch { /* the row is removed either way */ } }
}
type Linked = TaskFile & { url: string; dl: string };

/** Lists a task's files with short-lived links (images open inline, everything else downloads under its real name). */
function Attachments({ taskId }: { taskId: string }) {
  const [files, setFiles] = useState<Linked[] | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await sb.from("task_files").select("id, path, name, size, mime, store").eq("task_id", taskId).order("created_at");
      const rows = (data ?? []) as TaskFile[];
      if (!rows.length) { if (!off) setFiles([]); return; }
      const supa = rows.filter((r) => r.store !== "r2");
      const onR2 = rows.filter((r) => r.store === "r2");
      const links = new Map<string, { url: string; dl: string }>();
      await Promise.all([
        (async () => {
          if (!supa.length) return;
          const paths = supa.map((r) => r.path);
          const [view, dl] = await Promise.all([
            sb.storage.from(FILES_BUCKET).createSignedUrls(paths, 3600),
            sb.storage.from(FILES_BUCKET).createSignedUrls(paths, 3600, { download: true }),
          ]);
          supa.forEach((r, i) => links.set(r.id, { url: view.data?.[i]?.signedUrl ?? "", dl: dl.data?.[i]?.signedUrl ?? "" }));
        })(),
        (async () => {
          if (!onR2.length) return;
          try {
            const res = await adminFetch<{ files: { id: string; url: string; dl: string }[] }>(`/api/admin/task-files?taskId=${taskId}`);
            res.files.forEach((f) => links.set(f.id, { url: f.url, dl: f.dl }));
          } catch { /* shown without links below */ }
        })(),
      ]);
      if (off) return;
      setFiles(rows.map((r) => ({ ...r, ...(links.get(r.id) ?? { url: "", dl: "" }) })));
    })();
    return () => { off = true; };
  }, [taskId]);

  if (!files?.length) return null;
  const imgs = files.filter((f) => isImage(f.mime, f.name) && f.url);
  const others = files.filter((f) => !imgs.includes(f));
  return (
    <div className="mt-5">
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[.66rem] uppercase tracking-[.18em] text-slate-500"><Paperclip className="h-3 w-3" aria-hidden="true" /> Attachments · {files.length}</h3>
      {imgs.length > 0 && (
        <ul className="mb-2 grid grid-cols-3 gap-2">
          {imgs.map((f, i) => (
            <li key={f.id} className="tk-rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
              <a href={f.url} target="_blank" rel="noreferrer" title={f.name} className="group relative block aspect-square overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="space-y-1.5">
          {others.map((f, i) => (
            <li key={f.id} className="tk-rise" style={{ "--i": Math.min(i + imgs.length, 8) } as React.CSSProperties}>
              <a href={f.dl} className="tk-card flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300"><FileText className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{f.name}</span><span className="block text-xs text-slate-500">{fmtSize(f.size)}</span></span>
                <Download className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Submissions: files an assignee hands in when marking a task done ───────────── */
type Submission = TaskFile & { user_id: string };

/** Uploads one submitted file (Cloudflare R2 when it's on, otherwise Supabase Storage) and records it. Returns false if anything failed. */
async function uploadSubmission(taskId: string, uid: string, f: File): Promise<boolean> {
  const type = f.type || "application/octet-stream";
  let path = "";
  let store: "supabase" | "r2" = "supabase";
  try {
    const t = await adminFetch<{ r2?: boolean; key?: string; uploadUrl?: string }>("/api/admin/task-files", { method: "POST", body: JSON.stringify({ taskId, name: f.name, type, size: f.size, submission: true }) });
    if (t.r2 && t.uploadUrl && t.key) {
      const put = await fetch(t.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: f });
      if (!put.ok) return false;
      path = t.key; store = "r2";
    } else {
      path = `${taskId}/submissions/${uid}/${crypto.randomUUID()}-${safeName(f.name)}`;
      const up = await sb.storage.from(FILES_BUCKET).upload(path, f, { contentType: f.type || undefined });
      if (up.error) return false;
    }
  } catch { return false; }
  const rec = await sb.from("task_submissions").insert({ task_id: taskId, user_id: uid, path, name: f.name.slice(0, 255), size: f.size, mime: f.type || null, store });
  if (rec.error) { await removeStored(taskId, [{ path, store }]); return false; }
  return true;
}

/** Submitted files of a task: you see your own, the person who assigned the task sees everyone's (with names). */
function Submissions({ taskId, byId, showWho, title }: { taskId: string; byId: Map<string, Person>; showWho?: boolean; title: string }) {
  const [rows, setRows] = useState<(Submission & { url: string; dl: string })[] | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await sb.from("task_submissions").select("id, user_id, path, name, size, mime, store").eq("task_id", taskId).order("created_at");
      const list = (data ?? []) as Submission[];
      if (!list.length) { if (!off) setRows([]); return; }
      const links = new Map<string, { url: string; dl: string }>();
      const supa = list.filter((r) => r.store !== "r2");
      await Promise.all([
        (async () => {
          if (!supa.length) return;
          const paths = supa.map((r) => r.path);
          const [view, dl] = await Promise.all([
            sb.storage.from(FILES_BUCKET).createSignedUrls(paths, 3600),
            sb.storage.from(FILES_BUCKET).createSignedUrls(paths, 3600, { download: true }),
          ]);
          supa.forEach((r, i) => links.set(r.id, { url: view.data?.[i]?.signedUrl ?? "", dl: dl.data?.[i]?.signedUrl ?? "" }));
        })(),
        (async () => {
          if (!list.some((r) => r.store === "r2")) return;
          try {
            const res = await adminFetch<{ files: { id: string; url: string; dl: string }[] }>(`/api/admin/task-files?taskId=${taskId}`);
            res.files.forEach((f) => links.set(f.id, { url: f.url, dl: f.dl }));
          } catch { /* listed without links */ }
        })(),
      ]);
      if (!off) setRows(list.map((r) => ({ ...r, ...(links.get(r.id) ?? { url: "", dl: "" }) })));
    })();
    return () => { off = true; };
  }, [taskId]);
  if (!rows?.length) return null;
  return (
    <div className="mt-5">
      <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[.66rem] uppercase tracking-[.18em] text-slate-500"><Paperclip className="h-3 w-3" aria-hidden="true" /> {title} · {rows.length}</h3>
      <ul className="space-y-1.5">
        {rows.map((f) => (
          <li key={f.id}>
            <a href={isImage(f.mime, f.name) ? f.url : f.dl} target={isImage(f.mime, f.name) ? "_blank" : undefined} rel="noreferrer" className="tk-card flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300">{isImage(f.mime, f.name) ? <FileImage className="h-4 w-4" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{f.name}</span><span className="block truncate text-xs text-slate-500">{showWho ? `${nameOf(byId.get(f.user_id))} · ` : ""}{fmtSize(f.size)}</span></span>
              <Download className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TASK_COLS = "id, title, instructions, due_at, created_at, created_by";

/* ───────────── Assign: tasks I created, with who has finished them ───────────── */
type Draft = { key: number; title: string; instructions: string; due: string; suggestionId?: string; edit?: Mine };

function CreateDialog({ open, onClose, teammates: everyone, mediaIds, onCreated, draft }: { open: boolean; onClose: () => void; teammates: Person[]; mediaIds: Set<string>; onCreated: () => void; draft: Draft }) {
  const [title, setTitle] = useState(draft.title);
  const [instructions, setInstructions] = useState(draft.instructions);
  const [due, setDue] = useState(draft.due);
  const edit = draft.edit;
  // Tasks go to Media team members only. When editing, anyone already on the task stays listed so they can still be taken off.
  const teammates = useMemo(() => everyone.filter((p) => mediaIds.has(p.id) || !!edit?.assignees.some((a) => a.user_id === p.id)), [everyone, mediaIds, edit]);
  const [picked, setPicked] = useState<Set<string>>(new Set(edit?.assignees.map((a) => a.user_id) ?? []));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [existing, setExisting] = useState<TaskFile[]>([]); // files already on the task being edited
  const [removed, setRemoved] = useState<TaskFile[]>([]);   // ...that you took off; deleted when you save

  useEffect(() => {
    if (!edit) return;
    let off = false;
    sb.from("task_files").select("id, path, name, size, mime, store").eq("task_id", edit.id).order("created_at")
      .then(({ data }) => { if (!off) setExisting((data ?? []) as TaskFile[]); });
    return () => { off = true; };
  }, [edit]);

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED.test(f.name)) { notify.error(`${f.name} can't be attached`, { description: "Only pictures, PDF and Word (.docx) files are allowed." }); continue; }
      if (f.size > MAX_FILE_BYTES) { notify.error(`${f.name} is too large`, { description: `Files can be up to ${fmtSize(MAX_FILE_BYTES)}.` }); continue; }
      if (f.size === 0) continue;
      if (next.length + existing.length >= MAX_FILES) { notify.info(`Up to ${MAX_FILES} files per task`); break; }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? teammates.filter((p) => `${p.full_name ?? ""} ${p.email}`.toLowerCase().includes(q)) : teammates;
  }, [teammates, query]);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = shown.length > 0 && shown.every((p) => picked.has(p.id));
  const toggleAll = () => setPicked((s) => { const n = new Set(s); shown.forEach((p) => (allShown ? n.delete(p.id) : n.add(p.id))); return n; });
  const reset = () => { setTitle(""); setInstructions(""); setDue(""); setPicked(new Set()); setQuery(""); setFiles([]); };
  // a due date must be in the future; an existing task may keep the (possibly passed) one it already has
  const dueOk = due.length > 0 && ((!!edit && due === draft.due) || isFuture(due));
  const can = title.trim().length > 0 && instructions.trim().length > 0 && dueOk && picked.size > 0 && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!can) { if (due && !dueOk) notify.error("Pick a due time that hasn't passed yet."); return; }
    setBusy(true);
    const fields = { title: title.trim(), instructions: instructions.trim() || null, due_at: due ? new Date(due).toISOString() : null };
    let taskId: string;
    if (edit) {
      taskId = edit.id;
      const { error } = await sb.from("tasks").update(fields).eq("id", taskId);
      if (error) { notify.error("Couldn't save the task.", { description: error.message }); setBusy(false); return; }
      const before = new Set(edit.assignees.map((a) => a.user_id));
      const add = [...picked].filter((id) => !before.has(id));
      const drop = [...before].filter((id) => !picked.has(id));
      if (add.length) {
        const { error: e2 } = await sb.from("task_assignees").insert(add.map((user_id) => ({ task_id: taskId, user_id })));
        if (e2) { notify.error("Couldn't add the new people.", { description: e2.message }); setBusy(false); return; }
        tellAssigned(taskId, add);
      }
      if (drop.length) {
        const { error: e3 } = await sb.from("task_assignees").delete().eq("task_id", taskId).in("user_id", drop);
        if (e3) { notify.error("Couldn't remove those people.", { description: e3.message }); setBusy(false); return; }
      }
      if (removed.length) {
        await removeStored(taskId, removed);
        await sb.from("task_files").delete().in("id", removed.map((f) => f.id));
      }
    } else {
      const { data: task, error } = await sb.from("tasks").insert(fields).select("id").single();
      if (error || !task) { notify.error("Couldn't create the task.", { description: error?.message }); setBusy(false); return; }
      taskId = task.id;
      const { error: e2 } = await sb.from("task_assignees").insert([...picked].map((user_id) => ({ task_id: taskId, user_id })));
      if (e2) {
        await sb.from("tasks").delete().eq("id", taskId); // don't leave a task nobody can see
        notify.error("Couldn't assign the task.", { description: e2.message });
        setBusy(false);
        return;
      }
      tellAssigned(taskId, [...picked]);
      if (draft.suggestionId) await sb.from("task_suggestions").update({ status: "assigned", task_id: taskId }).eq("id", draft.suggestionId); // the system's suggestion is now a real task
    }
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setStage(`Uploading ${i + 1} of ${files.length}…`);
      // New files go to the private Cloudflare R2 bucket through a short-lived upload link; if R2 isn't switched on
      // yet the server says so and the file goes to Supabase Storage as before.
      let path = "";
      let store: "supabase" | "r2" = "supabase";
      try {
        const type = f.type || "application/octet-stream";
        const t = await adminFetch<{ r2?: boolean; key?: string; uploadUrl?: string }>("/api/admin/task-files", { method: "POST", body: JSON.stringify({ taskId, name: f.name, type, size: f.size }) });
        if (t.r2 && t.uploadUrl && t.key) {
          const put = await fetch(t.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: f });
          if (!put.ok) { failed++; continue; }
          path = t.key; store = "r2";
        } else {
          path = `${taskId}/${crypto.randomUUID()}-${safeName(f.name)}`;
          const up = await sb.storage.from(FILES_BUCKET).upload(path, f, { contentType: f.type || undefined });
          if (up.error) { failed++; continue; }
        }
      } catch { failed++; continue; }
      const rec = await sb.from("task_files").insert({ task_id: taskId, path, name: f.name.slice(0, 255), size: f.size, mime: f.type || null, store });
      if (rec.error) { failed++; await removeStored(taskId, [{ path, store }]); }
    }
    setStage("");
    if (failed) notify.error(`${failed} ${failed === 1 ? "file" : "files"} didn't upload`, { description: edit ? "The rest of your changes were saved. Try attaching them again." : "The task was still assigned. You can recreate it to attach them again." });
    if (edit) notify.updated(title.trim(), { description: "Task updated." });
    else notify.created(title.trim(), { description: `Assigned to ${picked.size} ${picked.size === 1 ? "person" : "people"}${files.length - failed > 0 ? ` with ${files.length - failed} ${files.length - failed === 1 ? "file" : "files"}` : ""}.` });
    setBusy(false);
    reset();
    onCreated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Edit task" : "Assign a task"} wide>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Title <span className="text-[#f87171]" aria-hidden="true">*</span></span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus required aria-required="true" placeholder="e.g. Edit the match recap video" className={`${inputCls} h-11`} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Instructions <span className="text-[#f87171]" aria-hidden="true">*</span></span>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={5000} rows={4} required aria-required="true" placeholder="What needs to be done?" className={`${inputCls} resize-y py-3`} />
        </label>
        <div>
          <label htmlFor="task-due" className="mb-1.5 block text-xs font-medium text-slate-400">Due <span className="text-[#f87171]" aria-hidden="true">*</span></label>
          <DateTimeField id="task-due" value={due} onChange={setDue} minToday required />
          {due && !dueOk && <p role="alert" className="mt-1.5 text-xs text-[#f87171]">That time has already passed. Pick a later time.</p>}
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Attachments <span className="text-slate-600">(optional · pictures, PDF or Word files, up to {fmtSize(MAX_FILE_BYTES)} each)</span></span>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-[border-color,background-color] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${dragging ? "border-accent bg-accent/[.06]" : "border-slate-600 hover:border-slate-400"}`}
          >
            <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <Paperclip className={`h-5 w-5 transition-transform duration-200 ${dragging ? "-translate-y-0.5 text-accent" : "text-slate-400"}`} aria-hidden="true" />
            <span className="text-sm text-slate-300"><span className="font-medium text-accent">Choose files</span> or drop them here</span>
          </label>
          {existing.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {existing.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                  {isImage(f.mime, f.name) ? <FileImage className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => { setExisting((x) => x.filter((y) => y.id !== f.id)); setRemoved((x) => [...x, f]); }} aria-label={`Remove ${f.name}`} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`} className="tk-rise flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2">
                  {isImage(f.type, f.name) ? <FileImage className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">{fmtSize(f.size)}</span>
                  <button type="button" onClick={() => setFiles((s) => s.filter((x) => x !== f))} aria-label={`Remove ${f.name}`} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <fieldset>
          <legend className="mb-1.5 flex w-full items-center justify-between text-xs font-medium text-slate-400">
            <span>Assign to <span className="font-mono text-slate-500">{picked.size} selected</span></span>
            <button type="button" onClick={toggleAll} className="text-accent hover:underline">{allShown ? "Clear" : "Select all"}</button>
          </legend>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search media team" aria-label="Search media team" className={`${inputCls} h-10 pl-10`} />
          </div>
          <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/50 p-1.5">
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">{teammates.length === 0 ? "No Media team accounts yet. A media member's registration email must match their admin account's email." : "No one matches."}</li>}
            {shown.map((p) => {
              const on = picked.has(p.id);
              return (
                <li key={p.id}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${on ? "bg-accent/[.08]" : "hover:bg-slate-800/70"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="peer sr-only" />
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${on ? "border-accent bg-accent text-accent-ink" : "border-slate-500"}`}>{on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}</span>
                    <Avatar p={p} size={7} />
                    <span className="min-w-0"><span className="block truncate text-sm text-white">{nameOf(p)}</span>{p.full_name && <span className="block truncate text-xs text-slate-500">{p.email}</span>}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="submit" disabled={!can} className="btn btn-primary disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {stage || (edit ? "Save changes" : picked.size > 0 ? `Assign to ${picked.size}` : "Assign")}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────── Birthdays: ready-made tasks for pubmats and monthly celebration posts ───────────── */
type Celebrant = { id: number; name: string; birthday: string | null; role: string; registration_status: string | null };
type Bday = { id: number; name: string; role: string; month: number; day: number; next: Date; days: number };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ROLE_WORD: Record<string, string> = { member: "member", media: "media team member", player: "player" };
const shortDate = (m: number, d: number) => `${MONTHS[m].slice(0, 3)} ${d}`;

function toBdays(rows: Celebrant[]): Bday[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out: Bday[] = [];
  for (const r of rows) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.birthday ?? "");
    if (!m || r.registration_status === "pending") continue;
    const month = +m[2] - 1, day = +m[3];
    let next = new Date(today.getFullYear(), month, day);
    if (next < today) next = new Date(today.getFullYear() + 1, month, day);
    out.push({ id: r.id, name: r.name, role: r.role, month, day, next, days: Math.round((next.getTime() - today.getTime()) / 86400000) });
  }
  return out;
}
/** A deadline in local time for a datetime-local input, or "" if it has already passed. */
const futureOrBlank = (d: Date) => (d.getTime() > Date.now() ? toLocalInput(d) : "");

function BirthdayPanel({ titles, onDraft }: { titles: Set<string>; onDraft: (d: Omit<Draft, "key">) => void }) {
  const [rows, setRows] = useState<Celebrant[] | null>(null);
  const now = new Date();
  const [month, setMonth] = useState((now.getMonth() + 1) % 12); // planning ahead: default to next month

  useEffect(() => {
    adminFetch<{ registrations: Celebrant[] }>("/api/admin/registrations").then((b) => setRows(b.registrations)).catch(() => setRows([]));
  }, []);

  const all = useMemo(() => toBdays(rows ?? []), [rows]);
  const soon = useMemo(() => all.filter((b) => b.days <= 30).sort((a, b) => a.days - b.days), [all]);
  const inMonth = useMemo(() => all.filter((b) => b.month === month).sort((a, b) => a.day - b.day || a.name.localeCompare(b.name)), [all, month]);
  if (rows === null || all.length === 0) return null;

  const pubmatTitle = (b: Bday) => `Create a birthday pubmat for ${b.name}`;
  const bulkTitle = `Post the ${MONTHS[month]} birthday celebration`;
  const monthYear = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();

  function pubmat(b: Bday) {
    const due = new Date(b.next); due.setDate(due.getDate() - 1); due.setHours(18, 0, 0, 0);
    const day = new Date(b.next); day.setHours(8, 0, 0, 0);
    onDraft({
      title: pubmatTitle(b),
      instructions: `Make a birthday pubmat for ${b.name} (${ROLE_WORD[b.role] ?? "teammate"}). Their birthday is ${shortDate(b.month, b.day)}.\n\nUse their photo from Informations and have it ready to post on the day.`,
      due: futureOrBlank(due) || futureOrBlank(day),
    });
  }
  function bulk() {
    const first = new Date(monthYear, month, 1, 8, 0, 0, 0);
    const before = new Date(monthYear, month, 0, 18, 0, 0, 0); // evening before the 1st
    onDraft({
      title: bulkTitle,
      instructions: `Post one celebration for everyone with a birthday in ${MONTHS[month]}:\n\n${inMonth.map((b) => `• ${b.name} — ${shortDate(b.month, b.day)}`).join("\n")}\n\nShow all of them in a single post with their photos.`,
      due: futureOrBlank(before) || futureOrBlank(first),
    });
  }

  return (
    <Collapsible icon={Cake} title="Birthdays" badge={soon.length} summary={soon.length ? `${soon.length} in the next 30 days · monthly celebration post` : "None in the next 30 days · monthly celebration post"}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white">Birthdays coming up</h2>
          <p className="mt-0.5 text-xs text-slate-400">Next 30 days. Make a pubmat task for each.</p>
          {soon.length === 0 ? <p className="mt-4 text-sm text-slate-500">No birthdays in the next 30 days.</p> : (
            <ul className="mt-3 space-y-1">
              {soon.map((b) => {
                const has = titles.has(pubmatTitle(b));
                return (
                  <li key={b.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{b.name}</span><span className="block text-xs text-slate-400">{shortDate(b.month, b.day)} · {b.days === 0 ? "today" : b.days === 1 ? "tomorrow" : `in ${b.days} days`}</span></span>
                    {has ? <span className="inline-flex items-center gap-1 text-xs text-accent"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Task made</span>
                      : <button type="button" onClick={() => pubmat(b)} className="btn btn-ghost btn-sm shrink-0">Pubmat task</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-700 pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <h2 className="font-display text-base font-semibold text-white">Monthly celebration post</h2>
          <label className="mt-3 block">
            <span className="sr-only">Month</span>
            <select value={month} onChange={(e) => setMonth(+e.target.value)} className="h-10 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none! focus-visible:border-accent">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-400">{inMonth.length === 0 ? `No birthdays in ${MONTHS[month]}.` : `${inMonth.length} ${inMonth.length === 1 ? "birthday" : "birthdays"}: ${inMonth.slice(0, 3).map((b) => b.name.split(" ")[0]).join(", ")}${inMonth.length > 3 ? ` +${inMonth.length - 3}` : ""}`}</p>
          {titles.has(bulkTitle) ? <p className="mt-3 inline-flex items-center gap-1 text-xs text-accent"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Task made</p>
            : <button type="button" disabled={inMonth.length === 0} onClick={bulk} className="btn btn-primary btn-sm mt-3 w-full disabled:opacity-50">Create bulk post task</button>}
        </div>
      </div>
    </Collapsible>
  );
}

/* ───────────── Shared bits ───────────── */
type Tone = "late" | "soon" | "ok" | "none";
const TONE: Record<Tone, string> = {
  late: "border-[#ef4444]/40 bg-[#ef4444]/10 text-[#f87171]",
  soon: "border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]",
  ok: "border-slate-600 text-slate-300",
  none: "border-slate-700 text-slate-500",
};
const dayGap = (d: Date) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86400000);
};
function dueInfo(due: string | null, finished = false): { label: string; tone: Tone } {
  if (!due) return { label: "No due date", tone: "none" };
  const d = new Date(due);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const gap = dayGap(d);
  if (finished) return { label: `Due ${fmtDay(due)}`, tone: "none" };
  if (d.getTime() < Date.now()) return { label: gap === 0 ? `Overdue · today ${time}` : gap === -1 ? "Overdue · yesterday" : `Overdue · ${-gap} days ago`, tone: "late" };
  if (gap === 0) return { label: `Due today, ${time}`, tone: "soon" };
  if (gap === 1) return { label: `Due tomorrow, ${time}`, tone: "soon" };
  if (gap < 7) return { label: `Due ${d.toLocaleDateString(undefined, { weekday: "long" })}`, tone: "ok" };
  return { label: `Due ${fmtDay(due)}`, tone: "ok" };
}

function Chip({ due, finished }: { due: string | null; finished?: boolean }) {
  const { label, tone } = dueInfo(due, finished);
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}><CalendarClock className="h-3 w-3" aria-hidden="true" />{label}</span>;
}

/* Fills from empty when it first appears, so progress reads as something earned. */
function Progress({ done, total }: { done: number; total: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const pct = total ? done / total : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Completed">
      <span className="block h-full origin-left rounded-full bg-accent transition-transform duration-700 ease-out-quint motion-reduce:transition-none" style={{ transform: `scaleX(${on ? pct : 0})` }} />
    </span>
  );
}

function AvatarStack({ ids, byId, max = 4 }: { ids: string[]; byId: Map<string, Person>; max?: number }) {
  return (
    <span className="flex -space-x-2">
      {ids.slice(0, max).map((id) => <span key={id} className="rounded-full ring-2 ring-slate-900" title={nameOf(byId.get(id))}><Avatar p={byId.get(id)} size={7} /></span>)}
      {ids.length > max && <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-800 text-[.65rem] font-semibold text-slate-300 ring-2 ring-slate-900">+{ids.length - max}</span>}
    </span>
  );
}

/* Tabs with a pill that slides to the selected one. */
function SegTabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count: number; warn?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  const i = Math.max(0, tabs.findIndex((t) => t.id === value));
  return (
    <div className="relative grid w-full rounded-xl border border-slate-600 bg-slate-900 p-1 sm:w-fit" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} role="tablist" aria-label={label}>
      <span className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-lg bg-accent transition-transform duration-300 ease-out-quint motion-reduce:transition-none" style={{ width: `calc((100% - .5rem) / ${tabs.length})`, transform: `translateX(${i * 100}%)` }} aria-hidden="true" />
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.id)} className={`relative z-10 h-10 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors duration-200 sm:px-5 ${on ? "text-accent-ink" : "text-slate-300 hover:text-white"}`}>
            {t.label}
            <span className={`ml-2 font-mono text-xs transition-colors ${on ? "text-accent-ink/70" : t.warn ? "text-[#f87171]" : "text-slate-500"}`}>{t.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/* A list row that rises in, and folds away (so the rows below slide up) when it leaves. */
function Row({ i, leaving, children }: { i: number; leaving?: boolean; children: React.ReactNode }) {
  return (
    <li className={`grid transition-[grid-template-rows,opacity] duration-[380ms] ease-out-quint motion-reduce:transition-none ${leaving ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="-mx-1 -mt-1 min-h-0 overflow-hidden px-1 pt-1">
        <div className="tk-rise pb-3" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>{children}</div>
      </div>
    </li>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "late" }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`font-display text-2xl font-bold tabular-nums ${tone === "late" && value > 0 ? "text-[#f87171]" : "text-white"}`}><NumberFlow value={value} /></dd>
    </div>
  );
}

/* A compact, collapsed-by-default card: header shows what's inside, the body opens on demand. */
function Collapsible({ icon: Icon, title, summary, badge, accent, children }: { icon: LucideIcon; title: string; summary: string; badge?: number; accent?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label={title} className={`mb-3 overflow-hidden rounded-2xl border ${accent ? "border-accent/40 bg-accent/[.04]" : "border-slate-700 bg-slate-900/60"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-white/[.02] focus-visible:bg-white/[.04]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Icon className="h-4 w-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-semibold text-white">{title}</span>
          <span className="block truncate text-xs text-slate-400">{summary}</span>
        </span>
        {badge ? <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[.68rem] font-bold leading-none text-accent-ink">{badge}</span> : null}
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out-quint ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={!open}>
        <div className="min-h-0 overflow-hidden"><div className="border-t border-slate-700/70 p-4 pt-3">{children}</div></div>
      </div>
    </section>
  );
}

/* ───────────── Competition tasks the system prepared, waiting for the media head ───────────── */
type Suggestion = { id: string; title: string; instructions: string | null; due_at: string | null; competitions: { title: string; date: string | null } | null };

function SuggestionsPanel({ bump, onAssign }: { bump: number; onAssign: (s: Suggestion) => void }) {
  const [rows, setRows] = useState<Suggestion[] | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let off = false;
    sb.from("task_suggestions").select("id, title, instructions, due_at, competitions(title, date)").eq("status", "pending").order("due_at", { ascending: true, nullsFirst: false })
      .then(({ data }) => { if (!off) setRows((data ?? []) as unknown as Suggestion[]); });
    return () => { off = true; };
  }, [bump]);

  const groups = useMemo(() => {
    const m = new Map<string, { date: string | null; rows: Suggestion[] }>();
    for (const r of rows ?? []) {
      const k = r.competitions?.title ?? "Competition";
      if (!m.has(k)) m.set(k, { date: r.competitions?.date ?? null, rows: [] });
      m.get(k)!.rows.push(r);
    }
    return [...m];
  }, [rows]);
  if (!rows?.length) return null;

  async function dismiss(s: Suggestion) {
    const { error } = await sb.from("task_suggestions").update({ status: "dismissed" }).eq("id", s.id);
    if (error) { notify.error("That didn't save."); return; }
    setLeaving((x) => new Set(x).add(s.id));
    setTimeout(() => { setRows((p) => (p ?? []).filter((r) => r.id !== s.id)); setLeaving((x) => { const n = new Set(x); n.delete(s.id); return n; }); }, 380);
  }

  let n = 0;
  return (
    <Collapsible icon={Trophy} accent title="Competition coming up" badge={rows.length} summary={`The system prepared ${rows.length} ${rows.length === 1 ? "task" : "tasks"} for the media team. Pick who does each one.`}>
      <div>
        {groups.map(([title, g]) => (
          <div key={title} className="mb-2">
            <h3 className="mb-2 px-1 text-sm font-medium text-white">{title}{g.date && <span className="ml-2 font-mono text-xs font-normal text-slate-500">{g.date}</span>}</h3>
            <ul>
              {g.rows.map((s) => (
                <Row key={s.id} i={n++} leaving={leaving.has(s.id)}>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{s.title}</span>
                      <span className="mt-1.5 block"><Chip due={s.due_at} /></span>
                    </span>
                    <button type="button" onClick={() => onAssign(s)} className="btn btn-primary btn-sm shrink-0">Assign</button>
                    <button type="button" onClick={() => dismiss(s)} aria-label={`Not needed: ${s.title}`} title="Not needed" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </Row>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}

/* ───────────── Templates: what the system prepares for each competition (media head / super admin) ───────────── */
type Tpl = { key: string; title: string; instructions: string | null; days_offset: number; due_time: string; enabled: boolean; sort: number };
type When = "before" | "on" | "after";
const whenOf = (d: number): When => (d < 0 ? "before" : d > 0 ? "after" : "on");
const hhmm = (t: string) => t.slice(0, 5);

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 motion-reduce:transition-none ${on ? "border-accent bg-accent" : "border-slate-500 bg-slate-800"}`}>
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform duration-200 ease-out-quint motion-reduce:transition-none ${on ? "translate-x-5 bg-accent-ink" : "bg-slate-300"}`} />
    </button>
  );
}

/* What the system will fill in for a real competition; used for the live preview. */
const SAMPLE = { competition: "VEX National Championship", date: "March 14-15, 2026", location: "Manila" };
const fillSample = (s: string) => s.replace(/\{competition\}/g, SAMPLE.competition).replace(/\{date\}/g, SAMPLE.date).replace(/\{location\}/g, SAMPLE.location);
const TOKENS = ["{competition}", "{date}", "{location}"] as const;
const clock = (t: string) => new Date(`2000-01-01T${hhmm(t)}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const timing = (d: number, t: string) => `${d === 0 ? "On the day" : `${Math.abs(d)} ${Math.abs(d) === 1 ? "day" : "days"} ${d < 0 ? "before" : "after"}`} · ${clock(t)}`;

function TemplateCard({ tpl, i, open, onToggle, onChanged }: { tpl: Tpl; i: number; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const [title, setTitle] = useState(tpl.title);
  const [instructions, setInstructions] = useState(tpl.instructions ?? "");
  const [when, setWhen] = useState<When>(whenOf(tpl.days_offset));
  const [days, setDays] = useState(Math.abs(tpl.days_offset) || 1);
  const [time, setTime] = useState(hhmm(tpl.due_time));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [gone, setGone] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"title" | "body">("body");

  const offset = when === "on" ? 0 : when === "before" ? -days : days;
  const dirty = title.trim() !== tpl.title || (instructions.trim() || null) !== (tpl.instructions || null) || offset !== tpl.days_offset || time !== hhmm(tpl.due_time);

  function discard() {
    setTitle(tpl.title); setInstructions(tpl.instructions ?? ""); setWhen(whenOf(tpl.days_offset)); setDays(Math.abs(tpl.days_offset) || 1); setTime(hhmm(tpl.due_time));
  }
  /* Drops a placeholder into whichever field you were last typing in, at the cursor. */
  function insert(tok: string) {
    const inTitle = lastField.current === "title";
    const el = inTitle ? titleRef.current : bodyRef.current;
    const cur = inTitle ? title : instructions;
    if (!el) return;
    const a = el.selectionStart ?? cur.length, b = el.selectionEnd ?? a;
    (inTitle ? setTitle : setInstructions)(cur.slice(0, a) + tok + cur.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tok.length, a + tok.length); });
  }

  async function save() {
    if (!title.trim() || !time) return;
    setBusy(true);
    const { error } = await sb.from("competition_task_templates").update({ title: title.trim(), instructions: instructions.trim() || null, days_offset: offset, due_time: time }).eq("key", tpl.key);
    setBusy(false);
    if (error) { notify.error("Couldn't save that template.", { description: error.message }); return; }
    notify.updated(title.trim(), { description: "Saved. It applies to tasks prepared from now on." });
    onChanged();
  }
  async function toggle(v: boolean) {
    const { error } = await sb.from("competition_task_templates").update({ enabled: v }).eq("key", tpl.key);
    if (error) { notify.error("That didn't save."); return; }
    onChanged();
  }
  async function remove() {
    const { error } = await sb.from("competition_task_templates").delete().eq("key", tpl.key);
    if (error) { notify.error("Couldn't delete that template."); return; }
    notify.deleted(tpl.title);
    setGone(true);
    setTimeout(onChanged, 380);
  }

  return (
    <li className={`grid transition-[grid-template-rows,opacity] duration-[380ms] ease-out-quint motion-reduce:transition-none ${gone ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
      <div className="-mx-1 min-h-0 overflow-hidden px-1">
        <div className="tk-rise pb-2.5" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
          <div className={`rounded-xl border transition-colors duration-200 ${open ? "border-slate-500 bg-slate-950/60" : dirty ? "border-accent/50 bg-slate-950/40" : "border-slate-700 bg-slate-950/40 hover:border-slate-600"}`}>
            {/* summary row: click to open, the switch turns the template on or off */}
            <div className="flex items-center gap-3 p-3">
              <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-out-quint motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-2 text-sm font-medium transition-colors ${tpl.enabled ? "text-white" : "text-slate-500"}`}>
                    <span className="truncate">{tpl.title}</span>
                    {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Unsaved changes" aria-label="Unsaved changes" />}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock className="h-3 w-3" aria-hidden="true" />{timing(tpl.days_offset, tpl.due_time)}{!tpl.enabled && <span className="text-slate-500"> · Off</span>}</span>
                </span>
              </button>
              <Switch on={tpl.enabled} onChange={toggle} label={tpl.enabled ? `Turn off ${tpl.title}` : `Turn on ${tpl.title}`} />
            </div>

            {/* editor: folds open under the row */}
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out-quint motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="min-h-0 overflow-hidden" inert={!open}>
                <div className="space-y-4 border-t border-slate-700 p-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-400">Task title</span>
                    <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => { lastField.current = "title"; }} maxLength={200} className={`${inputCls} h-10`} />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-400">Instructions</span>
                    <textarea ref={bodyRef} value={instructions} onChange={(e) => setInstructions(e.target.value)} onFocus={() => { lastField.current = "body"; }} maxLength={2000} rows={3} placeholder="What needs to be done?" className={`${inputCls} resize-y py-2.5`} />
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-slate-500">Insert</span>
                    {TOKENS.map((t) => (
                      <button key={t} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(t)} className="rounded-md border border-slate-600 px-2 py-1 font-mono text-xs text-slate-300 transition-colors hover:border-accent hover:text-accent">{t}</button>
                    ))}
                  </div>

                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-slate-400">Due</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-lg border border-slate-600 bg-slate-950 p-0.5" role="radiogroup" aria-label="Before, on or after the competition">
                        {(["before", "on", "after"] as const).map((w) => (
                          <button key={w} type="button" role="radio" aria-checked={when === w} onClick={() => setWhen(w)} className={`h-8 rounded-md px-3 text-xs font-semibold transition-colors duration-200 ${when === w ? "bg-accent text-accent-ink" : "text-slate-300 hover:text-white"}`}>{w === "on" ? "On the day" : w === "before" ? "Before" : "After"}</button>
                        ))}
                      </div>
                      {when !== "on" && (
                        <div className="inline-flex items-center rounded-lg border border-slate-600 bg-slate-950">
                          <button type="button" onClick={() => setDays((d) => Math.max(1, d - 1))} disabled={days <= 1} aria-label="One day less" className="grid h-8 w-8 place-items-center text-slate-300 transition-colors hover:text-white disabled:opacity-30"><Minus className="h-3.5 w-3.5" aria-hidden="true" /></button>
                          <span className="min-w-14 text-center text-sm tabular-nums text-white">{days} {days === 1 ? "day" : "days"}</span>
                          <button type="button" onClick={() => setDays((d) => Math.min(60, d + 1))} disabled={days >= 60} aria-label="One day more" className="grid h-8 w-8 place-items-center text-slate-300 transition-colors hover:text-white disabled:opacity-30"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
                        </div>
                      )}
                      <span className="text-xs text-slate-500">at</span>
                      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time (Manila)" className="h-8 rounded-lg border border-slate-600 bg-slate-950 px-2 text-sm text-white outline-none! transition-colors hover:border-slate-500 focus-visible:border-accent [color-scheme:dark]" />
                      <span className="text-xs text-slate-500">Manila time</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3">
                    <span className="mb-1.5 block font-mono text-[.62rem] uppercase tracking-[.16em] text-slate-500">Preview</span>
                    <p className="break-words text-sm font-medium text-white">{fillSample(title) || "Untitled task"}</p>
                    {instructions.trim() && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-400">{fillSample(instructions)}</p>}
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="h-3 w-3" aria-hidden="true" />{timing(offset, time)}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {confirm ? (
                      <>
                        <span className="text-sm text-slate-400">Delete this template?</span>
                        <span className="flex gap-2">
                          <button type="button" onClick={() => setConfirm(false)} className="btn btn-ghost btn-sm">Keep</button>
                          <button type="button" onClick={remove} className="btn btn-sm bg-[#ef4444] text-white hover:bg-[#f87171]">Delete</button>
                        </span>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setConfirm(true)} aria-label={`Delete template ${tpl.title}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-[#f87171]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                        <span className="flex gap-2">
                          {dirty && <button type="button" onClick={discard} className="btn btn-ghost btn-sm">Discard</button>}
                          <button type="button" onClick={save} disabled={!dirty || busy || !title.trim()} className="btn btn-primary btn-sm disabled:opacity-40">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save changes</button>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function TemplatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Tpl[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from("competition_task_templates").select("key, title, instructions, days_offset, due_time, enabled, sort").order("sort").order("created_at");
    setRows((data ?? []) as Tpl[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) load();
    else setOpenKey(null);
  }, [open, load]);

  async function add() {
    setAdding(true);
    const { data, error } = await sb.from("competition_task_templates").insert({ title: "New task for {competition}", instructions: "", days_offset: 0, sort: (rows ?? []).reduce((m, r) => Math.max(m, r.sort), 0) + 1 }).select("key").single();
    setAdding(false);
    if (error || !data) { notify.error("Couldn't add a template.", { description: error?.message }); return; }
    await load();
    setOpenKey(data.key); // straight into editing it
  }

  const on = (rows ?? []).filter((r) => r.enabled).length;
  return (
    <Modal open={open} onClose={onClose} title="Competition task templates" wide>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">When a competition is coming up, the system prepares one task from each template that is on. Changes apply to tasks prepared from now on, not ones already waiting.</p>
      {rows && rows.length > 0 && <p className="mt-3 font-mono text-[.66rem] uppercase tracking-[.16em] text-slate-500">{rows.length} {rows.length === 1 ? "template" : "templates"} · {on} on</p>}
      <div className="mt-3 max-h-[56vh] overflow-y-auto pr-1">
        {rows === null ? <Skeleton /> : rows.length === 0 ? <Empty title="No templates" hint="Add one and the system will prepare it for every upcoming competition." /> : (
          <ul>{rows.map((t, i) => <TemplateCard key={t.key} tpl={t} i={i} open={openKey === t.key} onToggle={() => setOpenKey((k) => (k === t.key ? null : t.key))} onChanged={load} />)}</ul>
        )}
      </div>
      <div className="mt-4 flex justify-between gap-3">
        <button type="button" onClick={add} disabled={adding} className="btn btn-ghost">{adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />} Add template</button>
        <button type="button" onClick={onClose} className="btn btn-primary">Done</button>
      </div>
    </Modal>
  );
}

/* ───────────── Assign: tasks I created, with who has finished them ───────────── */
type Filter = "active" | "done" | "all";

function AssignView() {
  const { people, me, byId, error: pErr, mediaIds } = usePeople();
  const [tasks, setTasks] = useState<Mine[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>({ key: 0, title: "", instructions: "", due: "" });
  const [open, setOpen] = useState<Mine | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const role = useAdminRole();
  const [templates, setTemplates] = useState(false);
  const [bump, setBump] = useState(0); // re-reads the system's suggestions

  const load = useCallback(async () => {
    const { data, error } = await sb.from("tasks").select(`${TASK_COLS}, task_assignees(user_id, status, done_at), task_files(count)`).order("created_at", { ascending: false });
    if (error) { setError("Couldn't load your tasks. Has supabase/tasks.sql and supabase/task-files.sql been run?"); setTasks([]); return; }
    setTasks(((data ?? []) as unknown as (Task & { task_assignees: Assignee[]; task_files: { count: number }[] })[]).map((t) => ({ ...t, assignees: t.task_assignees, files: t.task_files?.[0]?.count ?? 0 })));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const mine = useMemo(() => (tasks ?? []).filter((t) => t.created_by === me), [tasks, me]);
  const teammates = useMemo(() => people.filter((p) => p.id !== me), [people, me]);
  const finished = (t: Mine) => t.assignees.length > 0 && t.assignees.every((a) => a.status === "done");
  const active = useMemo(() => mine.filter((t) => !finished(t)), [mine]);
  const counts = { active: active.length, done: mine.length - active.length, all: mine.length };
  const lateCount = useMemo(() => active.filter(overdue).length, [active]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter((t) => (filter === "all" || (filter === "done") === finished(t)) && (!q || t.title.toLowerCase().includes(q)));
  }, [mine, filter, query]);
  const current = open ? mine.find((t) => t.id === open.id) ?? null : null;

  function openEdit(t: Mine) {
    setDraft((d) => ({ key: d.key + 1, title: t.title, instructions: t.instructions ?? "", due: t.due_at ? toLocalInput(new Date(t.due_at)) : "", edit: t }));
    setOpen(null);
    setCreating(true);
  }

  async function remove(t: Mine) {
    // Files go first: the storage policy needs the task to still exist to know you own it.
    const { data: fl } = await sb.from("task_files").select("path, store").eq("task_id", t.id);
    if (fl?.length) await removeStored(t.id, fl);
    const { error } = await sb.from("tasks").delete().eq("id", t.id);
    if (error) { notify.error("Couldn't delete that task."); return; }
    notify.deleted(t.title);
    setOpen(null); setConfirmDel(false);
    setLeaving((s) => new Set(s).add(t.id));
    setTimeout(() => {
      setTasks((prev) => (prev ?? []).filter((x) => x.id !== t.id));
      setLeaving((s) => { const n = new Set(s); n.delete(t.id); return n; });
    }, 380);
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white">Assign tasks</h1>
            <p className="mt-2 text-slate-400">Give work to your teammates and see who has finished it.</p>
          </div>
          <div className="flex flex-wrap gap-3 sm:shrink-0">
            {isHead(role) && <button type="button" onClick={() => setTemplates(true)} className="btn btn-ghost"><Settings2 className="h-4 w-4" aria-hidden="true" /> Templates</button>}
            <button type="button" onClick={() => { setDraft((d) => ({ key: d.key + 1, title: "", instructions: "", due: "" })); setCreating(true); }} className="btn btn-primary"><Plus className="h-4 w-4" aria-hidden="true" /> Create task</button>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <Stat label="Active" value={counts.active} />
          <Stat label="Overdue" value={lateCount} tone="late" />
          <Stat label="Completed" value={counts.done} />
        </dl>
      </div>

      <Assigners role={role} />

      {canAssignTasks(role) && (
        <SuggestionsPanel
          bump={bump}
          onAssign={(s) => { setDraft((p) => ({ key: p.key + 1, title: s.title, instructions: s.instructions ?? "", due: s.due_at ? toLocalInput(new Date(s.due_at)) : "", suggestionId: s.id })); setCreating(true); }}
        />
      )}

      <BirthdayPanel titles={new Set(mine.map((t) => t.title))} onDraft={(d) => { setDraft((p) => ({ ...d, key: p.key + 1 })); setCreating(true); }} />

      {(error || pErr) && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error || pErr}</p>}

      {mine.length > 0 && (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SegTabs label="Task status" value={filter} onChange={setFilter} tabs={[{ id: "active", label: "Active", count: counts.active }, { id: "done", label: "Completed", count: counts.done }, { id: "all", label: "All", count: counts.all }]} />
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search tasks</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" className="h-11 w-full rounded-xl border border-slate-600 bg-slate-900 pl-11 pr-4 text-sm text-white outline-none! transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent" />
          </label>
        </div>
      )}

      {tasks === null ? <Skeleton /> : mine.length === 0 ? (
        <Empty title="You haven't assigned anything yet" hint="Create a task and pick the teammates who should do it." />
      ) : shown.length === 0 ? (
        <Empty title={query ? "No tasks match that search" : filter === "done" ? "Nothing completed yet" : "Nothing active"} hint={query ? "Try a different title." : filter === "done" ? "Tasks appear here once everyone has marked them done." : "Every task you assigned is finished. Nice."} icon={query ? Search : CheckCircle2} />
      ) : (
        <ul key={`${filter}-${query}`}>
          {shown.map((t, i) => {
            const done = t.assignees.filter((a) => a.status === "done").length;
            const total = t.assignees.length;
            const fin = finished(t);
            return (
              <Row key={t.id} i={i} leaving={leaving.has(t.id)}>
                <button type="button" onClick={() => setOpen(t)} className="tk-card block w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left">
                  <span className="flex items-start gap-4">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${fin ? "bg-accent text-accent-ink" : "bg-accent/15 text-accent"}`}>
                      {fin ? <Check className="h-5 w-5" aria-hidden="true" /> : <ClipboardList className="h-5 w-5" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-white">{t.title}</span>
                      {t.instructions && <span className="mt-0.5 block truncate text-sm text-slate-400">{t.instructions}</span>}
                      <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Chip due={t.due_at} finished={fin} />
                        {t.files > 0 && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Paperclip className="h-3 w-3" aria-hidden="true" />{t.files}</span>}
                        <AvatarStack ids={t.assignees.map((a) => a.user_id)} byId={byId} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-xl font-bold tabular-nums text-white">{done}<span className="text-slate-500">/{total}</span></span>
                      <span className="block text-xs text-slate-400">done</span>
                    </span>
                  </span>
                  <span className="mt-4 block"><Progress done={done} total={total} /></span>
                </button>
              </Row>
            );
          })}
        </ul>
      )}

      {isHead(role) && <TemplatesDialog open={templates} onClose={() => setTemplates(false)} />}

      <CreateDialog key={draft.key} draft={draft} open={creating} onClose={() => setCreating(false)} teammates={teammates} mediaIds={mediaIds} onCreated={() => { setFilter("active"); load(); setBump((b) => b + 1); }} />

      <Modal open={current !== null} onClose={() => { setOpen(null); setConfirmDel(false); }} title={current?.title ?? ""} wide>
        {current && (
          <div className="mt-3">
            <Chip due={current.due_at} finished={finished(current)} />
            {current.instructions && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{current.instructions}</p>}
            {current.files > 0 && <Attachments taskId={current.id} />}
            <Submissions taskId={current.id} byId={byId} showWho title="Submitted files" />
            <div className="mt-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-mono text-[.66rem] uppercase tracking-[.18em] text-slate-500">Assigned to · {current.assignees.length}</h3>
                <span className="font-mono text-xs text-slate-400">{current.assignees.filter((a) => a.status === "done").length} done</span>
              </div>
              <Progress done={current.assignees.filter((a) => a.status === "done").length} total={current.assignees.length} />
            </div>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {[...current.assignees].sort((a, b) => Number(a.status === "done") - Number(b.status === "done")).map((a, i) => (
                <li key={a.user_id} className="tk-rise flex items-center gap-3 rounded-lg px-2 py-1.5" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                  <Avatar p={byId.get(a.user_id)} size={7} />
                  <span className="min-w-0 flex-1 truncate text-sm text-white">{nameOf(byId.get(a.user_id))}</span>
                  {a.status === "done"
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-accent"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Done{a.done_at ? ` · ${fmtDay(a.done_at)}` : ""}</span>
                    : <span className={`text-xs font-medium ${overdue(current) ? "text-[#f87171]" : "text-slate-400"}`}>{overdue(current) ? "Missing" : "Assigned"}</span>}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between gap-3">
              {confirmDel ? (
                <>
                  <span className="text-sm text-slate-400">Delete for everyone?</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => setConfirmDel(false)} className="btn btn-ghost btn-sm">Keep</button>
                    <button type="button" onClick={() => remove(current)} className="btn btn-sm bg-[#ef4444] text-white hover:bg-[#f87171]">Delete</button>
                  </span>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setConfirmDel(true)} className="btn btn-ghost btn-sm"><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete task</button>
                  <button type="button" onClick={() => openEdit(current)} className="btn btn-primary btn-sm"><Pencil className="h-4 w-4" aria-hidden="true" /> Edit task</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ───────────── To do: tasks assigned to me ───────────── */
type Tab = "assigned" | "missing" | "done";

/* Marking a task done: attach what you made (pictures, PDF or Word files; optional), then confirm. */
function CompleteForm({ task, me, onDone, onSubmitted }: { task: Todo; me: string; onDone: () => void; onSubmitted: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [action, setAction] = useState<"submit" | "done">("submit");

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED.test(f.name)) { notify.error(`${f.name} can't be attached`, { description: "Only pictures, PDF and Word (.docx) files are allowed." }); continue; }
      if (f.size > MAX_FILE_BYTES) { notify.error(`${f.name} is too large`, { description: `Files can be up to ${fmtSize(MAX_FILE_BYTES)}.` }); continue; }
      if (f.size === 0) continue;
      if (next.length >= MAX_FILES) { notify.info(`Up to ${MAX_FILES} files`); break; }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
  }

  /** Uploads the picked files. Whatever fails stays in the list so nothing is uploaded twice. Returns true when all went through. */
  async function upload() {
    const left: File[] = [];
    for (let i = 0; i < files.length; i++) {
      setStage(`Uploading ${i + 1} of ${files.length}…`);
      if (!(await uploadSubmission(task.id, me, files[i]))) left.push(files[i]);
    }
    setStage("");
    setFiles(left);
    if (left.length) notify.error(`${left.length} ${left.length === 1 ? "file" : "files"} didn't upload`, { description: "Try again with the files left." });
    return left.length === 0;
  }

  /** Submit: hand the files in. The task stays open until you press Mark as done. */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || files.length === 0) return;
    setAction("submit"); setBusy(true);
    const n = files.length;
    if (await upload()) { notify.created("Submitted", { description: `${n} ${n === 1 ? "file" : "files"} handed in.` }); onSubmitted(); }
    setBusy(false);
  }

  /** Mark as done: finishes the task (any files you picked are submitted first). */
  async function finish() {
    if (busy) return;
    setAction("done"); setBusy(true);
    if (files.length && !(await upload())) { setBusy(false); return; }
    setBusy(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-slate-700 pt-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-sm font-semibold text-white">Your work <span className="text-[#f87171]" aria-hidden="true">*</span></h3>
          <span className="font-mono text-xs text-slate-500">{files.length}/{MAX_FILES} files</span>
        </div>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
          className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-[border-color,background-color] duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${dragging ? "border-accent bg-accent/[.06]" : "border-slate-600 hover:border-slate-400"}`}
        >
          <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <Paperclip className={`h-5 w-5 transition-transform duration-200 ${dragging ? "-translate-y-0.5 text-accent" : "text-slate-400"}`} aria-hidden="true" />
          <span className="text-sm text-slate-300"><span className="font-medium text-accent">Choose files</span> or drop them here</span>
          <span className="text-xs text-slate-500">PNG, JPG, GIF, WebP, PDF, DOC, DOCX · up to {fmtSize(MAX_FILE_BYTES)} each</span>
        </label>
        {files.length > 0 && (
          <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
                {isImage(f.type, f.name) ? <FileImage className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /> : <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                <span className="shrink-0 font-mono text-xs text-slate-500">{fmtSize(f.size)}</span>
                <button type="button" disabled={busy} onClick={() => setFiles((x) => x.filter((y) => y !== f))} aria-label={`Remove ${f.name}`} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500" aria-live="polite">{files.length === 0 ? "Attach a file to enable Submit." : `${files.length} ${files.length === 1 ? "file" : "files"} ready to submit.`}</p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button type="submit" disabled={busy || files.length === 0} className="btn btn-ghost disabled:cursor-not-allowed disabled:opacity-40">
            {busy && action === "submit" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />} {busy && action === "submit" ? stage || "Submitting…" : "Submit"}
          </button>
          <button type="button" onClick={finish} disabled={busy} className="btn btn-primary disabled:opacity-50">
            {busy && action === "done" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} {busy && action === "done" ? stage || "Finishing…" : "Mark as done"}
          </button>
        </div>
      </div>
    </form>
  );
}

function TodoView() {
  const { byId, me, error: pErr } = usePeople();
  const role = useAdminRole();
  const [items, setItems] = useState<Todo[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("assigned");
  const [openId, setOpenId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState(false); // chose the starting tab once
  const [subKey, setSubKey] = useState(0); // bumps to reload "Your submission" after a Submit

  const load = useCallback(async () => {
    const { data: auth } = await sb.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return;
    const { data, error } = await sb.from("task_assignees").select(`status, done_at, tasks(${TASK_COLS}, task_files(count))`).eq("user_id", uid);
    if (error) { setError("Couldn't load your tasks. Has supabase/tasks.sql been run?"); setItems([]); return; }
    type Row = { status: Status; done_at: string | null; tasks: (Task & { task_files: { count: number }[] }) | null };
    setItems(((data ?? []) as unknown as Row[]).filter((r) => r.tasks).map((r) => ({ ...r.tasks!, status: r.status, done_at: r.done_at, files: r.tasks!.task_files?.[0]?.count ?? 0 })));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // while a row is folding away it already shows its new state
  const eff = (t: Todo): Status => (leaving.has(t.id) ? (t.status === "done" ? "assigned" : "done") : t.status);

  const buckets = useMemo(() => {
    const all = items ?? [];
    const byDue = (a: Todo, b: Todo) => (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity);
    return {
      assigned: all.filter((t) => t.status === "assigned" && !overdue(t)).sort(byDue),
      missing: all.filter((t) => t.status === "assigned" && overdue(t)).sort(byDue),
      done: all.filter((t) => t.status === "done").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? "")),
    } satisfies Record<Tab, Todo[]>;
  }, [items]);

  useEffect(() => {
    if (items === null || picked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(true);
    if (buckets.assigned.length === 0 && buckets.missing.length > 0) setTab("missing"); // open on what needs attention
  }, [items, picked, buckets]);

  const current = openId ? (items ?? []).find((t) => t.id === openId) ?? null : null;
  const total = items?.length ?? 0;
  const left = total - buckets.done.length;

  async function setDone(t: Todo, done: boolean) {
    if (!me || leaving.has(t.id)) return;
    const { error } = await sb.from("task_assignees").update({ status: done ? "done" : "assigned", done_at: done ? new Date().toISOString() : null }).eq("task_id", t.id).eq("user_id", me);
    if (error) { notify.error("That didn't save."); return; }
    if (done) adminFetch("/api/admin/notify", { method: "POST", body: JSON.stringify({ event: "task-done", taskId: t.id }) }).catch(() => {}); // tell whoever assigned it
    if (done) notify.updated(t.title, { description: "Marked as done.", action: { label: "Undo", onClick: () => setDone({ ...t, status: "done" }, false) } });
    setLeaving((s) => new Set(s).add(t.id));
    setTimeout(() => {
      setItems((prev) => (prev ?? []).map((x) => (x.id === t.id ? { ...x, status: done ? "done" : "assigned", done_at: done ? new Date().toISOString() : null } : x)));
      setLeaving((s) => { const n = new Set(s); n.delete(t.id); return n; });
    }, 380);
  }

  const shown = buckets[tab];
  // Assigned is split the way Google Classroom does it: Today / This week / Later / No due date.
  const groups = useMemo(() => {
    if (tab !== "assigned") return [{ title: "", rows: shown }];
    const g: Record<string, Todo[]> = { Today: [], "This week": [], Later: [], "No due date": [] };
    for (const t of shown) g[!t.due_at ? "No due date" : dayGap(new Date(t.due_at)) <= 0 ? "Today" : dayGap(new Date(t.due_at)) < 7 ? "This week" : "Later"].push(t);
    return Object.entries(g).filter(([, rows]) => rows.length).map(([title, rows]) => ({ title, rows }));
  }, [shown, tab]);

  let n = 0;
  return (
    <>
      <div className="mb-8 max-w-xl">
        <h1 id="panel-title" className="font-display text-3xl font-bold tracking-[-0.03em] text-white">To do</h1>
        <p className="mt-2 text-slate-400">Tasks your teammates have assigned to you.</p>
      </div>

      <dl className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="To do" value={left} />
        <Stat label="Overdue" value={buckets.missing.length} tone="late" />
        <Stat label="Done" value={buckets.done.length} />
      </dl>

      <div className="mb-6">
        <SegTabs label="Task status" value={tab} onChange={setTab} tabs={[{ id: "assigned", label: "Assigned", count: buckets.assigned.length }, { id: "missing", label: "Missing", count: buckets.missing.length, warn: buckets.missing.length > 0 }, { id: "done", label: "Done", count: buckets.done.length }]} />
      </div>

      {(error || pErr) && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error || pErr}</p>}

      {items === null ? <Skeleton /> : shown.length === 0 ? (
        <Empty
          icon={tab === "done" ? ClipboardList : CheckCircle2}
          title={tab === "assigned" ? "You're all caught up" : tab === "missing" ? "Nothing is overdue" : "Nothing finished yet"}
          hint={tab === "assigned" ? "When a teammate assigns you a task, it shows up here." : tab === "missing" ? "Tasks past their due date that aren't done appear here." : "Tasks you mark as done are kept here."}
        />
      ) : (
        <div key={tab}>
          {groups.map((g) => (
            <section key={g.title || tab} className="mb-2" aria-label={g.title || undefined}>
              {g.title && <h2 className="tk-rise mb-3 mt-2 flex items-center gap-3 px-1 font-mono text-[.66rem] uppercase tracking-[.18em] text-slate-400" style={{ "--i": Math.min(n, 8) } as React.CSSProperties}>{g.title} <span className="text-slate-600">{g.rows.length}</span><span className="h-px flex-1 bg-slate-800" aria-hidden="true" /></h2>}
              <ul>
                {g.rows.map((t) => {
                  const checked = eff(t) === "done";
                  const tone = checked ? "none" : dueInfo(t.due_at).tone;
                  const edge = tone === "late" ? "border-l-[3px] border-l-[#f87171]" : tone === "soon" ? "border-l-[3px] border-l-[#fbbf24]" : "";
                  return (
                    <Row key={t.id} i={n++} leaving={leaving.has(t.id)}>
                      <div className={`tk-card group flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 ${edge}`}>
                        <button type="button" onClick={() => setOpenId(t.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="block min-w-0">
                              <span className={`relative inline-block max-w-full truncate align-bottom font-medium transition-colors duration-300 after:absolute after:left-0 after:top-1/2 after:h-px after:bg-slate-400 after:transition-[width] after:duration-300 after:content-[''] ${checked ? "text-slate-400 after:w-full" : "text-white after:w-0"}`}>{t.title}</span>
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                              <Avatar p={byId.get(t.created_by)} size={7} />
                              <span className="truncate">{nameOf(byId.get(t.created_by))} · {fmtDay(t.created_at)}</span>
                              {t.files > 0 && <span className="inline-flex shrink-0 items-center gap-1 text-slate-500"><Paperclip className="h-3 w-3" aria-hidden="true" />{t.files}</span>}
                            </span>
                            {t.instructions && <span className="mt-1.5 block truncate text-sm text-slate-500">{t.instructions}</span>}
                            <span className="mt-2 block sm:hidden"><Chip due={t.due_at} finished={checked} /></span>
                          </span>
                          <span className="hidden shrink-0 sm:block"><Chip due={t.due_at} finished={checked} /></span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                        </button>
                      </div>
                    </Row>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Modal open={current !== null} onClose={() => setOpenId(null)} title={current?.title ?? ""} wide>
        {current && (
          <div className="mt-3">
            <p className="flex items-center gap-2 text-xs text-slate-400"><Avatar p={byId.get(current.created_by)} size={7} /> {nameOf(byId.get(current.created_by))} · Posted {fmtDay(current.created_at)}</p>
            <div className="mt-3"><Chip due={current.due_at} finished={eff(current) === "done"} /></div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{current.instructions || "No instructions."}</p>
            <Attachments taskId={current.id} />
            <Submissions key={`${current.id}-${subKey}`} taskId={current.id} byId={byId} title="Your submission" />
            {eff(current) === "done" ? (
              <div className="mt-6 flex justify-end"><button type="button" onClick={() => setDone(current, false)} className="btn btn-ghost">Unmark as done</button></div>
            ) : (
              <CompleteForm key={current.id} task={current} me={me} onSubmitted={() => setSubKey((k) => k + 1)} onDone={() => { const t = current; setOpenId(null); setDone(t, true); }} />
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Tasks({ mode }: { mode: "assign" | "todo" }) {
  return (
    <section aria-labelledby="panel-title">
      {mode === "assign" ? <AssignView /> : <TodoView />}
    </section>
  );
}
