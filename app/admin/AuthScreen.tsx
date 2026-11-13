"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AtSign, ChevronLeft, Eye, EyeOff, ImageIcon, Loader2, Lock, LogIn, ShieldCheck, Trophy, User, UserPlus, Users } from "lucide-react";
import Turnstile from "./Turnstile";
import { sb } from "./supabase";

/* Login / registration, styled after the QCUR-Apex sign-in screen: dark navy backdrop, centred logo, one card with
   icon fields, "OR CONTINUE WITH" divider and a Google button.
   - Email + password: posted to /api/admin/auth, which checks Cloudflare Turnstile on the server.
   - Google: Supabase's server-side OAuth. The browser is sent to Supabase, which talks to Google with the client
     secret and sends the visitor back with a one-time code (PKCE). No Google secret ever reaches this page. */
const C = { bg: "#020617", surface: "#0f172a", elevated: "#1e293b", border: "#334155", muted: "#94a3b8", accent: "#22c55e" };

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6v-3.1H1.28a12 12 0 0 0 0 10.8l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.1C6.23 6.86 8.88 4.75 12 4.75Z" />
    </svg>
  );
}

const FEATURES = [
  { icon: Users, title: "People & rosters", text: "Players, media team, members and coaches." },
  { icon: Trophy, title: "Competitions & matches", text: "Seasons, results, videos and achievements." },
  { icon: ImageIcon, title: "Photos & site content", text: "Sponsors, social links and page text." },
  { icon: ShieldCheck, title: "Approval-only access", text: "Every account is approved by an admin." },
] as const;

/* Data lanes on the brand panel: plain CSS lines (no SVG to stretch or crop, so they fit any panel size).
   Each lane draws in from the left, a pulse runs along it into a bus on the panel's right edge (the side that faces
   the sign-in card), and the junction blinks as the pulse lands. They fade out toward the text so nothing competes with it. */
const LANES = [
  { top: "8%", left: "30%", dur: 5.2, delay: 0 },
  { top: "17%", left: "52%", dur: 4.4, delay: 1.1 },
  { top: "27%", left: "38%", dur: 6.0, delay: 2.3 },
  { top: "74%", left: "44%", dur: 5.6, delay: 0.6 },
  { top: "83%", left: "28%", dur: 4.8, delay: 1.9 },
  { top: "92%", left: "50%", dur: 6.4, delay: 3.1 },
] as const;

function Lanes() {
  return (
    <div className="auth-lanes pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="auth-bus" />
      {LANES.map((l, i) => (
        <span
          key={i}
          className="auth-lane"
          style={{ top: l.top, left: l.left, "--dur": `${l.dur}s`, "--delay": `${l.delay}s`, "--i": i } as React.CSSProperties}
        >
          <i />
        </span>
      ))}
    </div>
  );
}

const lbl = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-[#94a3b8]";
const inputCls =
  "h-11 w-full rounded-xl border border-[#334155] bg-[#020617]/60 pl-10 pr-3 text-sm text-[#f8fafc] outline-none transition-colors placeholder:text-[#475569] hover:border-[#475569] focus-visible:border-[#22c55e]";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Supabase sends the visitor back with ?error_description=... if Google sign-in is refused.
  const [error, setError] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("error_description") ?? "",
  );
  const [notice, setNotice] = useState("");

  const isLogin = mode === "login";
  const switchMode = (m: "login" | "register") => { setMode(m); setError(""); setNotice(""); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(""); setNotice("");
    if (!token) { setError("Please complete the verification check first."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, name, email, password, token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      if (isLogin) {
        const { error: sessionError } = await sb.auth.setSession(body.session);
        if (sessionError) throw new Error("Couldn't start your session. Please try again.");
      } else {
        setNotice(body.message);
        setMode("login");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setToken("");
      setResetKey((k) => k + 1); // Turnstile tokens are single use
    }
  }

  async function google() {
    if (googleBusy) return;
    setError(""); setNotice("");
    setGoogleBusy(true);
    const { error: e } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin`, queryParams: { prompt: "select_account" } },
    });
    if (e) { setError("Google sign-in isn't available right now."); setGoogleBusy(false); }
    // On success the browser is already navigating to Supabase/Google.
  }

  const rise = (i: number): React.CSSProperties => ({ animation: "rise .7s var(--ease) both", animationDelay: `${i * 80 + 150}ms` });

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: C.bg, color: "#f8fafc" }}>
      {/* backdrop: drifting grid + two soft glows (shared by every screen size) */}
      <div className="auth-grid pointer-events-none absolute -inset-10" aria-hidden="true" />
      <div className="auth-orb pointer-events-none absolute rounded-full blur-[80px] -left-24 -top-24 h-96 w-96 bg-[#22c55e]/25" aria-hidden="true" />
      <div className="auth-orb pointer-events-none absolute rounded-full blur-[80px] -bottom-32 right-0 h-[28rem] w-[28rem] bg-[#6366f1]/20" style={{ animationDelay: "-6s" }} aria-hidden="true" />

      <div className="relative mx-auto grid min-h-screen max-w-[1280px] lg:grid-cols-[1.1fr_1fr]">
        {/* Brand panel: only where there is room for it */}
        <section className="relative hidden flex-col justify-between overflow-hidden px-12 py-12 lg:flex xl:px-16" aria-label="About the admin area">
          <Lanes />
          <div className="relative flex items-center gap-3" style={rise(0)}>
            <Image src="/logo-96.png" alt="" width={40} height={40} className="site-logo" />
            <span className="font-display text-lg font-semibold">QCU Robotics</span>
            <span className="rounded-md border border-[#22c55e]/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.16em] text-[#4ade80]">Admin</span>
          </div>

          <div className="relative max-w-lg">
            <p className="font-mono text-xs uppercase tracking-[.2em] text-[#4ade80]" style={rise(1)}>Team control room</p>
            <h2 className="mt-4 font-display text-5xl font-bold leading-[1.04] tracking-[-0.04em]" style={rise(2)}>
              Run the team&rsquo;s website from <span className="text-[#22c55e]">one place.</span>
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <li key={f.title} className="auth-feature flex gap-3" style={rise(i + 3)}>
                  <span className="auth-ico grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#334155] bg-[#0f172a] text-[#94a3b8]">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{f.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#94a3b8]">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.16em] text-[#64748b]" style={rise(8)}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" style={{ animation: "blink 2.4s ease-in-out infinite" }} aria-hidden="true" />
            Protected by Cloudflare Turnstile
          </p>
        </section>

        {/* Form */}
        <main className="relative mx-auto flex w-full max-w-[480px] flex-col justify-center px-4 py-10 lg:max-w-none lg:px-12">
          <div className="mx-auto w-full max-w-[440px]">
            <Link href="/" className="mb-6 inline-flex items-center gap-1 text-xs text-[#94a3b8] transition-colors hover:text-white" style={rise(0)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back to site
            </Link>

            <div className="lg:hidden" style={rise(1)}>
              <Image src="/logo-96.png" alt="QCU Robotics" width={72} height={72} className="site-logo mx-auto" priority />
            </div>
            <div key={mode} className="animate-fadeIn text-center lg:text-left">
              <h1 className="mt-4 text-lg font-semibold lg:mt-0 lg:font-display lg:text-3xl lg:font-bold lg:tracking-[-0.03em]">{isLogin ? "Welcome Back" : "Request Access"}</h1>
              <p className="mt-1 text-xs text-[#94a3b8] lg:mt-2 lg:text-sm">
                {isLogin ? "Please sign in to continue" : "An existing admin approves new accounts"}
              </p>
            </div>

            <div className="auth-card mt-6 rounded-2xl border p-4 shadow-[0_8px_30px_rgba(0,0,0,.35)] sm:p-5" style={{ background: `${C.surface}f2`, borderColor: `${C.border}80` }}>
              <form onSubmit={submit} noValidate className="space-y-3">
                <div className={`auth-swap ${isLogin ? "" : "is-open"}`} inert={isLogin}>
                  <div>
                    <div className="pb-3">
                      <label className={lbl} htmlFor="adm-name">Full Name</label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true" />
                        <input id="adm-name" className={inputCls} placeholder="Juan Dela Cruz" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required={!isLogin} />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={lbl} htmlFor="adm-email">Email Address</label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true" />
                    <input id="adm-email" type="email" className={inputCls} placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                  </div>
                </div>

                <div>
                  <label className={lbl} htmlFor="adm-pass">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true" />
                    <input
                      id="adm-pass"
                      type={show ? "text" : "password"}
                      className={`${inputCls} pr-11`}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      minLength={8}
                      maxLength={72}
                      required
                    />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#94a3b8] hover:text-white">
                      {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <div className={`auth-swap ${isLogin ? "" : "is-open"}`}><div><p className="pt-1.5 text-[11px] text-[#64748b]">At least 8 characters.</p></div></div>
                </div>

                <div className="pt-1"><Turnstile onToken={setToken} resetKey={resetKey} /></div>

                <p role="alert" className={`text-sm text-[#f87171] ${error ? "animate-fadeIn" : "hidden"}`}>{error}</p>
                {notice && <p role="status" className="animate-fadeIn rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 p-3 text-sm text-[#4ade80]">{notice}</p>}

                <button
                  type="submit"
                  disabled={busy || !token}
                  className="auth-btn flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#020617] transition-[filter,transform] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: C.accent }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : isLogin ? <LogIn className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                  {isLogin ? "Sign In" : "Create Account"}
                </button>
              </form>

              <div className="my-4 flex items-center gap-3" role="separator">
                <span className="h-px flex-1" style={{ background: `${C.border}80` }} />
                <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#94a3b8]">Or continue with</span>
                <span className="h-px flex-1" style={{ background: `${C.border}80` }} />
              </div>

              <button
                type="button"
                onClick={google}
                disabled={googleBusy}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border text-sm font-semibold text-[#f8fafc] transition-[background-color,border-color,transform] hover:border-[#475569] hover:bg-[#273449] active:scale-[.98] disabled:cursor-wait disabled:opacity-60"
                style={{ background: C.elevated, borderColor: `${C.border}80` }}
              >
                {googleBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GoogleMark />}
                Google
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-[#94a3b8]" style={rise(6)}>
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => switchMode(isLogin ? "register" : "login")} className="font-semibold text-[#22c55e] hover:underline">
                {isLogin ? "Create Account" : "Sign In"}
              </button>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
