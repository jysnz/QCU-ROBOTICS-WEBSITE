"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { adminFetch, sb } from "./supabase";

const PICTURES = "member-pictures";
const initials = (n: string) => { const p = n.trim().split(/\s+/); return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?"; };

/* ───────── Photo drop zone ───────── */
const MAX_PHOTO = 5 * 1024 * 1024;

export default function PhotoDropzone({ value, onChange, name, folder, bucket = PICTURES }: { value: string; onChange: (url: string) => void; name: string; folder: string; bucket?: string }) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState<{ name: string; size: number } | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setErr("");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setErr("Use a JPG, PNG or WebP image."); return; }
    if (file.size > MAX_PHOTO) { setErr(`That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`); return; }
    setBusy(true);
    // Pictures go to Cloudflare R2 (the "otherphotos" bucket, one folder per kind): the server hands out a short-lived
    // upload link and the browser sends the file straight there. If R2 isn't switched on yet, Supabase Storage is used.
    try {
      const t = await adminFetch<{ fallback?: boolean; uploadUrl?: string; publicUrl?: string }>("/api/admin/media", { method: "POST", body: JSON.stringify({ folder, type: file.type, size: file.size }) });
      if (t.uploadUrl && t.publicUrl) {
        const put = await fetch(t.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!put.ok) throw new Error(`the storage answered ${put.status}`);
        setBusy(false);
        setInfo({ name: file.name, size: file.size });
        onChange(t.publicUrl);
        return;
      }
    } catch (e) {
      setBusy(false);
      setErr(`Upload failed: ${e instanceof Error ? e.message : "try again"}`);
      return;
    }
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) { setErr(`Upload failed: ${error.message}`); return; }
    setInfo({ name: file.name, size: file.size });
    onChange(sb.storage.from(bucket).getPublicUrl(path).data.publicUrl);
  }

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
      className={`flex items-center gap-5 rounded-2xl border border-dashed p-4 transition-[border-color,background-color,transform] duration-200 ${drag ? "scale-[1.01] border-accent bg-accent/10" : "border-slate-600 bg-slate-950/40 hover:border-slate-500"}`}
    >
      <button
        type="button"
        onClick={() => pick.current?.click()}
        aria-label={value ? "Replace photo" : "Upload photo"}
        className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-600 bg-slate-800 outline-none transition-colors hover:border-accent focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.2)]"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={value} src={value} alt="" className="animate-fadeIn h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center font-display text-3xl font-semibold text-slate-500">{name.trim() ? initials(name) : <ImagePlus className="h-7 w-7" aria-hidden="true" />}</span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/60 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true"><Camera className="h-5 w-5" /></span>
        {busy && <span className="absolute inset-0 grid place-items-center bg-slate-950/75"><Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" /></span>}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{busy ? "Uploading…" : value ? "Photo added" : "Add a photo"}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
          {drag ? "Drop to upload" : value && info ? <>{info.name} · {(info.size / 1024).toFixed(0)} KB</> : <>Drag an image here, or <button type="button" onClick={() => pick.current?.click()} className="font-medium text-accent underline-offset-2 hover:underline">browse</button>. JPG, PNG or WebP, up to 5 MB.</>}
        </p>
        {value && !busy && (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => pick.current?.click()} className="btn btn-ghost btn-sm">Replace</button>
            <button type="button" onClick={() => { onChange(""); setInfo(null); }} className="btn btn-sm text-slate-400 hover:text-[#f87171]">Remove</button>
          </div>
        )}
        {err && <p role="alert" className="animate-fadeIn mt-2 text-xs text-[#f87171]">{err}</p>}
      </div>
      <input ref={pick} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

