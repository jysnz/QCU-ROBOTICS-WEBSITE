"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Switch } from "@base-ui/react/switch";
import { ArrowUp, AtSign, Bell, BellOff, BellRing, Cake, Check, ChevronRight, ClipboardList, Clock, ExternalLink, FileText, Info, LayoutDashboard, Loader2, Lock, LogOut, Mail, Shield, ShieldCheck, Smartphone, User, UserCog, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LEGAL_UPDATED, PrivacyText, TermsText } from "../components/LegalText";
import { SuccessMark } from "./authBits";
import { notify } from "./notify";
import { disablePush, enablePush, getPushState, type PushState } from "./push";
import { adminFetch, sb } from "./supabase";
import PasswordFlow from "./PasswordFlow";
import { CodeStep, Field, card, input } from "./settingsBits";

/* Settings: an overview of your account, your profile, email, password, notifications, the Privacy Policy and Terms, and Sign out.
   Changing the email or setting a first password sends a 6-digit code by email (through Brevo); changing a password
   you already have asks for the current one. The server does every check, this page only guides. */
type Tab = "overview" | "profile" | "email" | "password" | "notifications" | "privacy" | "terms";
type Account = { id: string; email: string; full_name: string | null; avatar_url: string | null; created_at: string | null };
type Me = { account: Account; providers: string[]; hasPassword: boolean; role: string | null };

const TABS: { group: string; items: { id: Tab; label: string; hint: string; icon: LucideIcon }[] }[] = [
  { group: "Account", items: [
    { id: "overview", label: "Overview", hint: "Your account at a glance", icon: LayoutDashboard },
    { id: "profile", label: "Profile", hint: "Your name", icon: User },
  ] },
  { group: "Security", items: [
    { id: "email", label: "Email", hint: "Where we reach you", icon: AtSign },
    { id: "password", label: "Password", hint: "Keep it secure", icon: Lock },
  ] },
  { group: "Preferences", items: [
    { id: "notifications", label: "Notifications", hint: "Alerts on this device", icon: Bell },
  ] },
  { group: "Legal", items: [
    { id: "privacy", label: "Privacy Policy", hint: "How we use your data", icon: Shield },
    { id: "terms", label: "Terms & Conditions", hint: "The rules of use", icon: FileText },
  ] },
];
const ALL_TABS = TABS.flatMap((g) => g.items.map((i) => i.id));
const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", media_head: "Media head", media_assistant: "Media assistant" };

const dateLong = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "");
const initial = (n: string) => (n.trim()[0] ?? "?").toUpperCase();

/* the round picture, or the first letter when there is none */
function Avatar({ account, size = 80 }: { account: Account; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-accent/40 bg-slate-800 font-display font-semibold text-accent" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {account.avatar_url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : initial(account.full_name || account.email)}
    </span>
  );
}

function Chips({ me }: { me: Me }) {
  const methods = [me.providers.includes("google") && "Google", me.hasPassword && "Email & password"].filter(Boolean) as string[];
  return (
    <div className="flex flex-wrap gap-2">
      {me.role && <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"><ShieldCheck className="h-3 w-3" aria-hidden="true" />{ROLE_LABEL[me.role] ?? me.role}</span>}
      {methods.map((m) => <span key={m} className="rounded-full border border-slate-600 px-2.5 py-0.5 text-xs text-slate-300">{m}</span>)}
      {me.account.created_at && <span className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-500">Joined {dateLong(me.account.created_at)}</span>}
    </div>
  );
}

/* ───────────── Overview: who you are, and how well the account is set up ───────────── */
type Item = { id: string; done: boolean; title: string; text: string; action: { label: string; tab: Tab } };

function OverviewCard({ me, goTo }: { me: Me; goTo: (t: Tab) => void }) {
  const [push, setPush] = useState<PushState | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { getPushState().then(setPush); }, []);

  const named = (me.account.full_name ?? "").trim().length >= 2;
  const items: Item[] = [
    { id: "name", done: named, title: named ? "Name added" : "Add your name", text: named ? `Others see you as ${me.account.full_name}.` : "Add your full name so teammates recognise you.", action: { label: named ? "Edit" : "Add name", tab: "profile" } },
    { id: "email", done: true, title: "Email confirmed", text: me.account.email, action: { label: "Change", tab: "email" } },
    { id: "password", done: me.hasPassword, title: me.hasPassword ? "Password set" : "No password yet", text: me.hasPassword ? "You can sign in with your email and password." : "You sign in with Google. Add a password as a second way in.", action: { label: me.hasPassword ? "Change" : "Set password", tab: "password" } },
  ];
  if (push && push !== "unconfigured" && push !== "unsupported") {
    items.push({ id: "push", done: push === "on", title: push === "on" ? "Notifications on" : "Notifications off", text: push === "on" ? "This device gets alerts even when the site is closed." : push === "denied" ? "Blocked in this browser's settings." : "Get tasks and reviews as they happen.", action: { label: push === "on" ? "Manage" : "Turn on", tab: "notifications" } });
  }
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const C = 2 * Math.PI * 34;
  useEffect(() => { const t = window.setTimeout(() => setDrawn(true), 120); return () => window.clearTimeout(t); }, []);

  return (
    <div className="space-y-5">
      <div className={`${card} flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left`}>
        <Avatar account={me.account} size={84} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl font-semibold text-white">{me.account.full_name || "No name set"}</p>
          <p className="truncate text-sm text-slate-400">{me.account.email}</p>
          <div className="mt-3 flex justify-center sm:justify-start"><Chips me={me} /></div>
        </div>
      </div>

      <div className={card}>
        <div className="flex items-center gap-5">
          <span className="relative grid h-20 w-20 shrink-0 place-items-center" aria-label={`${done} of ${items.length} steps done`} role="img">
            <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" className="stroke-slate-800" />
              <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" strokeLinecap="round" className={pct === 100 ? "stroke-accent" : "stroke-[#fbbf24]"} strokeDasharray={C} strokeDashoffset={drawn ? C * (1 - pct / 100) : C} style={{ transition: "stroke-dashoffset 1s var(--ease), stroke .3s" }} />
            </svg>
            <span className="font-display text-lg font-bold tabular-nums text-white">{pct}%</span>
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-white">{pct === 100 ? "Your account is all set" : "Finish setting up your account"}</h2>
            <p className="mt-0.5 text-sm text-slate-400">{done} of {items.length} done. {pct === 100 ? "Nice work." : "A few quick steps keep you secure and in the loop."}</p>
          </div>
        </div>

        <ul className="mt-5 divide-y divide-slate-800 border-t border-slate-800">
          {items.map((it, i) => (
            <li key={it.id} className="tab-in flex items-center gap-3 py-3.5" style={{ animationDelay: `${i * 70 + 120}ms` }}>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${it.done ? "bg-accent/15 text-accent" : "bg-[#fbbf24]/15 text-[#fbbf24]"}`} aria-hidden="true">
                {it.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Info className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-white">{it.title}</span>
                <span className="block truncate text-xs text-slate-400">{it.text}</span>
              </span>
              <button type="button" onClick={() => goTo(it.action.tab)} className={`btn btn-sm shrink-0 ${it.done ? "btn-ghost" : "btn-primary"}`}>{it.action.label}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────────── Profile ───────────── */
function ProfileCard({ me, onSaved, goEmail }: { me: Me; onSaved: (name: string) => void; goEmail: () => void }) {
  const [name, setName] = useState(me.account.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const clean = name.trim().replace(/\s+/g, " ");
  const dirty = clean !== (me.account.full_name ?? "");

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!dirty || busy) return;
    if (clean.length < 2) { setError("Enter your full name."); return; }
    setBusy(true); setError("");
    try {
      const r = await adminFetch<{ full_name: string }>("/api/admin/account", { method: "PATCH", body: JSON.stringify({ full_name: clean }) });
      setName(r.full_name); setSaved(true); onSaved(r.full_name);
      notify.updated("Profile saved", { description: "Your name was updated." });
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} noValidate className={`${card} space-y-6`} onKeyDown={(e) => { if (e.key === "Escape" && dirty) { setName(me.account.full_name ?? ""); setError(""); } }}>
      <div className="flex items-center gap-4">
        <Avatar account={me.account} size={64} />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-white">Your information</h2>
          <p className="text-sm text-slate-400">{me.account.avatar_url ? "Your picture comes from your Google account." : "This is how you appear to other admins."}</p>
        </div>
      </div>

      <Field id="st-name" title="Full name" error={error}>
        <div className="relative">
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input id="st-name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} maxLength={80} autoComplete="name" placeholder="Juan Dela Cruz" className={`${input} pl-10 pr-16 ${error ? "border-[#ef4444]!" : ""}`} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[.68rem] tabular-nums text-slate-500">{clean.length}/80</span>
        </div>
      </Field>

      <Field id="st-email-ro" title="Email" hint="Changing it needs a code sent to the new address.">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            <input id="st-email-ro" value={me.account.email} readOnly tabIndex={-1} className={`${input} cursor-default pl-10 text-slate-400`} />
          </div>
          <button type="button" onClick={goEmail} className="btn btn-ghost shrink-0">Change</button>
        </div>
      </Field>

      {/* the save bar appears as soon as something changed */}
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out-quint ${dirty || saved ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} inert={!dirty && !saved}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
            {saved ? (
              <span className="tab-in inline-flex items-center gap-2 text-sm font-medium text-accent"><Check className="h-4 w-4" aria-hidden="true" /> All changes saved</span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm text-slate-300"><span className="h-2 w-2 rounded-full bg-[#fbbf24]" style={{ animation: "blink 1.6s ease-in-out infinite" }} aria-hidden="true" /> You have unsaved changes <span className="hidden text-xs text-slate-500 sm:inline">· Esc to undo</span></span>
            )}
            {!saved && (
              <div className="flex gap-2">
                <button type="button" onClick={() => { setName(me.account.full_name ?? ""); setError(""); }} className="btn btn-ghost btn-sm">Undo</button>
                <button type="submit" disabled={busy} className="btn btn-primary btn-sm disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save changes</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

/* ───────────── a code step shared by the email and password cards ───────────── */
/* ───────────── Email ───────────── */
function EmailCard({ me, onChanged }: { me: Me; onChanged: (email: string) => void }) {
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [next, setNext] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [bad, setBad] = useState(0);
  const [doneEmail, setDoneEmail] = useState("");

  async function request(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await adminFetch("/api/admin/account/email", { method: "POST", body: JSON.stringify({ action: "request", email: next.trim() }) });
      setCode(""); setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    }
    setBusy(false);
  }
  async function confirm(value: string) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const r = await adminFetch<{ email: string }>("/api/admin/account/email", { method: "POST", body: JSON.stringify({ action: "confirm", code: value }) });
      setDoneEmail(r.email); setStep("done");
      await sb.auth.refreshSession().catch(() => {}); // the sign-in now carries the new email
      onChanged(r.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code isn't right."); setCode(""); setBad((n) => n + 1);
    }
    setBusy(false);
  }

  return (
    <div className={card}>
      <h2 className="font-display text-lg font-semibold text-white">Email address</h2>
      <p className="mt-0.5 text-sm text-slate-400">Your current email is <span className="text-white">{me.account.email}</span>.</p>

      <div key={step} className="step-in mt-5">
        {step === "form" && (
          <form onSubmit={request} noValidate className="space-y-4">
            <Field id="st-new-email" title="New email" error={error} hint="We'll send a 6-digit code to confirm it.">
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input id="st-new-email" type="email" value={next} onChange={(e) => { setNext(e.target.value); setError(""); }} autoComplete="email" placeholder="new@email.com" className={`${input} pl-10 ${error ? "border-[#ef4444]!" : ""}`} />
              </div>
            </Field>
            <div className="flex justify-end">
              <button type="submit" disabled={busy || !next.trim()} className="btn btn-primary disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />} Send code</button>
            </div>
          </form>
        )}
        {step === "code" && (
          <>
            <CodeStep sentTo={next.trim()} code={code} setCode={setCode} onComplete={confirm} busy={busy} error={error} bad={bad} onResend={() => request()}>
              <div className="flex justify-between gap-3">
                <button type="button" onClick={() => { setStep("form"); setError(""); }} className="btn btn-ghost">Use a different email</button>
                <button type="button" onClick={() => confirm(code)} disabled={busy || code.length < 6} className="btn btn-primary disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Confirm</button>
              </div>
            </CodeStep>
          </>
        )}
        {step === "done" && (
          <div className="py-3 text-center">
            <SuccessMark />
            <p className="mt-4 font-display text-lg font-semibold text-white">Email updated</p>
            <p className="mt-1 text-sm text-slate-400">Sign in with <span className="text-white">{doneEmail}</span> from now on. We also let your old address know.</p>
            <button type="button" onClick={() => { setStep("form"); setNext(""); }} className="btn btn-ghost mt-5">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── Password ───────────── */
function PasswordCard({ me, onChanged }: { me: Me; onChanged: () => void }) {
  return <PasswordFlow email={me.account.email} has={me.hasPassword} onSaved={onChanged} />;
}

/* ───────────── Notifications on this device ───────────── */
const PERKS: { icon: LucideIcon; text: string }[] = [
  { icon: ClipboardList, text: "New tasks assigned to you" },
  { icon: Clock, text: "Reminders before a task is due, and when it's overdue" },
  { icon: UserPlus, text: "New registrations and access requests to review" },
  { icon: Cake, text: "Team birthdays coming up" },
];

function NotificationsCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getPushState().then(setState); }, []);

  async function toggle(on: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const next = on ? await enablePush() : await disablePush();
      setState(next);
      if (next === "on") notify.created("Notifications are on", { description: "This device will be alerted even when the site is closed." });
      else if (next === "denied") notify.error("Notifications are blocked", { description: "Allow them for this site in your browser's settings, then try again." });
    } catch {
      notify.error("Couldn't change notifications on this device.");
    }
    setBusy(false);
  }

  const on = state === "on";
  const blocked = state === "denied" || state === "unsupported" || state === "unconfigured";
  const why: Partial<Record<PushState, string>> = {
    denied: "Notifications are blocked for this site. Click the lock icon next to the address, allow Notifications, then reload.",
    unsupported: "This browser can't show push notifications.",
    unconfigured: "Push notifications aren't set up on this site yet.",
  };

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex items-start gap-4">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors duration-300 ${on ? "bg-accent/15 text-accent" : "bg-slate-800 text-slate-400"}`}>
            {on ? <BellRing className="h-6 w-6" style={{ animation: "pp-ring 2.8s ease-in-out .5s infinite", transformOrigin: "50% 12%" }} aria-hidden="true" /> : <BellOff className="h-6 w-6" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-white">Push notifications</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-400">{on ? "On for this device. You'll be alerted even when the site is closed." : "Get alerted on this device, even when the site is closed."}</p>
          </div>
          <Switch.Root checked={on} disabled={state === null || blocked || busy} onCheckedChange={toggle} aria-label="Push notifications on this device" className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-slate-600 bg-slate-800 outline-none transition-colors duration-200 focus-visible:shadow-[0_0_0_3px_rgba(200,245,96,.25)] data-[checked]:border-accent data-[checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
            <Switch.Thumb className="grid h-5 w-5 translate-x-[3px] place-items-center rounded-full bg-slate-300 transition-transform duration-200 ease-out-quint data-[checked]:translate-x-[24px] data-[checked]:bg-accent-ink">
              {busy && <Loader2 className="h-3 w-3 animate-spin text-slate-700" aria-hidden="true" />}
            </Switch.Thumb>
          </Switch.Root>
        </div>

        {state && why[state] && <p role="status" className="tab-in mt-4 flex items-start gap-2 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 p-3 text-xs leading-relaxed text-[#fbbf24]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{why[state]}</p>}

      </div>

      <div className={card}>
        <h2 className="font-display text-base font-semibold text-white">What you&rsquo;ll be told about</h2>
        <ul className="mt-4 space-y-3">
          {PERKS.map(({ icon: Icon, text }, i) => (
            <li key={text} className="tab-in flex items-center gap-3 text-sm text-slate-300" style={{ animationDelay: `${i * 70 + 80}ms` }}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon className="h-4 w-4" aria-hidden="true" /></span>{text}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500"><Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> This applies to this browser only. Turn it on separately on each device you use.</p>
      </div>
    </div>
  );
}

/* ───────────── Sessions: sign out everywhere ───────────── */
function SessionsCard({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function everywhere() {
    setBusy(true);
    try { await sb.auth.signOut({ scope: "global" }); } catch { /* the local sign-out below still happens */ }
    setBusy(false); setOpen(false); onSignOut();
  }
  return (
    <>
      <div className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center`}>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-800 text-slate-300"><Smartphone className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-white">Signed in on other devices?</h2>
          <p className="mt-0.5 text-sm text-slate-400">Sign out everywhere, including this device. Useful if you used a shared or lost computer.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost shrink-0 hover:border-[#ef4444]/50 hover:text-[#f87171]"><LogOut className="h-4 w-4" aria-hidden="true" /> Sign out everywhere</button>
      </div>
      <Dialog.Root open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-clip p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 text-center outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.96] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ef4444]/10 text-[#f87171]"><Smartphone className="h-5 w-5" aria-hidden="true" /></span>
              <Dialog.Title className="mt-4 font-display text-xl font-semibold text-white">Sign out of all devices?</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-slate-400">Everywhere you&rsquo;re signed in will be signed out, including this one. You&rsquo;ll sign in again to continue.</Dialog.Description>
              <div className="mt-6 flex justify-center gap-3">
                <Dialog.Close disabled={busy} className="btn btn-ghost">Cancel</Dialog.Close>
                <button type="button" onClick={everywhere} disabled={busy} className="btn bg-[#ef4444] text-white hover:bg-[#f87171] disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Sign out everywhere</button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/* ───────────── Privacy / Terms: a reading bar, a table of contents, and a way back to the top ───────────── */
function LegalCard({ kind }: { kind: "privacy" | "terms" }) {
  const isPrivacy = kind === "privacy";
  const body = useRef<HTMLDivElement>(null);
  const [heads, setHeads] = useState<{ id: string; text: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const hs = [...el.querySelectorAll("h2")] as HTMLElement[];
    hs.forEach((h, i) => { h.id = `${kind}-s${i}`; h.style.scrollMarginTop = "6rem"; });
    setHeads(hs.map((h) => ({ id: h.id, text: h.textContent ?? "" })));
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight * 0.55);
      setProgress(Math.min(1, Math.max(0, -r.top / total)));
      let a = 0;
      hs.forEach((h, i) => { if (h.getBoundingClientRect().top < 150) a = i; });
      setActive(a);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [kind]);

  return (
    <article>
      {/* reading progress, pinned to the top edge of the screen */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[35] h-[3px] bg-slate-900/60" aria-hidden="true"><span className="block h-full origin-left bg-accent" style={{ transform: `scaleX(${progress})`, transition: "transform .12s linear" }} /></div>

      <div className={`${card} sm:p-8`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">{isPrivacy ? "Privacy Policy" : "Terms & Conditions"}</h2>
            <p className="mt-1 text-xs text-slate-500">Last updated {LEGAL_UPDATED}</p>
          </div>
          <a href={isPrivacy ? "/privacy" : "/terms"} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink className="h-4 w-4" aria-hidden="true" /> Open public page</a>
        </div>

        {heads.length > 1 && (
          <nav aria-label="On this page" className="mt-5 border-y border-slate-800 py-4">
            <p className="mb-2.5 font-mono text-[.66rem] uppercase tracking-[.18em] text-slate-500">On this page</p>
            <ul className="flex flex-wrap gap-2">
              {heads.map((h, i) => (
                <li key={h.id}>
                  <button type="button" onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-current={active === i ? "true" : undefined} className={`rounded-full border px-3 py-1 text-xs transition-colors duration-150 ${active === i ? "border-accent bg-accent/10 text-accent" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"}`}>{h.text}</button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div ref={body} className="mt-6 space-y-9 text-[.95rem] leading-relaxed text-slate-300">{isPrivacy ? <PrivacyText /> : <TermsText />}</div>

        <div className="mt-8 flex justify-end border-t border-slate-800 pt-5">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="btn btn-ghost btn-sm"><ArrowUp className="h-4 w-4" aria-hidden="true" /> Back to top</button>
        </div>
      </div>
    </article>
  );
}

/* ───────────── Sign out ───────────── */
function SignOutButton({ onSignOut, className = "" }: { onSignOut: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`group flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-3 text-left text-sm font-medium text-slate-300 transition-colors hover:border-[#ef4444]/50 hover:bg-[#ef4444]/10 hover:text-[#f87171] ${className}`}>
        <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" /> Sign out
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70 transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-clip p-4">
            <Dialog.Popup className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-6 text-center outline-none transition-[opacity,transform] duration-200 ease-out-quint data-[starting-style]:scale-[.96] data-[starting-style]:opacity-0 data-[ending-style]:scale-[.97] data-[ending-style]:opacity-0">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#ef4444]/10 text-[#f87171]"><LogOut className="h-5 w-5" aria-hidden="true" /></span>
              <Dialog.Title className="mt-4 font-display text-xl font-semibold text-white">Sign out?</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-slate-400">You&rsquo;ll need to sign in again to use the admin area.</Dialog.Description>
              <div className="mt-6 flex justify-center gap-3">
                <Dialog.Close className="btn btn-ghost">Stay signed in</Dialog.Close>
                <button type="button" onClick={onSignOut} className="btn bg-[#ef4444] text-white hover:bg-[#f87171]">Sign out</button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/* ───────────── The page ───────────── */
export default function Settings({ onSignOut, onAccountChanged }: { onSignOut: () => void; onAccountChanged: () => void }) {
  const [tab, setTab] = useState<Tab>(() => {
    const h = typeof window !== "undefined" ? window.location.hash.replace(/^#settings-?/, "") : "";
    return ALL_TABS.find((t) => t === h) ?? "overview";
  });
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setMe(await adminFetch<Me>("/api/admin/account")); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your account."); }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const pick = useCallback((t: Tab) => { setTab(t); window.history.replaceState(null, "", `/admin#settings-${t}`); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const flat = useMemo(() => TABS.flatMap((g) => g.items), []);

  // arrow keys, Home and End move through the sections when the menu has focus
  function onNavKey(e: React.KeyboardEvent) {
    const i = ALL_TABS.indexOf(tab);
    const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? ALL_TABS[(i + 1) % ALL_TABS.length]
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? ALL_TABS[(i - 1 + ALL_TABS.length) % ALL_TABS.length]
      : e.key === "Home" ? ALL_TABS[0] : e.key === "End" ? ALL_TABS[ALL_TABS.length - 1] : null;
    if (!next) return;
    e.preventDefault();
    pick(next);
    window.requestAnimationFrame(() => document.getElementById(`st-tab-${next}`)?.focus());
  }

  return (
    <section aria-labelledby="panel-title">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="panel-title" className="flex items-center gap-3 font-display text-3xl font-bold tracking-[-0.03em] text-white"><UserCog className="h-7 w-7 text-accent" aria-hidden="true" /> Settings</h1>
          <p className="mt-2 max-w-xl text-slate-400">Manage your profile, how you sign in, and read how your information is used.</p>
        </div>
        {me && <span className="tab-in inline-flex max-w-full items-center gap-2 truncate rounded-full border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs text-slate-300"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" /><span className="truncate">Signed in as {me.account.email}</span></span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-8 lg:self-start">
          {/* phones: a scrolling row of pills */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:hidden">
            {flat.map((t) => (
              <button key={t.id} type="button" onClick={() => pick(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors duration-150 ${tab === t.id ? "border-accent bg-accent/10 text-accent" : "border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white"}`}>
                <t.icon className="h-4 w-4" aria-hidden="true" />{t.label}
              </button>
            ))}
          </div>

          {/* desktop: who you are, then the sections */}
          <div className="hidden space-y-5 lg:block" onKeyDown={onNavKey}>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-3.5">
              {me ? <Avatar account={me.account} size={44} /> : <span className="h-11 w-11 animate-pulse rounded-full bg-slate-800" aria-hidden="true" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{me ? me.account.full_name || "No name set" : "Loading…"}</p>
                <p className="truncate text-xs text-slate-500">{me ? (me.role ? ROLE_LABEL[me.role] ?? me.role : "Admin") : " "}</p>
              </div>
            </div>

            {TABS.map((g) => (
              <div key={g.group}>
                <p className="px-3 pb-2 font-mono text-[.66rem] uppercase tracking-[.18em] text-slate-500">{g.group}</p>
                <ul className="space-y-0.5">
                  {g.items.map((t) => {
                    const on = tab === t.id;
                    return (
                      <li key={t.id}>
                        <button id={`st-tab-${t.id}`} type="button" tabIndex={on ? 0 : -1} onClick={() => pick(t.id)} aria-current={on ? "page" : undefined} className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${on ? "bg-slate-800/80 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}>
                          <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent transition-[transform,opacity] duration-300 ease-out-quint ${on ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"}`} aria-hidden="true" />
                          <t.icon className={`h-4 w-4 shrink-0 transition-colors ${on ? "text-accent" : "text-slate-500 group-hover:text-slate-300"}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{t.label}</span><span className="block truncate text-xs text-slate-500">{t.hint}</span></span>
                          <ChevronRight className={`h-4 w-4 shrink-0 transition-[opacity,transform] duration-200 ${on ? "translate-x-0 text-slate-400 opacity-100" : "-translate-x-1 opacity-0"}`} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <SignOutButton onSignOut={onSignOut} className="w-full" />
          </div>
        </nav>

        <div className="min-w-0" role="region" aria-label={flat.find((t) => t.id === tab)?.label}>
          {error && <p role="alert" className="mb-5 rounded-xl border border-[#ef4444]/40 p-3 text-sm text-[#f87171]">{error}</p>}
          <div key={tab} className="tab-in">
            {tab === "privacy" || tab === "terms" ? <LegalCard kind={tab} /> : tab === "notifications" ? <NotificationsCard /> : !me ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="h-36 animate-pulse rounded-2xl border border-slate-700 bg-slate-900" />
                <div className="h-56 animate-pulse rounded-2xl border border-slate-700 bg-slate-900" />
              </div>
            ) : tab === "overview" ? (
              <OverviewCard me={me} goTo={pick} />
            ) : tab === "profile" ? (
              <ProfileCard me={me} onSaved={(n) => { setMe({ ...me, account: { ...me.account, full_name: n } }); onAccountChanged(); }} goEmail={() => pick("email")} />
            ) : tab === "email" ? (
              <EmailCard me={me} onChanged={(email) => { setMe({ ...me, account: { ...me.account, email } }); onAccountChanged(); }} />
            ) : (
              <div className="space-y-5">
                <PasswordCard me={me} onChanged={load} />
                <SessionsCard onSignOut={onSignOut} />
              </div>
            )}
          </div>

          {/* phones: Sign out sits at the bottom of the page */}
          <div className="mt-6 lg:hidden"><SignOutButton onSignOut={onSignOut} className="w-full justify-center" /></div>
        </div>
      </div>
    </section>
  );
}
