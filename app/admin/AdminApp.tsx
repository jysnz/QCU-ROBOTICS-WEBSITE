"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import AuthScreen from "./AuthScreen";
import Dashboard from "./Dashboard";
import { adminFetch, sb } from "./supabase";
import { NotifyMe } from "./Notifications";

type Gate =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "unregistered"; email: string }
  | { kind: "rejected"; email: string }
  | { kind: "pending"; email: string }
  | { kind: "migrate" }
  | { kind: "ready"; name: string; email: string };

const Centered = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">{children}</main>
);

/* Auth state machine for /admin:
   no session -> login/register; session but not approved -> waiting screen; approved -> dashboard. */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [gate, setGate] = useState<Gate>({ kind: "loading" });
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const sessionEmail = session?.user.email ?? "";
  useEffect(() => {
    if (session === undefined) return;
    if (!uid) {
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
        if (r.registered === false) { setGate({ kind: "unregistered", email: sessionEmail }); return; }
      } catch { if (cancelled) return; }
      const { data, error } = await sb.schema("public").from("user_accounts").select("is_approved, full_name, email, rejected_at").eq("id", uid).maybeSingle();
      if (cancelled) return;
      if (error) {
        // 42703 = column does not exist: supabase/admin-approval.sql hasn't been run yet
        setGate(error.code === "42703" || /is_approved/.test(error.message) ? { kind: "migrate" } : { kind: "pending", email: sessionEmail });
      } else if (!data?.is_approved && data?.rejected_at) {
        setGate({ kind: "rejected", email: data.email || sessionEmail });
      } else if (data?.is_approved) {
        setGate({ kind: "ready", name: data.full_name || data.email || sessionEmail, email: data.email || sessionEmail });
      } else {
        setGate({ kind: "pending", email: data?.email || sessionEmail });
        // someone is asking for access: tell the admins (the server only does it once per account)
        adminFetch("/api/admin/access-request", { method: "POST" }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [session, uid, sessionEmail, recheck]);

  const signOut = () => { sb.auth.signOut(); };

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
        <p className="kicker mb-3">One step first</p>
        <h1 className="font-display text-3xl font-bold text-white">Register before you sign in</h1>
        <p className="mt-3 text-slate-400">
          The email <span className="text-white">{gate.email}</span> hasn&rsquo;t been used to register yet. You need to register on the member registration page with this same email before you can enter the admin area.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/member-reg" className="btn btn-primary">Go to registration</a>
          <button type="button" onClick={() => setRecheck((n) => n + 1)} className="btn btn-ghost">I&rsquo;ve registered, check again</button>
          <button type="button" onClick={signOut} className="btn btn-ghost">Sign out</button>
        </div>
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

  return <Dashboard name={gate.name} email={gate.email} onSignOut={signOut} />;
}
