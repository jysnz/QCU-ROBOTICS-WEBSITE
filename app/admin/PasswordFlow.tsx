"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2, Mail } from "lucide-react";
import { passwordIssue, passwordOk } from "../lib/passwordRules";
import { PasswordMeter, PasswordRules, SuccessMark } from "./authBits";
import { notify } from "./notify";
import { adminFetch } from "./supabase";
import { CodeStep, Field, PasswordInput, card } from "./settingsBits";

/* Choosing a new password, in three steps: get a code by email, enter it, then (only then) the password boxes appear.
   Used in Settings (change a password) and on the "create a password" screen every account must pass once. */
export default function PasswordFlow({ email, has, onSaved, onFinish, title, subtitle, finishLabel = "Done", hideHeader = false }: {
  email: string; has: boolean; onSaved?: () => void; onFinish?: () => void; title?: string; subtitle?: string; finishLabel?: string; hideHeader?: boolean;
}) {
  // Every new password starts with a code emailed to you. Only after the code is right do the password boxes appear.
  const [step, setStep] = useState<"intro" | "code" | "password" | "done">("intro");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<{ new?: string; confirm?: string; code?: string }>({});
  const [bad, setBad] = useState(0);
  const mismatch = pw2.length > 0 && pw !== pw2;

  function reset() { setCode(""); setTicket(""); setPw(""); setPw2(""); setErrs({}); setStep("intro"); }
  const finish = () => { if (onFinish) onFinish(); else reset(); };

  async function requestCode() {
    if (busy) return;
    setBusy(true); setErrs({});
    try {
      await adminFetch("/api/admin/account/password", { method: "POST", body: JSON.stringify({ action: "request-code" }) });
      setCode(""); setStep("code");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Couldn't send the code.");
    }
    setBusy(false);
  }

  async function verify(value: string) {
    if (busy) return;
    setBusy(true); setErrs({});
    try {
      const r = await adminFetch<{ ticket: string }>("/api/admin/account/password", { method: "POST", body: JSON.stringify({ action: "verify-code", code: value }) });
      setTicket(r.ticket); setStep("password");
    } catch (err) {
      setErrs({ code: err instanceof Error ? err.message : "That code isn't right." }); setCode(""); setBad((n) => n + 1);
    }
    setBusy(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const issue = passwordIssue(pw, email);
    if (issue) { setErrs({ new: issue }); return; }
    if (pw !== pw2) { setErrs({ confirm: "The two passwords don't match." }); return; }
    setBusy(true); setErrs({});
    try {
      await adminFetch("/api/admin/account/password", { method: "POST", body: JSON.stringify({ action: "set", ticket, newPassword: pw }) });
      setStep("done"); onSaved?.();
      notify.updated(has ? "Password changed" : "Password set", { description: has ? undefined : "You can now sign in with your email and password too." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't set the password.";
      if (/expired|start again/i.test(msg)) { notify.error("That request expired", { description: "Please ask for a new code." }); reset(); }
      else setErrs({ new: msg });
    }
    setBusy(false);
  }

  // the three steps, as a small progress trail
  const at = step === "intro" ? 0 : step === "code" ? 1 : 2;
  const trail = ["Get a code", "Enter the code", "New password"];

  return (
    <div className={card}>
      {!hideHeader && (
        <>
        <h2 className="font-display text-lg font-semibold text-white">{title ?? (has ? "Change password" : "Set a password")}</h2>
        <p className="mt-0.5 text-sm text-slate-400">{subtitle ?? (has ? "Use a strong password you don't use anywhere else." : "You sign in with Google. Add a password to be able to sign in with your email too.")}</p>
        </>
      )}

      {step !== "done" && (
        <div className={hideHeader ? "" : "mt-5"} role="group" aria-label={`Step ${at + 1} of ${trail.length}: ${trail[at]}`}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-mono uppercase tracking-[.14em] text-slate-500">Step {at + 1} of {trail.length}</span>
            <span key={at} className="step-in font-medium text-white">{trail[at]}</span>
          </div>
          <div className="mt-2.5 flex gap-1.5" aria-hidden="true">
            {trail.map((t, i) => (
              <span key={t} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
                <span className="block h-full rounded-full bg-accent transition-[width] duration-500 ease-out-quint" style={{ width: i < at ? "100%" : i === at ? "55%" : "0%" }} />
              </span>
            ))}
          </div>
        </div>
      )}

      <div key={step} className="step-in mt-5">
        {step === "intro" && (
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent"><KeyRound className="h-6 w-6" aria-hidden="true" /></span>
            <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-slate-300">To keep your account safe, we&rsquo;ll email a 6-digit code to:</p>
            <p className="mx-auto mt-3 flex max-w-full items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-medium text-white"><Mail className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /><span className="truncate">{email}</span></p>
            <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-slate-500">Enter the code first, then you can choose your new password.</p>
            <button type="button" onClick={requestCode} disabled={busy} className="btn btn-primary mt-5 w-full disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />} Email me a code</button>
          </div>
        )}

        {step === "code" && (
          <CodeStep sentTo={email} code={code} setCode={(v) => { setCode(v); setErrs({}); }} onComplete={verify} busy={busy} error={errs.code ?? ""} bad={bad} onResend={requestCode}>
            <div className="flex justify-between gap-3">
              <button type="button" onClick={reset} className="btn btn-ghost">Cancel</button>
              <button type="button" onClick={() => verify(code)} disabled={busy || code.length < 6} className="btn btn-primary disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Verify code</button>
            </div>
          </CodeStep>
        )}

        {step === "password" && (
          <form onSubmit={save} noValidate className="space-y-4">
            <p className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-sm text-accent"><Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden="true" /> Code verified. Now choose your new password.</p>
            <Field id="st-new" title="New password" error={errs.new}>
              <PasswordInput id="st-new" value={pw} onChange={(v) => { setPw(v); setErrs({}); }} auto="new-password" invalid={!!errs.new} />
              <PasswordMeter password={pw} />
              <PasswordRules password={pw} />
            </Field>
            <Field id="st-confirm" title="Confirm new password" error={errs.confirm || (mismatch ? "The two passwords don't match." : "")}>
              <PasswordInput id="st-confirm" value={pw2} onChange={(v) => { setPw2(v); setErrs({}); }} auto="new-password" invalid={mismatch || !!errs.confirm} />
            </Field>
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={reset} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={busy || !passwordOk(pw, email) || pw !== pw2} className="btn btn-primary disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {has ? "Change password" : "Set password"}</button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="py-3 text-center">
            <SuccessMark />
            <p className="mt-4 font-display text-lg font-semibold text-white">{has ? "Password updated" : "Password set"}</p>
            <p className="mt-1 text-sm text-slate-400">Use it the next time you sign in.</p>
            <button type="button" onClick={finish} className="btn btn-primary mt-5">{finishLabel}</button>
          </div>
        )}
      </div>
    </div>
  );
}
