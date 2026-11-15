import { type NextRequest } from "next/server";
import { anonClient, clientIp, json, makeLimiter, service, verifyHuman } from "../_lib";
import { passwordIssue } from "../../../lib/passwordRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Admin login + registration. Both require a valid Cloudflare Turnstile token, verified here on the server.
   Login returns the Supabase session tokens; the browser then calls supabase.auth.setSession().
   Registering only creates the account: it stays unapproved until an approved admin approves it. */
const failures = makeLimiter(15, 10 * 60 * 1000);
const signups = makeLimiter(5, 60 * 60 * 1000);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  if (!service) return json({ error: "The admin area isn't configured yet." }, 503);
  const ip = clientIp(req);
  if (failures.blocked(ip)) return json({ error: "Too many attempts. Please wait a few minutes and try again." }, 429);

  let b: Record<string, unknown>;
  try { b = (await req.json()) ?? {}; } catch { return json({ error: "That request couldn't be read." }, 400); }

  const human = await verifyHuman(b.token, ip);
  if (!human.ok) {
    if (human.misconfigured || human.unavailable) return json({ error: "Verification is unavailable right now. Please try again later." }, 503);
    failures.hit(ip);
    return json({ error: "Please complete the verification check and try again." }, 400);
  }

  const email = text(b.email, 254).toLowerCase();
  const password = typeof b.password === "string" ? b.password : "";
  if (!EMAIL_RE.test(email) || password.length < 8 || password.length > 72) {
    failures.hit(ip);
    return json({ error: b.action === "register" ? "Enter a valid email and a password of at least 8 characters." : "Incorrect email or password." }, 400);
  }

  if (b.action === "login") {
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      failures.hit(ip);
      return json({ error: "Incorrect email or password." }, 401);
    }
    return json({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
  }

  if (b.action === "register") {
    if (signups.blocked(ip)) return json({ error: "Too many sign-ups from this network. Please try again later." }, 429);
    const name = text(b.name, 80);
    if (name.length < 2) return json({ error: "Please enter your full name." }, 400);
    const weak = passwordIssue(password, email);
    if (weak) return json({ error: weak }, 400);
    signups.hit(ip);

    const { data, error } = await anonClient().auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) {
      failures.hit(ip);
      return json({ error: "We couldn't create that account. Try a different email or a stronger password." }, 400);
    }
    // A brand-new user has identities; an already-registered email comes back with none (and no error),
    // so the response below is identical either way and doesn't reveal which emails exist.
    if (data.user && (data.user.identities?.length ?? 0) > 0) {
      await service.from("user_accounts").upsert(
        { id: data.user.id, email, full_name: name, profile_complete: true, has_password: true },
        { onConflict: "id" },
      );
    }
    return json({ ok: true, message: "Account created. Confirm your email if you receive a message, then wait for an admin to approve your access." });
  }

  return json({ error: "Unknown request." }, 400);
}
