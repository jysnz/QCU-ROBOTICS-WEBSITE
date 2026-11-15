"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { PASSWORD_RULES } from "../lib/passwordRules";

/* Small pieces shared by the forgot-password flow on the sign-in page and the Settings page.
   `tone` picks the colours: "auth" is the green sign-in screen, "admin" is the lime dashboard. */
export type Tone = "auth" | "admin";

const BOX: Record<Tone, string> = {
  auth: "border-[#334155] bg-[#020617]/60 text-[#f8fafc] hover:border-[#475569] focus:border-[#22c55e] focus:shadow-[0_0_0_3px_rgba(34,197,94,.18)]",
  admin: "border-slate-600 bg-slate-950 text-white hover:border-slate-500 focus:border-accent focus:shadow-[0_0_0_3px_rgba(200,245,96,.18)]",
};
const FILLED: Record<Tone, string> = { auth: "border-[#22c55e]/60", admin: "border-accent/60" };

/** Six boxes for a one-time code: type, paste the whole code, Backspace and arrow keys all work. `error` shakes the boxes. */
export function OtpInput({ value, onChange, onComplete, disabled, error, tone = "admin", autoFocus = true }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; error?: boolean; tone?: Tone; autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  function set(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
    return clean;
  }

  return (
    <div className={`flex justify-center gap-2 sm:gap-2.5 ${error ? "otp-shake" : ""}`} role="group" aria-label="6-digit code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) return;
            // typing into a box fills it and moves on; a pasted run of digits fills the boxes from here
            const merged = set((value.slice(0, i) + v + value.slice(i + 1)).slice(0, 6));
            refs.current[Math.min(i + v.length, 5, merged.length)]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (d) onChange(value.slice(0, i) + value.slice(i + 1));
              else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const clean = set(e.clipboardData.getData("text"));
            refs.current[Math.min(clean.length, 5)]?.focus();
          }}
          className={`otp-box h-12 w-10 rounded-xl border text-center font-display text-xl font-semibold tabular-nums outline-none transition-[border-color,box-shadow,transform] duration-150 sm:h-14 sm:w-12 sm:text-2xl ${BOX[tone]} ${d ? `${FILLED[tone]} otp-pop` : ""} ${error ? "!border-[#ef4444]" : ""} disabled:opacity-60`}
        />
      ))}
    </div>
  );
}

/** How strong a password looks, 0 to 4: length, mixed case, a number, a symbol. Only a guide: the server enforces the real rule. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const LEVELS = [
  { label: "Too short", color: "#ef4444" },
  { label: "Weak", color: "#f97316" },
  { label: "Okay", color: "#eab308" },
  { label: "Good", color: "#84cc16" },
  { label: "Strong", color: "#22c55e" },
] as const;

export function PasswordMeter({ password, tone = "admin" }: { password: string; tone?: Tone }) {
  const score = password.length < 8 ? 0 : Math.max(1, passwordScore(password));
  const lvl = LEVELS[score];
  return (
    <div className={`transition-opacity duration-300 ${password ? "opacity-100" : "opacity-0"}`} aria-live="polite">
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full transition-[background-color,transform] duration-300 ${tone === "auth" ? "bg-[#1e293b]" : "bg-slate-800"}`} style={n <= score ? { background: lvl.color, transform: "scaleY(1.4)" } : undefined} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: password ? lvl.color : undefined }}>{password ? lvl.label : ""}{password && password.length < 8 ? " · at least 8 characters" : ""}</p>
    </div>
  );
}

/** The password rules, ticking off as you type. Each rule turns green with a small pop when it is met. */
export function PasswordRules({ password, tone = "admin" }: { password: string; tone?: Tone }) {
  const done = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const ok = tone === "auth" ? { text: "text-[#4ade80]", dot: "border-[#22c55e] bg-[#22c55e] text-[#020617]" } : { text: "text-accent", dot: "border-accent bg-accent text-accent-ink" };
  const idle = tone === "auth" ? "border-[#334155] text-transparent" : "border-slate-600 text-transparent";
  return (
    <div className="mt-3" aria-live="polite">
      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-[.12em] ${tone === "auth" ? "text-[#94a3b8]" : "text-slate-400"}`}>
        Your password needs <span className="tabular-nums">({done}/{PASSWORD_RULES.length})</span>
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {PASSWORD_RULES.map((r) => {
          const met = r.test(password);
          return (
            <li key={r.id} className={`flex items-center gap-2 text-xs transition-colors duration-200 ${met ? ok.text : tone === "auth" ? "text-[#94a3b8]" : "text-slate-400"}`}>
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-[background-color,border-color] duration-200 ${met ? `${ok.dot} otp-pop` : idle}`} aria-hidden="true">
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
              </span>
              <span>{r.label}<span className="sr-only">{met ? " (done)" : " (not yet)"}</span></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A circle with a check that draws itself, and a ring that bursts out of it. */
export function SuccessMark({ tone = "admin", size = 64 }: { tone?: Tone; size?: number }) {
  const bg = tone === "auth" ? "#22c55e" : "#c8f560";
  const ink = tone === "auth" ? "#020617" : "#10140a";
  return (
    <span className="relative mx-auto grid place-items-center" style={{ width: size + 16, height: size + 16 }} aria-hidden="true">
      <span className="pp-burst absolute inset-0 rounded-full border-2" style={{ borderColor: bg }} />
      <span className="grid place-items-center rounded-full" style={{ width: size, height: size, background: bg, color: ink, animation: "otp-pop .5s var(--ease) both" }}>
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="pp-check" d="M20 6 9 17l-5-5" /></svg>
      </span>
    </span>
  );
}

/** Counts down from `seconds`; `restart()` begins again (used for "Resend code in 42s"). */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return { left, restart: () => setLeft(seconds) };
}
