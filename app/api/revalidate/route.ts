import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The instant-refresh door for the cached public data (see app/lib/data.ts).
   A database trigger on each public table calls this (through Supabase's pg_net) after every INSERT, UPDATE or DELETE, sending
   the table's name and the shared secret. The tags used by the cached data are the table names, so expiring a tag makes the
   next visit rebuild whatever used that table. Nobody without the secret can use it. */
const SECRET = process.env.REVALIDATE_SECRET || "";

// Only these tables mean anything to the cache (anything else is ignored).
const TABLES = new Set([
  "Achievements", "achievements", "Coaches", "competitions", "descriptions", "matches", "media_team", "member_roles",
  "member_team_seasons", "members", "roles", "seasons", "socials", "sponsor_company", "sponsors", "team_competitions",
  "team_members", "teams", "user_accounts",
]);

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  if (!SECRET) return reply({ error: "REVALIDATE_SECRET isn't set." }, 503);
  if (!same(req.headers.get("x-revalidate-secret") ?? "", SECRET)) return reply({ error: "Unauthorized." }, 401);

  let table = "";
  try { table = String(((await req.json()) as { table?: unknown }).table ?? ""); } catch { return reply({ error: "Bad request." }, 400); }
  if (!TABLES.has(table)) return reply({ ok: true, ignored: true });

  // { expire: 0 } = the cached copy is dropped right now, so the very next visit gets fresh data (no stale copy first)
  revalidateTag(table, { expire: 0 });
  return reply({ ok: true, revalidated: table });
}
