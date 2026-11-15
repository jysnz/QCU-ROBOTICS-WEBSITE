import { type NextRequest } from "next/server";
import { mailConfigured } from "../../../_mail";
import { anonClient, json, makeLimiter, requireAdmin, service } from "../../_lib";
import { checkCode, issueCode, recentCount, redeemTicket } from "../../_otp";
import { passwordIssue } from "../../../../lib/passwordRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Change the account's password.
     request-code  {}                       emails a 6-digit code to the account's email
     verify-code   { code }                 checks it and answers with a one-time ticket (the page then shows the password form)
     set           { ticket, newPassword }  sets the new password (a first password for a Google-only account, or a replacement)
     change        { currentPassword, newPassword }   the older way for an account that has a password, kept for API callers
   Changing needs the current password (checked against Supabase), so a stolen open browser can't quietly lock the owner out. */
const wrong = makeLimiter(6, 10 * 60_000);

const validNew = (pw: string, email: string) => passwordIssue(pw, email);

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { action?: unknown; currentPassword?: unknown; newPassword?: unknown; code?: unknown; ticket?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const newPassword = typeof b.newPassword === "string" ? b.newPassword : "";

  if (b.action === "change") {
    if (wrong.blocked(admin.userId)) return json({ error: "Too many wrong attempts. Please wait a few minutes." }, 429);
    const current = typeof b.currentPassword === "string" ? b.currentPassword : "";
    const why = validNew(newPassword, admin.email);
    if (why) return json({ error: why, field: "new" }, 400);
    if (newPassword === current) return json({ error: "Choose a password you haven't used here.", field: "new" }, 400);
    const { data: u } = await service!.auth.admin.getUserById(admin.userId);
    if (!(u?.user?.identities ?? []).some((i) => i.provider === "email")) return json({ error: "This account signs in with Google and has no password yet.", code: "no-password" }, 400);
    const check = await anonClient().auth.signInWithPassword({ email: admin.email, password: current });
    if (check.error) { wrong.hit(admin.userId); return json({ error: "Your current password is incorrect.", field: "current" }, 400); }
    const { error } = await service!.auth.admin.updateUserById(admin.userId, { password: newPassword });
    if (error) return json({ error: "We couldn't change the password. Try a different one.", field: "new" }, 400);
    await service!.from("user_accounts").update({ has_password: true }).eq("id", admin.userId);
    return json({ ok: true });
  }

  if (b.action === "request-code") {
    if (!mailConfigured()) return json({ error: "Email isn't set up yet, so a code can't be sent. Please contact an admin." }, 503);
    if ((await recentCount("set_password", admin.email, 10)) >= 3) return json({ error: "A code was already sent a few times. Please wait 10 minutes." }, 429);
    const sent = await issueCode({ purpose: "set_password", email: admin.email, userId: admin.userId });
    return sent ? json({ ok: true, message: "We sent a 6-digit code to your email." }) : json({ error: "We couldn't send the email. Please try again." }, 502);
  }

  if (b.action === "verify-code") {
    if (wrong.blocked(admin.userId)) return json({ error: "Too many wrong codes. Please wait a few minutes." }, 429);
    const code = typeof b.code === "string" ? b.code.trim() : "";
    const r = await checkCode({ purpose: "set_password", email: admin.email, userId: admin.userId, code });
    if (!r.ok) { wrong.hit(admin.userId); return json({ error: r.locked ? "Too many wrong codes. Ask for a new code." : "That code isn't right, or it has expired.", field: "code", locked: !!r.locked }, 400); }
    return json({ ok: true, ticket: r.ticket });
  }

  if (b.action === "set") {
    if (wrong.blocked(admin.userId)) return json({ error: "Too many attempts. Please wait a few minutes." }, 429);
    const why = validNew(newPassword, admin.email);
    if (why) return json({ error: why, field: "new" }, 400); // checked before the ticket is used, so a weak password doesn't burn it
    const ticket = typeof b.ticket === "string" ? b.ticket.trim().slice(0, 64) : "";
    const row = await redeemTicket({ purpose: "set_password", email: admin.email, userId: admin.userId, ticket });
    if (!row) { wrong.hit(admin.userId); return json({ error: "This request expired. Please start again.", code: "expired" }, 400); }
    const { error } = await service!.auth.admin.updateUserById(admin.userId, { password: newPassword });
    if (error) return json({ error: "We couldn't set the password. Try a different one.", field: "new" }, 400);
    await service!.from("user_accounts").update({ has_password: true }).eq("id", admin.userId);
    return json({ ok: true });
  }

  return json({ error: "Unknown request." }, 400);
}
