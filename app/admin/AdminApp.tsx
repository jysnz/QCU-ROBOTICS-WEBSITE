"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import AuthScreen from "./AuthScreen";
import Dashboard from "./Dashboard";
import { adminFetch, sb } from "./supabase";
import { clearAll } from "./cache";
import { NotifyMe } from "./Notifications";
import RequirePassword from "./RequirePassword";

type Gate =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "unregistered"; email: string; name: string }
  | { kind: "rejected"; email: string }
  | { kind: "needs-password"; email: string; name: string }
  | { kind: "pending"; email: string }
  | { kind: "migrate" }
  | { kind: "ready"; name: string; email: string };

const Centered = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-10 sm:py-14"><div className="my-auto">{children}</div></main>
);

/* Someone signed in (with Google or email) whose email never registered at /member-reg. Instead of a dead end, they are
   taken to the registration page after a short moment, with their email already filled in. They can go right away,
   stop the countdown, or sign out. */
const REDIRECT_SECONDS = 4;
function RegisterRedirect({ email, name, onCheckAgain, onSignOut }: { email: string; name: string; onCheckAgain: () => void; onSignOut: () => void }) {
  const [left, setLeft] = useState(REDIRECT_SECONDS);
  const [paused, setPaused] = useState(false);
  const target = `/member-reg?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ""}`; // the form fills in the email and name

  useEffect(() => {
    if (paused) return;
    if (left <= 0) { window.location.assign(target); return; }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left, paused, target]);

  return (
    <div className="text-center">
      <span className="relative mx-auto grid h-20 w-20 place-items-center" aria-hidden="true">
        <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-800" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent"
            strokeDasharray={226} strokeDashoffset={paused ? 226 * (1 - left / REDIRECT_SECONDS) : 226} style={paused ? undefined : { animation: `reg-ring ${REDIRECT_SECONDS}s linear forwards` }} />
        </svg>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent"><UserPlus className="h-5 w-5" /></span>
      </span>
      <p className="kicker mt-6">One step first</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-white">Let&rsquo;s get you registered</h1>
      <p className="mx-auto mt-3 max-w-sm text-slate-400">
        {name ? <><span className="text-white">{name}</span>, </> : null}<span className="break-all text-white">{email}</span> hasn&rsquo;t registered yet. Only registered members can use the admin area, so we&rsquo;re taking you to the registration page. Your name and email will be filled in for you.
      </p>
      <p className="mt-4 text-sm text-slate-500" aria-live="polite">
        {paused ? "Redirect stopped." : <>Redirecting in <span className="tabular-nums text-white">{Math.max(left, 0)}</span>…</>}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href={target} className="btn btn-primary group">Go to registration <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" /></a>
        {paused
          ? <button type="button" onClick={onCheckAgain} className="btn btn-ghost">I&rsquo;ve registered, check again</button>
          : <button type="button" onClick={() => setPaused(true)} className="btn btn-ghost">Stay here</button>}
        <button type="button" onClick={onSignOut} className="btn btn-ghost">Sign out</button>
      </div>
    </div>
  );
}

/* Auth state machine for /admin:
   no session -> login/register; session but not approved -> waiting screen; approved -> dashboard. */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => { if (event === "SIGNED_OUT") clearAll(); setSession(s); });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const sessionEmail = session?.user.email ?? "";
  // the name Google (or the sign-up form) gave us, used to pre-fill the registration form
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const sessionName = (meta.full_name || meta.name || "").trim();
  useEffect(() => {
    if (session === undefined) return;
    if (!uid) {
      // Signed out: forget which section was open (the "#tasks-todo" part of the address), so the next sign-in always starts on the
      // Dashboard. The rest of the address stays, because the sign-in page reads sign-in errors from it. Refreshing while signed
      // in is untouched: that keeps you on the section you were in.
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGate({ kind: "signed-out" });
      return;
    }
    let cancelled = false;
    (async () => {
      // First: has this email been used to register at /member-reg? If not, stop here and say so.
      // A failed check (network, server not configured) doesn't lock anyone out; approval below is still required.
      try {
        const r = await adminFetch<{ registered: boolean }>("/api/admin/registered");
        if (cancelled) return;
        if (r.registered === false) { setGate({ kind: "unregistered", email: sessionEmail, name: sessionName }); return; }
      } catch { if (cancelled) return; }
      const { data, error } = await sb.schema("public").from("user_accounts").select("is_approved, full_name, email, rejected_at").eq("id", uid).maybeSingle();
      if (cancelled) return;
      if (error) {
        // 42703 = column does not exist: supabase/admin-approval.sql hasn't been run yet
        setGate(error.code === "42703" || /is_approved/.test(error.message) ? { kind: "migrate" } : { kind: "pending", email: sessionEmail });
      } else if (!data?.is_approved && data?.rejected_at) {
        setGate({ kind: "rejected", email: data.email || sessionEmail });
      } else if (data?.is_approved) {
        const nm = data.full_name || data.email || sessionEmail, em = data.email || sessionEmail;
        // every account needs a password, also Google sign-ins; a failed check never locks anyone out
        let hasPassword = true;
        try { hasPassword = (await adminFetch<{ hasPassword: boolean }>("/api/admin/account")).hasPassword !== false; } catch { /* keep going */ }
        if (cancelled) return;
        setGate(hasPassword ? { kind: "ready", name: nm, email: em } : { kind: "needs-password", name: nm, email: em });
      } else {
        setGate({ kind: "pending", email: data?.email || sessionEmail });
        // someone is asking for access: tell the admins (the server only does it once per account)
        adminFetch("/api/admin/access-request", { method: "POST" }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [session, uid, sessionEmail, sessionName, recheck]);

  const signOut = () => { clearAll(); sb.auth.signOut(); };

  if (gate.kind === "loading") {
    return <Centered><Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" aria-label="Loading" /></Centered>;
  }
  if (gate.kind === "signed-out") return <AuthScreen />;

  if (gate.kind === "migrate") {
    return (
      <Centered>
        <p className="kicker mb-3">Setup needed</p>
        <h1 className="font-display text-3xl font-bold text-white">The database needs one update</h1>
        <p className="mt-3 text-slate-400">
          Run <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-white">supabase/admin-approval.sql</code> in the Supabase SQL editor, then reload this page.
        </p>
        <button type="button" onClick={signOut} className="btn btn-ghost mt-8 self-start">Sign out</button>
      </Centered>
    );
  }

  if (gate.kind === "unregistered") {
    return (
      <Centered>
        <RegisterRedirect email={gate.email} name={gate.name} onCheckAgain={() => setRecheck((n) => n + 1)} onSignOut={signOut} />
      </Centered>
    );
  }

  if (gate.kind === "needs-password") {
    return (
      <Centered>
        <RequirePassword email={gate.email} name={gate.name} onDone={() => setRecheck((n) => n + 1)} onSignOut={signOut} />
      </Centered>
    );
  }

  if (gate.kind === "rejected") {
    return (
      <Centered>
        <p className="kicker mb-3">Request declined</p>
        <h1 className="font-display text-3xl font-bold text-white">Your access wasn&rsquo;t approved</h1>
        <p className="mt-3 text-slate-400">
          The account <span className="text-white">{gate.email}</span> wasn&rsquo;t approved for the admin area. If you think this is a mistake, please contact a QCU Robotics admin.
        </p>
        <div className="mt-8 flex gap-3">
          <button type="button" onClick={() => setRecheck((n) => n + 1)} className="btn btn-ghost">Check again</button>
          <button type="button" onClick={signOut} className="btn btn-primary">Sign out</button>
        </div>
        <NotifyMe />
      </Centered>
    );
  }

  if (gate.kind === "pending") {
    return (
      <Centered>
        <p className="kicker mb-3">Almost there</p>
        <h1 className="font-display text-3xl font-bold text-white">Waiting for approval</h1>
        <p className="mt-3 text-slate-400">
          Your account (<span className="text-white">{gate.email}</span>) has been created, but an existing admin has to approve it before you can manage the website.
        </p>
        <div className="mt-8 flex gap-3">
          <button type="button" onClick={() => setRecheck((n) => n + 1)} className="btn btn-primary">Check again</button>
          <button type="button" onClick={signOut} className="btn btn-ghost">Sign out</button>
        </div>
        <NotifyMe />
      </Centered>
    );
  }

  return <Dashboard name={gate.name} email={gate.email} onSignOut={signOut} onAccountChanged={() => setRecheck((n) => n + 1)} />;
}
