"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";

/* Inline match-video player. The site stores recordings as HLS streams (.m3u8) on Cloudflare R2, so those go through
   hls.js (loaded only when a player is actually shown); plain mp4/webm links and Safari's native HLS play directly. */
export default function HlsPlayer({ url, poster, autoPlay = true }: { url: string; poster?: string | null; autoPlay?: boolean }) {
  // The element is kept in state so the effect re-runs once it exists; `ref` is what the effect actually touches.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const ref = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const el = ref.current;
    if (!url || !video || !el) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;
     
    setState("loading");

    const play = () => { if (autoPlay) el.play().catch(() => { /* autoplay blocked: the controls are right there */ }); };
    const onReady = () => { if (!destroyed) setState("ready"); };
    const onError = () => { if (!destroyed) setState("error"); };
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("error", onError);

    (async () => {
      const isHls = /\.m3u8($|\?)/i.test(url);
      if (!isHls || el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = url;
        play();
        return;
      }
      const { default: Hls } = await import("hls.js");
      if (destroyed) return;
      if (!Hls.isSupported()) { onError(); return; }
      const h = new Hls({ enableWorker: true, maxBufferLength: 12 });
      hls = h;
      h.attachMedia(el);
      h.loadSource(url);
      h.on(Hls.Events.MANIFEST_PARSED, play);
      h.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) onError(); });
    })();

    return () => {
      destroyed = true;
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("error", onError);
      hls?.destroy();
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [url, video, autoPlay]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
      { }
      <video ref={(n) => { ref.current = n; setVideo(n); }} controls playsInline preload="metadata" poster={poster ?? undefined} className="h-full w-full" />
      {/* Branded loader: the team badge inside a spinning lime ring, HUD corner brackets like the site's hero, and a
          sweeping bar. It fades out when the first frame is ready. */}
      {state !== "error" && (
        <div className={`vp-loader pointer-events-none absolute inset-0 grid place-items-center overflow-hidden bg-slate-950/75 backdrop-blur-sm transition-opacity duration-500 ${state === "loading" ? "opacity-100" : "opacity-0"}`} aria-live="polite" aria-busy={state === "loading"}>
          <span className="vp-corner vp-tl" aria-hidden="true" /><span className="vp-corner vp-tr" aria-hidden="true" />
          <span className="vp-corner vp-bl" aria-hidden="true" /><span className="vp-corner vp-br" aria-hidden="true" />
          <span className="vp-scan" aria-hidden="true" />
          <div className="flex flex-col items-center gap-5">
            <span className="relative grid h-20 w-20 place-items-center" aria-hidden="true">
              <span className="vp-glow absolute inset-2 rounded-full bg-accent/30 blur-xl" />
              <span className="vp-ring absolute inset-0 rounded-full" />
              <span className="absolute inset-0 rounded-full border border-slate-700" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-96.png" alt="" className="vp-badge relative h-10 w-10 object-contain" />
            </span>
            <p className="font-mono text-[.7rem] uppercase tracking-[.24em] text-slate-300">
              Loading footage<span className="vp-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
            </p>
          </div>
          <span className="vp-bar" aria-hidden="true" />
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/90 p-6 text-center" role="alert">
          <div>
            <TriangleAlert className="mx-auto h-8 w-8 text-[#fbbf24]" aria-hidden="true" />
            <p className="mt-3 font-medium text-white">This video couldn&rsquo;t be played</p>
            <p className="mt-1 text-sm text-slate-400">It may still be processing, or the link is no longer available.</p>
            <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-4"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Open the link</a>
          </div>
        </div>
      )}
    </div>
  );
}
