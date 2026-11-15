import { createClient } from "@supabase/supabase-js";

/* Is an email / mobile number / student ID already used by a live registration?
   A registration in the 30-day rejected archive doesn't count, so a rejected person can register again.
   An email also counts as used when it belongs to an admin login (public.user_accounts) that hasn't been rejected: that person is
   already in the system, whether or not they ever filled in the registration form.
   Used by /api/members (the final answer) and /api/members/check (the form's early warning). */
const URL_ = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const db = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

export type Taken = { email: boolean; phone: boolean; studentId: boolean };

/** Philippine mobile number -> 09XXXXXXXXX, or null when it isn't one. Spaces, dashes and brackets are ignored. */
export function normalizePhone(raw: string): string | null {
  const m = /^(?:\+?63|0)(9\d{9})$/.exec(raw.replace(/[\s\-().]/g, ""));
  return m ? "0" + m[1] : null;
}

// "_" and "%" are wildcards in ilike (and "_" is common in emails): match them literally
const literal = (v: string) => v.replace(/[\%_]/g, (c) => "\\" + c);

export async function findTaken(v: { email?: string; phone?: string; studentId?: string }): Promise<Taken> {
  const out: Taken = { email: false, phone: false, studentId: false };
  if (!db) return out;
  const alive = "registration_status.is.null,registration_status.neq.rejected";
  const members = () => db.schema("website").from("members");
  const [e, p, s, a] = await Promise.all([
    v.email ? members().select("id").ilike("email", literal(v.email.trim())).or(alive).limit(1) : null,
    v.phone ? members().select("id").eq("phone", v.phone).or(alive).limit(1) : null,
    v.studentId ? members().select("id").ilike("student_id", literal(v.studentId.trim())).or(alive).limit(1) : null,
    v.email ? db.from("user_accounts").select("id").ilike("email", literal(v.email.trim())).is("rejected_at", null).limit(1) : null,
  ]);
  for (const r of [e, p, s, a]) if (r?.error) throw new Error("database: " + r.error.message);
  out.email = !!e?.data?.length || !!a?.data?.length;
  out.phone = !!p?.data?.length;
  out.studentId = !!s?.data?.length;
  return out;
}

export const TAKEN_MESSAGE = {
  email: "This email is already registered.",
  phone: "This mobile number is already registered.",
  studentId: "This student ID is already registered.",
} as const;
