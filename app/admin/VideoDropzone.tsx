"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Film, Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { adminFetch } from "./supabase";

/* Pick a video file for a match. It is sent straight to Cloudflare R2 (with a short-lived link from the server), then
   converted to streaming pieces (.m3u8 + .ts) by a background worker. Until that is done the match shows "processing". */
export type VideoUpload = { key: string; name: string; size: number };
export type VideoState = { hasVideo: boolean; processing: boolean; error: string | null };

const TYPES: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo", mpg: "video/mpeg", mpeg: "video/mpeg", "3gp": "video/3gpp" };
const MAX = 4 * 1024 * 1024 * 1024;
const size = (b: number) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : `${Math.max(1, Math.round(b / 1048576))} MB`);

export default function VideoDropzone({ value, onChange, onBusy, current, onRemoveCurrent }: {
  value: VideoUpload | null;
  onChange: (v: VideoUpload | null) => void;
  onBusy: (busy: boolean) => void;
  current: VideoState;
  onRemoveCurrent: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const xhr = useRef<XMLHttpRequest | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => () => xhr.current?.abort(), []); // closing the form cancels an upload that is still running

  async function upload(file: File | undefined) {
    if (!file) return;
    setErr("");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = file.type && file.type.startsWith("video/") ? file.type : TYPES[ext] ?? "";
    if (!type || !Object.values(TYPES).includes(type)) { setErr("Use an MP4, MOV, WebM, MKV or AVI video."); return; }
    if (file.size > MAX) { setErr(`That video is ${size(file.size)}. The limit is 4 GB.`); return; }
    setName(file.name);
    setPct(0);
    onBusy(true);
    try {
      const t = await adminFetch<{ key: string; uploadUrl: string }>("/api/admin/match-video", { method: "POST", body: JSON.stringify({ type, size: file.size }) });
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        xhr.current = x;
        x.open("PUT", t.uploadUrl);
        x.setRequestHeader("Content-Type", type);
        x.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100)); };
        x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`the storage answered ${x.status}`)));
        x.onerror = () => reject(new Error("the connection dropped"));
        x.onabort = () => reject(new Error("cancelled"));
        x.send(file);
      });
      onChange({ key: t.key, name: file.name, size: file.size });
    } catch (e) {
      const m = e instanceof Error ? e.message : "try again";
      if (m !== "cancelled") setErr(`Upload failed: ${m}`);
    } finally {
      xhr.current = null;
      setPct(null);
      onBusy(false);
    }
  }

  const uploading = pct !== null;
  return (
    <div>
      {value ? (
        <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/[.06] p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{value.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{size(value.size)} uploaded. It&rsquo;s converted for streaming in the background after you save.</p>
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove this upload" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      ) : uploading ? (
        <div className="rounded-2xl border border-slate-600 bg-slate-950/40 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">Uploading {name}</p>
            <span className="font-mono text-sm tabular-nums text-slate-300">{pct}%</span>
            <button type="button" onClick={() => xhr.current?.abort()} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
          <span className="mt-3 block h-1.5 w-full overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? 0}>
            <span className="block h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </span>
          <p className="mt-2 text-xs text-slate-400">Keep this window open until the upload reaches 100%.</p>
        </div>
      ) : (
        <div
          onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
          className={`flex items-center gap-4 rounded-2xl border border-dashed p-4 transition-[border-color,background-color] duration-200 ${drag ? "border-accent bg-accent/10" : "border-slate-600 bg-slate-950/40 hover:border-slate-500"}`}
        >
          <button type="button" onClick={() => pick.current?.click()} aria-label="Choose a video" className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-slate-600 bg-slate-800 text-slate-300 outline-none! transition-colors hover:border-accent hover:text-accent focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.2)]">
            {current.processing ? <Loader2 className="h-6 w-6 animate-spin text-[#fbbf24]" aria-hidden="true" /> : current.error ? <TriangleAlert className="h-6 w-6 text-[#f87171]" aria-hidden="true" /> : current.hasVideo ? <Film className="h-6 w-6" aria-hidden="true" /> : <Upload className="h-6 w-6" aria-hidden="true" />}
          </button>
          <div className="min-w-0 flex-1">
            {current.processing ? (
              <>
                <p className="text-sm font-medium text-[#fbbf24]">Processing the video</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">It was uploaded and is being converted for streaming. Visitors see &ldquo;still processing&rdquo; until it finishes. You can upload a different video instead.</p>
              </>
            ) : current.error ? (
              <>
                <p className="text-sm font-medium text-[#f87171]">The last video couldn&rsquo;t be processed</p>
                <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-400">{current.error}</p>
              </>
            ) : current.hasVideo ? (
              <>
                <p className="text-sm font-medium text-white">A video is attached</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">Upload a new one to replace it, or <button type="button" onClick={onRemoveCurrent} className="font-medium text-[#f87171] underline-offset-2 hover:underline">remove it</button>.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-white">{drag ? "Drop the video to upload" : "Add the match video"}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">Drag a video file here, or <button type="button" onClick={() => pick.current?.click()} className="font-medium text-accent underline-offset-2 hover:underline">browse</button>. MP4, MOV, WebM or MKV, up to 4 GB. It&rsquo;s converted for streaming in the background.</p>
              </>
            )}
            {(current.processing || current.error || current.hasVideo) && (
              <button type="button" onClick={() => pick.current?.click()} className="btn btn-ghost btn-sm mt-3">{current.hasVideo ? "Replace video" : "Upload a video"}</button>
            )}
          </div>
        </div>
      )}
      {err && <p role="alert" className="animate-fadeIn mt-2 text-xs text-[#f87171]">{err}</p>}
      <input ref={pick} type="file" accept="video/*,.mkv,.mov,.mp4,.webm,.avi" className="sr-only" tabIndex={-1} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
