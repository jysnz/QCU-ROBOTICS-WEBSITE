"use client";

import { useState } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
import { OtpInput, useCountdown } from "./authBits";

/* Pieces shared by the Settings page and the "create a password" screen. */
export const card = "rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6";
export const input = "h-11 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 text-sm text-white outline-none! transition-colors placeholder:text-slate-500 hover:border-slate-500 focus-visible:border-accent";
export const label = "mb-1.5 block text-xs font-medium text-slate-400";

export function Field({ id, title, error, children, hint }: { id: string; title: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className={label}>{title}</label>
      {children}
      {error ? <p role="alert" className="animate-fadeIn mt-1.5 text-xs text-[#f87171]">{error}</p> : hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function PasswordInput({ id, value, onChange, auto, invalid, placeholder }: { id: string; value: string; onChange: (v: string) => void; auto: string; invalid?: boolean; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={auto} maxLength={72} placeholder={placeholder ?? "••••••••"} className={`${input} pr-11 ${invalid ? "border-[#ef4444]!" : ""}`} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
        {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function CodeStep({ sentTo, code, setCode, onComplete, busy, error, bad, onResend, children }: {
  sentTo: string; code: string; setCode: (v: string) => void; onComplete?: (v: string) => void; busy: boolean; error: string; bad: number; onResend: () => void; children?: React.ReactNode;
}) {
  const cd = useCountdown(45);
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><Mail className="h-4 w-4" aria-hidden="true" /></span>
        <p className="min-w-0 text-sm leading-relaxed text-slate-300">We sent a 6-digit code to <span className="break-all font-medium text-white">{sentTo}</span>. It expires in 10 minutes.</p>
      </div>
      <div key={bad}><OtpInput tone="admin" value={code} onChange={setCode} onComplete={onComplete} disabled={busy} error={!!error} /></div>
      <p role="alert" className={`text-center text-sm text-[#f87171] ${error ? "animate-fadeIn" : "hidden"}`}>{error}</p>
      {children}
      <p className="text-center text-xs text-slate-400">
        {cd.left > 0 ? <>You can ask for a new code in <span className="tabular-nums text-white">{cd.left}s</span></> : (
          <button type="button" onClick={() => { cd.restart(); onResend(); }} className="font-semibold text-accent hover:underline">Didn&rsquo;t get it? Send a new code</button>
        )}
      </p>
    </div>
  );
}
