import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { approvedAccountIds, notifyUsers } from "../../_notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Daily job (see vercel.json, runs 08:00 Philippine time). Vercel calls it with "Authorization: Bearer <CRON_SECRET>".
     - birthdays: everyone with a registered birthday 3 days away, and on the day, is announced to every approved account
     - tasks due within 24 hours: the people who haven't finished them are reminded
     - tasks that became overdue in the last 24 hours: same people, once
   Each notification has a dedupe key, so running it twice (or manually) never notifies anyone twice. */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const db = process.env.SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL
  ? createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today's date in Manila as a UTC-midnight Date, so day arithmetic isn't thrown off by the server's time zone. */
function manilaToday() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET isn't set." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!db) return NextResponse.json({ error: "The database isn't configured." }, { status: 503 });

  const sent = { birthdays: 0, due: 0, late: 0 };

  // ── birthdays ──
  const everyone = await approvedAccountIds();
  const { data: members } = await db.schema("website").from("members").select("id, name, birthday, registration_status").not("birthday", "is", null);
  const today = manilaToday();
  for (const m of members ?? []) {
    if (m.registration_status === "pending" || m.registration_status === "rejected") continue;
    const mt = /^\d{4}-(\d{2})-(\d{2})$/.exec(m.birthday ?? "");
    if (!mt) continue;
    const month = +mt[1] - 1, day = +mt[2];
    let next = new Date(Date.UTC(today.getUTCFullYear(), month, day));
    if (next < today) next = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day));
    const away = Math.round((next.getTime() - today.getTime()) / 86_400_000);
    if (away !== 3 && away !== 0) continue;
    await notifyUsers(everyone, {
      type: "birthday",
      title: away === 0 ? `🎂 It's ${m.name}'s birthday today` : `🎂 ${m.name}'s birthday is in 3 days`,
      body: away === 0 ? "Don't forget to greet them." : `${MONTHS[month]} ${day}. Time to prepare the pubmat.`,
      link: "/admin#tasks-assign",
      dedupe: `bday:${m.id}:${next.getUTCFullYear()}:${away}`,
    });
    sent.birthdays++;
  }

  // ── tasks due soon / overdue ──
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const { data: tasks } = await db.schema("website").from("tasks")
    .select("id, title, due_at, task_assignees(user_id, status)")
    .gte("due_at", iso(now - 86_400_000)).lte("due_at", iso(now + 86_400_000));
  for (const t of (tasks ?? []) as { id: string; title: string; due_at: string; task_assignees: { user_id: string; status: string }[] }[]) {
    const waiting = t.task_assignees.filter((a) => a.status !== "done").map((a) => a.user_id);
    if (!waiting.length) continue;
    const overdue = new Date(t.due_at).getTime() < now;
    await notifyUsers(waiting, overdue
      ? { type: "task_late", title: `Overdue: ${t.title}`, body: "This task is past its due time.", link: "/admin#tasks-todo", dedupe: `late:${t.id}` }
      : { type: "task_due", title: `Due soon: ${t.title}`, body: "Due within the next 24 hours.", link: "/admin#tasks-todo", dedupe: `due:${t.id}` });
    sent[overdue ? "late" : "due"]++;
  }

  return NextResponse.json({ ok: true, ...sent });
}
