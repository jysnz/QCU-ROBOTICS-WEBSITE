import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* Shared helpers for the /admin API routes.
   Server env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
   TURNSTILE_SECRET_KEY (or the Supabase edge function "verify-turnstile", same as /api/members). */
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TS_SECRET = process.env.TURNSTILE_SECRET_KEY || "";
const TS_VERIFY_URL = process.env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const service = SERVICE_KEY && SUPABASE_URL
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export const anonClient = () =>
  createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const clientIp = (req: NextRequest) =>
  req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/* Per-IP failure counter, in memory per instance: a safety net, Turnstile is the real gate. */
export function makeLimiter(limit: number, windowMs: number) {
  const map = new Map<string, { count: number; resetAt: number }>();
  return {
    blocked(ip: string) {
      const e = map.get(ip);
      return !!e && e.resetAt > Date.now() && e.count >= limit;
    },
    hit(ip: string) {
      const now = Date.now();
      const cur = map.get(ip);
      if (!cur || cur.resetAt <= now) map.set(ip, { count: 1, resetAt: now + windowMs });
      else cur.count++;
      if (map.size > 5000) for (const [k, v] of map) if (v.resetAt <= now) map.delete(k);
    },
  };
}

export async function verifyHuman(token: unknown, ip: string): Promise<{ ok: boolean; unavailable?: boolean; misconfigured?: boolean }> {
  if (typeof token !== "string" || !token || token.length > 2048) return { ok: false };
  try {
    let r: Response;
    if (TS_SECRET) {
      const body = new URLSearchParams({ secret: TS_SECRET, response: token });
      if (ip !== "unknown") body.set("remoteip", ip);
      r = await fetch(TS_VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    } else if (service) {
      r = await fetch(`${SUPABASE_URL}/functions/v1/verify-turnstile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ token, remoteip: ip !== "unknown" ? ip : undefined }),
        signal: AbortSignal.timeout(8000),
      });
    } else {
      return { ok: false, misconfigured: true };
    }
    const j = await r.json().catch(() => ({}));
    const codes: string[] = j.errorCodes || j["error-codes"] || [];
    if (codes.includes("not-configured")) return { ok: false, misconfigured: true };
    if (r.status === 401 || r.status === 403 || r.status >= 500) return { ok: false, unavailable: true };
    return { ok: j.success === true };
  } catch {
    return { ok: false, unavailable: true };
  }
}

/* Whether this login may use /admin at all: the email must have been used to register at /member-reg (a rejected
   registration doesn't count). Accounts that hold an admin role (super admin, media head, assistant) are exempt, so the
   people who run the site can't be locked out. Matching ignores upper/lower case. */
export async function isRegistered(userId: string, email: string): Promise<boolean> {
  if (!service) return false;
  const mail = email.trim();
  const pattern = mail.replace(/[\\%_]/g, (c) => "\\" + c); // "_" and "%" are ilike wildcards: match them literally
  // both lookups go out together (one round trip instead of two)
  const [{ data: role }, member] = await Promise.all([
    service.schema("website").from("admin_roles").select("role").eq("user_id", userId).maybeSingle(),
    mail
      ? service.schema("website").from("members").select("id").ilike("email", pattern).or("registration_status.is.null,registration_status.neq.rejected").limit(1)
      : Promise.resolve({ data: [] as { id: number }[] }),
  ]);
  return !!role || !!member.data?.length;
}

/* Caller must send "Authorization: Bearer <supabase access token>" for an account with is_approved = true. */
/* A login that passed every check is remembered for 20 seconds. The admin page asks for several things at once (counts, lists,
   the bell), and each would otherwise repeat the same four lookups. The only cost: someone rejected or revoked in the last
   20 seconds can still finish what they were doing. */
const verified = new Map<string, { exp: number; userId: string; email: string }>();
const VERIFIED_MS = 20_000;

export async function requireAdmin(req: NextRequest): Promise<
  { ok: true; userId: string; email: string } | { ok: false; res: NextResponse }
> {
  if (!service) return { ok: false, res: json({ error: "The admin area isn't configured yet." }, 503) };
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "")?.[1];
  if (!token) return { ok: false, res: json({ error: "Please sign in." }, 401) };
  const hit = verified.get(token);
  if (hit && hit.exp > Date.now()) return { ok: true, userId: hit.userId, email: hit.email };

  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) return { ok: false, res: json({ error: "Please sign in again." }, 401) };
  const email = data.user.email ?? "";
  // registered? and approved? are independent: ask both at once
  const [registered, { data: acct }] = await Promise.all([
    isRegistered(data.user.id, email),
    service.from("user_accounts").select("is_approved").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!registered) return { ok: false, res: json({ error: "Register first at /member-reg with this email.", code: "not-registered" }, 403) };
  if (!acct?.is_approved) return { ok: false, res: json({ error: "Your account hasn't been approved yet." }, 403) };

  if (verified.size > 300) for (const [k, v] of verified) if (v.exp <= Date.now()) verified.delete(k);
  verified.set(token, { exp: Date.now() + VERIFIED_MS, userId: data.user.id, email });
  return { ok: true, userId: data.user.id, email };
}
