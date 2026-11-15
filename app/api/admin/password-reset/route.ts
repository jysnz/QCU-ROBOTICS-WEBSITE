import { type NextRequest } from "next/server";
import { mailConfigured } from "../../_mail";
import { clientIp, json, makeLimiter, service, verifyHuman } from "../_lib";
import { checkCode, issueCode, recentCount, redeemTicket } from "../_otp";
import { passwordIssue } from "../../../lib/passwordRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Forgot password, in three steps (the login page walks the person through them):
     request       { email, token }                  emails a 6-digit code (Cloudflare Turnstile checked)
     verify        { email, code }                   checks the code, answers with a one-time ticket
     set-password  { email, ticket, password }       sets the new password
   The answer to "request" is the same whether or not the email has an account, so this can't be used to find out who is registered. */
const requests = makeLimiter(8, 60 * 60_000);   // per network
const guesses = makeLimiter(30, 10 * 60_000);   // wrong codes / tickets per network
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  if (!service) return json({ error: "The admin area isn't configured yet." }, 503);
  const ip = clientIp(req);
  let b: Record<string, unknown>;
  try { b = (await req.json()) ?? {}; } catch { return json({ error: "That request couldn't be read." }, 400); }
  const email = text(b.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email address." }, 400);

  if (b.action === "request") {
    if (requests.blocked(ip)) return json({ error: "Too many requests. Please wait a while and try again." }, 429);
    const human = await verifyHuman(b.token, ip);
    if (!human.ok) {
      if (human.misconfigured || human.unavailable) return json({ error: "Verification is unavailable right now. Please try again later." }, 503);
      return json({ error: "Please complete the verification check and try again." }, 400);
    }
    if (!mailConfigured()) return json({ error: "Email isn't set up yet, so a code can't be sent. Please contact an admin." }, 503);
    requests.hit(ip);

    const { data: acct } = await service.from("user_accounts").select("id").ilike("email", email.replace(/[\\%_]/g, (c) => "\\" + c)).maybeSingle();
    // Only send when the account exists and this inbox hasn't been asked 3 times in 10 minutes. Either way the reply is the same.
    if (acct && (await recentCount("reset", email, 10)) < 3) await issueCode({ purpose: "reset", email, userId: acct.id });
    return json({ ok: true, message: "If that email has an account, we've sent a 6-digit code to it." });
  }

  if (b.action === "verify") {
    if (guesses.blocked(ip)) return json({ error: "Too many tries. Please wait a few minutes." }, 429);
    const r = await checkCode({ purpose: "reset", email, code: text(b.code, 6) });
    if (!r.ok) {
      guesses.hit(ip);
      return json({ error: r.locked ? "Too many wrong codes. Ask for a new code." : "That code isn't right, or it has expired.", locked: !!r.locked }, 400);
    }
    return json({ ok: true, ticket: r.ticket });
  }

  if (b.action === "set-password") {
    if (guesses.blocked(ip)) return json({ error: "Too many tries. Please wait a few minutes." }, 429);
    const password = typeof b.password === "string" ? b.password : "";
    const weak = passwordIssue(password, email);
    if (weak) return json({ error: weak }, 400);
    const row = await redeemTicket({ purpose: "reset", email, ticket: text(b.ticket, 64) });
    if (!row?.user_id) { guesses.hit(ip); return json({ error: "This reset has expired. Please start again." }, 400); }
    // The code proved they own this inbox, so the email is also marked confirmed (an unconfirmed account could otherwise stay locked out).
    const { error } = await service.auth.admin.updateUserById(row.user_id, { password, email_confirm: true });
    if (error) { console.error("Password reset failed:", error.message); return json({ error: "We couldn't change the password. Try a different one." }, 400); }
    await service.from("user_accounts").update({ has_password: true }).eq("id", row.user_id);
    return json({ ok: true, message: "Your password was changed. You can sign in now." });
  }

  return json({ error: "Unknown request." }, 400);
}

