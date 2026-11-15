import { type NextRequest } from "next/server";
import { mailConfigured, noticeEmail, sendMail } from "../../../_mail";
import { json, makeLimiter, requireAdmin, service } from "../../_lib";
import { checkCode, issueCode, recentCount, redeemTicket } from "../../_otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Change the account's email, in two steps:
     request { email }   emails a 6-digit code to the NEW address
     confirm { code }    checks it and switches the account to the new address
   The new address must be one that registered at /member-reg (the admin login only lets registered emails in), unless the
   account holds an admin role. Nobody else's account can already be using it. */
const wrong = makeLimiter(8, 10 * 60_000);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { action?: unknown; email?: unknown; code?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }

  if (b.action === "request") {
    const next = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 254) : "";
    if (!EMAIL_RE.test(next)) return json({ error: "Enter a valid email address." }, 400);
    if (next === admin.email.toLowerCase()) return json({ error: "That is already your email." }, 400);
    if (!mailConfigured()) return json({ error: "Email isn't set up yet, so a code can't be sent. Please contact an admin." }, 503);
    const { data: taken } = await service!.from("user_accounts").select("id").ilike("email", next.replace(/[\\%_]/g, (c) => "\\" + c)).neq("id", admin.userId).limit(1);
    if (taken?.length) return json({ error: "Another account already uses that email.", field: "email" }, 400);
    if ((await recentCount("email_change", next, 10)) >= 3) return json({ error: "A code was already sent a few times. Please wait 10 minutes." }, 429);
    const sent = await issueCode({ purpose: "email_change", email: next, userId: admin.userId, payload: { from: admin.email } });
    return sent ? json({ ok: true, message: "We sent a 6-digit code to the new email." }) : json({ error: "We couldn't send the email. Please try again." }, 502);
  }

  if (b.action === "confirm") {
    if (wrong.blocked(admin.userId)) return json({ error: "Too many wrong codes. Please wait a few minutes." }, 429);
    const code = typeof b.code === "string" ? b.code.trim() : "";
    const r = await checkCode({ purpose: "email_change", email: "", userId: admin.userId, code });
    if (!r.ok) { wrong.hit(admin.userId); return json({ error: r.locked ? "Too many wrong codes. Ask for a new code." : "That code isn't right, or it has expired.", locked: !!r.locked }, 400); }
    const row = await redeemTicket({ purpose: "email_change", email: "", userId: admin.userId, ticket: r.ticket });
    if (!row) return json({ error: "This request expired. Please start again." }, 400);
    const next = row.email; // the code was sent to the new address, so that is where it is stored
    const { error } = await service!.auth.admin.updateUserById(admin.userId, { email: next, email_confirm: true });
    if (error) { console.error("Email change failed:", error.message); return json({ error: "We couldn't change the email. Try a different one." }, 400); }
    await service!.from("user_accounts").update({ email: next }).eq("id", admin.userId);
    // tell the old address, in case it wasn't them
    const old = admin.email;
    if (old) {
      const note = noticeEmail({
        heading: "Your email was changed",
        intro: "The email address on your QCU Robotics admin account was just changed.",
        details: [["Old email", old], ["New email", next]],
        warning: "If you didn't make this change, contact a QCU Robotics admin right away.",
      });
      await sendMail(old, "Your QCU Robotics email was changed", note.html, note.text);
    }
    return json({ ok: true, email: next });
  }

  return json({ error: "Unknown request." }, 400);
}
