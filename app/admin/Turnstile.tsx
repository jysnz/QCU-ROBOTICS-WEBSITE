"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Cloud } from "lucide-react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error("load")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/* What Cloudflare's numeric error codes mean, so a setup problem says what to fix instead of just "failed". */
const TS_ERRORS: Record<string, string> = {
  "110200": "This website's address isn't allowed for the Turnstile widget. Add it under Hostnames in the Cloudflare dashboard.",
  "110100": "The Turnstile site key isn't valid.",
  "110110": "The Turnstile site key isn't valid.",
  "400020": "The Turnstile site key isn't valid.",
  "200100": "This device's date and time look wrong, which breaks the check.",
  "110500": "This browser can't run the check.",
};

type Status = "loading" | "verifying" | "challenge" | "verified" | "error" | "off" | "failed";

const COPY: Record<Status, string> = {
  loading: "Starting security check…",
  verifying: "Verifying you're human…",
  challenge: "One quick check, please",
  verified: "You're verified",
  error: "Verification failed",
  off: "Verification isn't set up",
  failed: "Couldn't load the check",
};

/* Cloudflare Turnstile with a custom face. The real Turnstile widget still does the checking (it runs in
   "interaction-only" mode, so it only shows itself if Cloudflare needs the visitor to do something); this component
   animates its progress and credits it. Calls onToken(token) when the visitor passes and onToken("") when the token
   expires or errors. Change `resetKey` for a fresh challenge (tokens are single use). The token is verified on the
   server in /api/admin/auth; nothing here is trusted. */
export default function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const cb = useRef(onToken);
  const [status, setStatus] = useState<Status>("loading");
  const [why, setWhy] = useState("");

  useEffect(() => { cb.current = onToken; });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetch("/api/config", { cache: "no-store" }).then((r) => r.json());
        if (!cfg.turnstileSiteKey) { if (!cancelled) { setWhy("TURNSTILE_SITE_KEY isn't set on the server, so the check can't start. Add it in the hosting settings and redeploy."); setStatus("off"); } return; }
        await loadScript();
        if (cancelled || !box.current || !window.turnstile) return;
        setStatus("verifying");
        widget.current = window.turnstile.render(box.current, {
          sitekey: cfg.turnstileSiteKey,
          theme: "dark",
          appearance: "interaction-only",
          callback: (t: string) => { setStatus("verified"); cb.current(t); },
          "before-interactive-callback": () => setStatus("challenge"),
          "after-interactive-callback": () => setStatus("verifying"),
          "expired-callback": () => { setStatus("verifying"); cb.current(""); },
          "error-callback": (code: unknown) => {
            const c = String(code ?? "");
            console.warn("Turnstile error", c);
            setWhy(TS_ERRORS[c] ?? (c ? `The check couldn't run (error ${c}).` : ""));
            setStatus("error"); cb.current("");
            return true; // we show the error ourselves
          },
        });
      } catch {
        if (!cancelled) { setWhy("The Cloudflare check script couldn't load. An ad blocker or a network filter may be blocking challenges.cloudflare.com."); setStatus("failed"); }
      }
    })();
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  const retry = () => {
    if (widget.current && window.turnstile) {
      cb.current("");
      setStatus("verifying");
      window.turnstile.reset(widget.current);
    }
  };

  useEffect(() => {
    if (resetKey > 0) {
      retry();
    }
  }, [resetKey]);

  const ok = status === "verified";
  const bad = status === "error" || status === "failed" || status === "off";
  const working = status === "loading" || status === "verifying" || status === "challenge";

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-[#020617]/50 p-2.5 transition-colors duration-500 ${ok ? "border-[#22c55e]/60" : bad ? "border-[#f87171]/50" : "border-[#334155]"}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span className="relative grid h-9 w-9 shrink-0 place-items-center" aria-hidden="true">
          {working && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-[#334155]" />
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#22c55e]" style={{ animationDuration: ".9s" }} />
              <span className="ts-ping absolute h-2 w-2 rounded-full bg-[#22c55e]" />
            </>
          )}
          {ok && (
            <span className="ts-pop grid h-9 w-9 place-items-center rounded-full bg-[#22c55e]/15">
              <svg viewBox="0 0 24 24" className="ts-check h-5 w-5" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
          )}
          {bad && <AlertTriangle className="h-5 w-5 text-[#f87171]" />}
        </span>

        <span className="min-w-0 flex-1">
          <span key={status} className="animate-fadeIn block text-sm font-medium text-[#f8fafc]">{COPY[status]}</span>
          {bad && why && <span className="mt-0.5 block text-[11px] leading-snug text-[#f87171]">{why}</span>}
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[#64748b]">
            <Cloud className="h-3 w-3 text-[#f6821f]" aria-hidden="true" />
            Protected by <span className="font-semibold text-[#94a3b8]">Cloudflare Turnstile</span>
          </span>
        </span>

        {status === "error" && (
          <button type="button" onClick={retry} className="shrink-0 rounded-lg border border-[#334155] px-3 py-1.5 text-xs font-semibold text-[#f8fafc] transition-colors hover:border-[#475569]">
            Retry
          </button>
        )}
      </div>

      {working && <span className="ts-scan pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden="true" />}

      {/* The real widget. Hidden unless Cloudflare asks for an interaction. */}
      <div ref={box} className={status === "challenge" ? "mt-3 flex justify-center" : "h-0 overflow-hidden"} />
    </div>
  );
}
