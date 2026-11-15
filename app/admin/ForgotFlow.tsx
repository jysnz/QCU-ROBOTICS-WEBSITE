"use client";

import { useState } from "react";
import { ArrowLeft, AtSign, Check, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, Send } from "lucide-react";
import Turnstile from "./Turnstile";
import { OtpInput, PasswordMeter, PasswordRules, SuccessMark, useCountdown } from "./authBits";
import { passwordIssue } from "../lib/passwordRules";

/* Forgot password, on the sign-in page. Four steps, each sliding in from the right:
   1. email  ->  2. the 6-digit code we emailed (through Brevo)  ->  3. a new password  ->  4. done.
   The server never says whether an email has an account, so this can't be used to look people up. */
type Step = "email" | "code" | "password" | "done";
const ORDER: Step[] = ["email", "code", "password", "done"];

const lbl = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[#94a3b8]";
const inputCls =
  "h-11 w-full rounded-xl border border-[#334155] bg-[#020617]/60 pl-10 pr-3 text-sm text-[#f8fafc] outline-none transition-colors placeholder:text-[#475569] hover:border-[#475569] focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,.18)]";
const primary = "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#020617] transition-[filter,transform] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-110";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/admin/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || "Something went wrong. Please try again."), { locked: !!j.locked });
  return j as T;
}

export default function ForgotFlow({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [back, setBack] = useState(false); // slide direction
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bad, setBad] = useState(0); // bumps to replay the shake on the code boxes
  const cd = useCountdown(45);

  const go = (s: Step, isBack = false) => { setBack(isBack); setError(""); setStep(s); };

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError("Enter the email you signed up with."); return; }
    if (!token) { setError("Please complete the verification check first."); return; }
    setBusy(true);
    try {
      await call({ action: "request", email: email.trim(), token });
      setCode(""); cd.restart(); go("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false); setToken(""); setResetKey((k) => k + 1); // a verification token works once
    }
  }

  async function verify(value: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await call<{ ticket: string }>({ action: "verify", email: email.trim(), code: value });
      setTicket(r.ticket); go("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code isn't right.");
      setCode(""); setBad((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const issue = passwordIssue(pw, email.trim());
    if (issue) { setError(issue); return; }
    if (pw !== pw2) { setError("The two passwords don't match."); return; }
    setBusy(true);
    try {
      await call({ action: "set-password", email: email.trim(), ticket, password: pw });
      go("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // the dots at the top show where you are
  const at = ORDER.indexOf(step);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2" aria-label={`Step ${Math.min(at + 1, 3)} of 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-[#1e293b]" aria-hidden="true">
            <span className="block h-full rounded-full bg-[#22c55e] transition-[width] duration-500 ease-out" style={{ width: i < at || step === "done" ? "100%" : i === at ? "55%" : "0%" }} />
          </span>
        ))}
      </div>

      <div key={step} className={back ? "step-in-back" : "step-in"}>
        {step === "email" && (
          <form onSubmit={sendCode} noValidate className="space-y-3">
            <div className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#4ade80]"><KeyRound className="h-5 w-5" aria-hidden="true" /></span>
              <h2 className="mt-3 text-base font-semibold text-[#f8fafc]">Forgot your password?</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">Enter your email and we&rsquo;ll send you a 6-digit code to reset it.</p>
            </div>
            <div>
              <label className={lbl} htmlFor="fp-email">Email Address</label>
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true" />
                <input id="fp-email" type="email" className={inputCls} placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
              </div>
            </div>
            <div><Turnstile onToken={setToken} resetKey={resetKey} /></div>
            <p role="alert" className={`text-sm text-[#f87171] ${error ? "animate-fadeIn" : "hidden"}`}>{error}</p>
            <button type="submit" disabled={busy || !token} className={primary} style={{ background: "#22c55e" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Send Code
            </button>
          </form>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <div className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#4ade80]"><Mail className="h-5 w-5" aria-hidden="true" /></span>
              <h2 className="mt-3 text-base font-semibold text-[#f8fafc]">Check your email</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">If <span className="text-[#f8fafc]">{email.trim()}</span> has an account, we sent a 6-digit code to it. It expires in 10 minutes.</p>
            </div>
            <div key={bad}>
              <OtpInput tone="auth" value={code} onChange={setCode} onComplete={verify} disabled={busy} error={!!error} />
            </div>
            <p role="alert" className={`text-center text-sm text-[#f87171] ${error ? "animate-fadeIn" : "hidden"}`}>{error}</p>
            <button type="button" onClick={() => verify(code)} disabled={busy || code.length < 6} className={primary} style={{ background: "#22c55e" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Verify Code
            </button>
            <p className="text-center text-xs text-[#94a3b8]">
              {cd.left > 0 ? <>You can ask for a new code in <span className="tabular-nums text-[#f8fafc]">{cd.left}s</span></> : (
                <button type="button" onClick={() => { setBack(true); setError(""); setStep("email"); }} className="font-semibold text-[#22c55e] hover:underline">Didn&rsquo;t get it? Send a new code</button>
              )}
            </p>
          </div>
        )}

        {step === "password" && (
          <form onSubmit={savePassword} noValidate className="space-y-3">
            <div className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#4ade80]"><Lock className="h-5 w-5" aria-hidden="true" /></span>
              <h2 className="mt-3 text-base font-semibold text-[#f8fafc]">Create a new password</h2>
              <p className="mt-1 text-xs text-[#94a3b8]">Code accepted. Choose a password you haven&rsquo;t used before.</p>
            </div>
            <div>
              <label className={lbl} htmlFor="fp-pw">New Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true" />
                <input id="fp-pw" type={show ? "text" : "password"} className={`${inputCls} pr-11`} placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} maxLength={72} autoFocus required />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#94a3b8] transition-colors hover:bg-[#1e293b] hover:text-white">
                  {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <PasswordMeter password={pw} tone="auth" />
              <PasswordRules password={pw} tone="auth" />
            </div>
            <div>
              <label className={lbl} htmlFor="fp-pw2">Confirm Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true" />
                <input id="fp-pw2" type={show ? "text" : "password"} className={inputCls} placeholder="••••••••" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" maxLength={72} required />
                {pw2 && pw === pw2 && <Check className="step-in absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#22c55e]" aria-hidden="true" />}
              </div>
            </div>
            <p role="alert" className={`text-sm text-[#f87171] ${error ? "animate-fadeIn" : "hidden"}`}>{error}</p>
            <button type="submit" disabled={busy || !!passwordIssue(pw, email.trim()) || pw !== pw2} className={primary} style={{ background: "#22c55e" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Change Password
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="py-2 text-center">
            <SuccessMark tone="auth" />
            <h2 className="mt-4 text-base font-semibold text-[#f8fafc]">Password updated</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#94a3b8]">You can now sign in with your new password.</p>
            <button type="button" onClick={onBack} className={`${primary} mt-5`} style={{ background: "#22c55e" }}>Back to Sign In</button>
          </div>
        )}
      </div>

      {step !== "done" && (
        <button type="button" onClick={step === "email" || step === "code" ? onBack : () => go("code", true)} className="mx-auto mt-4 flex items-center gap-1.5 text-xs text-[#94a3b8] transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> {step === "email" || step === "code" ? "Back to sign in" : "Back"}
        </button>
      )}
    </div>
  );
}
