import { NextResponse, type NextRequest } from "next/server";
import { clientIp, makeLimiter } from "../../admin/_lib";
import { findTaken, normalizePhone } from "../_dupes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The registration form asks this when you press Continue, so you learn that an email, mobile number or student ID is already
   registered right away instead of after filling in all five pages. It only answers yes or no per field, and only a limited
   number of times per person (the real check runs again when the form is submitted). */
const limiter = makeLimiter(40, 10 * 60_000);
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (limiter.blocked(ip)) return reply({ error: "Too many checks. Please wait a few minutes." }, 429);
  limiter.hit(ip);
  let b: Record<string, unknown>;
  try { b = (await req.json()) ?? {}; } catch { return reply({ error: "Bad request." }, 400); }

  const str = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
  const email = str(b.email, 120).toLowerCase();
  const phone = normalizePhone(str(b.phone, 24)) ?? "";
  const studentId = str(b.studentId, 20);
  try {
    const t = await findTaken({
      email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : undefined,
      phone: phone || undefined,
      studentId: /^[A-Za-z0-9][A-Za-z0-9-]{3,19}$/.test(studentId) ? studentId : undefined,
    });
    return reply({ taken: t });
  } catch (e) {
    console.error("Duplicate check failed:", (e as Error).message);
    return reply({ error: "Couldn't check right now." }, 503);
  }
}
