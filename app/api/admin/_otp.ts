import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { codeEmail, sendMail } from "../_mail";
import { service } from "./_lib";

/* One-time codes for the admin area (forgot password, change email, set a password).
   - a 6-digit code is emailed through Brevo; only a keyed hash of it is stored
   - it expires after 10 minutes, and 5 wrong tries lock it
   - after the right code, a one-time "ticket" lets the next step (choosing the new password) run without the code again */
export type Purpose = "reset" | "email_change" | "set_password";
export const CODE_MINUTES = 10;
const MAX_TRIES = 5;

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only";
const hash = (kind: "code" | "ticket", purpose: string, email: string, value: string) =>
  createHmac("sha256", SECRET).update(`${kind}|${purpose}|${email.toLowerCase()}|${value}`).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/* The subject ends with the code ("... code: 482915"). That is the pattern Gmail recognises as a verification email, so its
   apps can offer their own "Copy code" button, and the code shows in notifications without opening the email. */
const COPY: Record<Purpose, { subject: (code: string) => string; heading: string; intro: string }> = {
  reset: { subject: (c) => `Your QCU Robotics password reset code: ${c}`, heading: "Reset your password", intro: "Use this code to choose a new password for your admin account." },
  email_change: { subject: (c) => `Your QCU Robotics email confirmation code: ${c}`, heading: "Confirm your new email", intro: "Use this code in Settings to confirm this address for your admin account." },
  set_password: { subject: (c) => `Your QCU Robotics password setup code: ${c}`, heading: "Create your password", intro: "Use this code to add a password to your admin account." },
};

/** How many codes this email/purpose asked for in the last `minutes` minutes (to stop spamming someone's inbox). */
export async function recentCount(purpose: Purpose, email: string, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count } = await service!.from("otp_codes").select("id", { count: "exact", head: true }).eq("purpose", purpose).ilike("email", email.replace(/[\\%_]/g, (c) => "\\" + c)).gte("created_at", since);
  return count ?? 0;
}

/** Creates a code, replaces any earlier unused one, and emails it. Returns false if the email couldn't be sent. */
export async function issueCode(o: { purpose: Purpose; email: string; userId: string | null; payload?: Record<string, unknown> }): Promise<boolean> {
  const email = o.email.toLowerCase();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await service!.from("otp_codes").update({ used_at: new Date().toISOString() }).eq("purpose", o.purpose).ilike("email", email.replace(/[\\%_]/g, (c) => "\\" + c)).is("used_at", null);
  const { error } = await service!.from("otp_codes").insert({
    purpose: o.purpose, email, user_id: o.userId, code_hash: hash("code", o.purpose, email, code),
    payload: o.payload ?? null, expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
  });
  if (error) { console.error("Saving the code failed:", error.message); return false; }
  const c = COPY[o.purpose];
  const mail = codeEmail({ code, heading: c.heading, intro: c.intro, minutes: CODE_MINUTES });
  return sendMail(email, c.subject(code), mail.html, mail.text);
}

type Row = { id: string; user_id: string | null; email: string; payload: Record<string, unknown> | null; attempts: number };

async function latest(purpose: Purpose, email: string, userId?: string): Promise<Row | null> {
  let q = service!.from("otp_codes").select("id, user_id, email, payload, attempts").eq("purpose", purpose).is("used_at", null).gt("expires_at", new Date().toISOString());
  q = userId ? q.eq("user_id", userId) : q.ilike("email", email.replace(/[\\%_]/g, (c) => "\\" + c));
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as Row | undefined) ?? null;
}

/** Checks a code. A wrong code counts as a try; the 5th wrong try locks it. On success the code is spent and a ticket is returned. */
export async function checkCode(o: { purpose: Purpose; email: string; userId?: string; code: string }): Promise<{ ok: true; ticket: string; row: Row } | { ok: false; locked?: boolean }> {
  const row = await latest(o.purpose, o.email, o.userId);
  if (!row) return { ok: false };
  if (row.attempts >= MAX_TRIES) return { ok: false, locked: true };
  const { data: full } = await service!.from("otp_codes").select("code_hash").eq("id", row.id).single();
  const good = !!full && /^\d{6}$/.test(o.code) && same(full.code_hash, hash("code", o.purpose, row.email, o.code));
  if (!good) {
    await service!.from("otp_codes").update({ attempts: row.attempts + 1, ...(row.attempts + 1 >= MAX_TRIES ? { used_at: new Date().toISOString() } : {}) }).eq("id", row.id);
    return { ok: false, locked: row.attempts + 1 >= MAX_TRIES };
  }
  const ticket = randomBytes(24).toString("hex");
  // the code is spent; the ticket lives in its place for the rest of the 10 minutes
  await service!.from("otp_codes").update({ ticket_hash: hash("ticket", o.purpose, row.email, ticket) }).eq("id", row.id);
  return { ok: true, ticket, row };
}

/** Redeems a ticket from checkCode (once). Returns the row it belonged to, or null. */
export async function redeemTicket(o: { purpose: Purpose; email: string; userId?: string; ticket: string }): Promise<Row | null> {
  const row = await latest(o.purpose, o.email, o.userId);
  if (!row) return null;
  const { data: full } = await service!.from("otp_codes").select("ticket_hash").eq("id", row.id).single();
  if (!full?.ticket_hash || !same(full.ticket_hash, hash("ticket", o.purpose, row.email, o.ticket))) return null;
  const { data: used } = await service!.from("otp_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id).is("used_at", null).select("id");
  return used?.length ? row : null; // only the first redemption wins
}
