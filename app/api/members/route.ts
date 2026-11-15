import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { makeTicket, r2Enabled } from "../_r2";
import { deleteKeys, mediaReady, putBytes } from "../_media";
import { approvedAccountIds, notifyUsers } from "../_notify";
import { findTaken, normalizePhone, TAKEN_MESSAGE, type Taken } from "./_dupes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Member registration (POST only). Writes to the same Supabase project as the rest of the site:
   photos -> Storage bucket "member-pictures", details -> table website.members.
   Server env: SUPABASE_SERVICE_ROLE_KEY (legacy service_role JWT), TURNSTILE_SITE_KEY,
   optional TURNSTILE_SECRET_KEY (otherwise the Supabase edge function "verify-turnstile" is used). */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TS_SECRET = process.env.TURNSTILE_SECRET_KEY || "";
const TS_VERIFY_URL = process.env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const BUCKET = "member-pictures";
const PHOTO_COUNT = 5;
const UPLOAD_CONCURRENCY = 3;

const sb = SERVICE_KEY && SUPABASE_URL
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const notConfigured = () => json({ error: "Registration isn't available yet. Please try again later." }, 503);
const tooMany = () => json({ error: "Too many attempts. Please wait a few minutes and try again." }, 429);

/* ---------- rate limiting (per IP, in memory per instance: a safety net, Turnstile is the real gate) ---------- */
const WINDOW_MS = 10 * 60 * 1000;
const SUBMIT_LIMIT = 500;
const FAIL_LIMIT = 40;
type Counter = { count: number; resetAt: number };
const submits = new Map<string, Counter>();
const failures = new Map<string, Counter>();
function bump(map: Map<string, Counter>, ip: string) {
  const now = Date.now();
  const cur = map.get(ip);
  if (!cur || cur.resetAt <= now) map.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else cur.count++;
  if (map.size > 5000) for (const [k, v] of map) if (v.resetAt <= now) map.delete(k);
}
const over = (map: Map<string, Counter>, ip: string, limit: number) => {
  const e = map.get(ip);
  return !!e && e.resetAt > Date.now() && e.count >= limit;
};
const clientIp = (req: NextRequest) =>
  req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

/* ---------- validation helpers ---------- */
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, 30)).filter(Boolean))].slice(0, 30) : [];
const PROGRAMS = [
  "Bachelor of Science in Computer Engineering",
  "Bachelor of Science in Electronics Engineering",
  "Bachelor of Science in Industrial Engineering",
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Information Systems",
  "Bachelor of Science in Information Technology",
  "Bachelor of Science in Accountancy",
  "Bachelor of Science in Entrepreneurship",
  "Bachelor of Early Childhood Education",
];
const GENDERS = ["Male", "Female", "LGBTQIA+", "Prefer not to say"];
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year+"];

const ROLES = ["member", "media", "player"];
const ROLE_PRIORITY = ["player", "media", "member"]; // which one counts as the person's main role (the `role` column)

type Img = { buf: Buffer; ext: "jpg" | "png"; type: string };
function decodeImage(v: unknown, maxBytes: number): Img | { tooLarge: true } | null {
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(typeof v === "string" ? v : "");
  if (!match) return null;
  const buf = Buffer.from(match[2], "base64");
  if (buf.length > maxBytes) return { tooLarge: true };
  // The label in the data URL is just text the sender chose. Check the file's real first bytes match it, so a script or
  // any other file renamed as a photo is rejected.
  const isPng = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (match[1] === "png" ? !isPng : !isJpg) return null;
  return { buf, ext: match[1] === "png" ? "png" : "jpg", type: match[1] === "png" ? "image/png" : "image/jpeg" };
}
const isImg = (x: Img | { tooLarge: true } | null): x is Img => !!x && !("tooLarge" in x);

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (!failure) {
      const i = next++;
      if (i >= items.length) return;
      try { await fn(items[i]); } catch (e) { failure = failure || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return failure;
}

/* ---------- Cloudflare Turnstile ---------- */
async function verifyHuman(token: unknown, ip: string) {
  if (typeof token !== "string" || !token || token.length > 2048) return { ok: false };
  try {
    let r: Response;
    if (TS_SECRET) {
      const body = new URLSearchParams({ secret: TS_SECRET, response: token });
      if (ip !== "unknown") body.set("remoteip", ip);
      r = await fetch(TS_VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    } else if (sb) {
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
    if (codes.includes("not-configured")) { console.error("The edge function has no TURNSTILE_SECRET_KEY secret yet"); return { ok: false, misconfigured: true }; }
    if (r.status === 401 || r.status === 403) { console.error("verify-turnstile rejected the key. Use the legacy service_role key (starts with eyJ)."); return { ok: false, unavailable: true }; }
    if (r.status >= 500) return { ok: false, unavailable: true };
    return { ok: j.success === true };
  } catch {
    return { ok: false, unavailable: true };
  }
}

export async function POST(req: NextRequest) {
  if (!sb) { console.error("SUPABASE_SERVICE_ROLE_KEY is not set"); return notConfigured(); }
  const ip = clientIp(req);
  if (over(submits, ip, SUBMIT_LIMIT) || over(failures, ip, FAIL_LIMIT)) return tooMany();
  bump(submits, ip);

  const res = await handle(req, ip);
  // Count only failed attempts (not 429/5xx) so a crowd submitting at once isn't mistaken for an attack.
  if (res.status >= 400 && res.status < 500 && res.status !== 429) bump(failures, ip);
  return res;
}

async function handle(req: NextRequest, ip: string): Promise<NextResponse> {
  if (!sb) return notConfigured();
  let b: Record<string, unknown>;
  try { b = (await req.json()) ?? {}; } catch { return json({ error: "That request couldn't be read." }, 400); }

  const m = {
    firstName: str(b.firstName, 40),
    lastName: str(b.lastName, 40),
    program: str(b.program, 80),
    year: str(b.year, 20),
    section: str(b.section, 20),
    birthday: str(b.birthday, 10),
    gender: str(b.gender, 20),
    email: str(b.email, 120).toLowerCase(),
    studentId: str(b.studentId, 20),
    phone: str(b.phone, 24),
    hobbies: list(b.hobbies),
    likes: list(b.likes),
    about: str(b.about, 240),
  };
  const bd = /^\d{4}-\d{2}-\d{2}$/.test(m.birthday) ? new Date(m.birthday + "T00:00:00") : null;
  if (!bd || isNaN(bd.getTime()) || bd > new Date() || m.birthday < "1950-01-01")
    return json({ error: "Please enter a valid birthday." }, 400);
  if (!GENDERS.includes(m.gender)) return json({ error: "Please select your gender." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email)) return json({ error: "Please enter a valid email address." }, 400);
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{3,19}$/.test(m.studentId)) return json({ error: "Please enter a valid student ID.", field: "studentId" }, 400);
  // Philippine mobile number: 09XXXXXXXXX, 639XXXXXXXXX or +639XXXXXXXXX (spaces, dashes and brackets are ignored). Saved as 09XXXXXXXXX.
  const phone = normalizePhone(m.phone);
  if (!phone) return json({ error: "Please enter a valid mobile number, like 0917 123 4567.", field: "phone" }, 400);
  if (!m.firstName || !m.lastName || !PROGRAMS.includes(m.program) || !m.section || !YEARS.includes(m.year))
    return json({ error: "Please complete all required fields." }, 400);
  if (!m.hobbies.length || !m.likes.length) return json({ error: "Choose at least one hobby and one like." }, 400);
  // A person can be several things at once (a player who also does media). Older pages send a single `role`.
  const picked = (Array.isArray(b.roles) ? b.roles : b.role ? [b.role] : []).map((x: unknown) => str(x, 10));
  const roles = ROLE_PRIORITY.filter((r) => picked.includes(r));
  if (!roles.length || picked.some((x: string) => !ROLES.includes(x))) return json({ error: "Please choose at least one: Member, Media or Player." }, 400);
  const role = roles[0];

  const photoList = Array.isArray(b.photos) ? b.photos : [];
  if (photoList.length !== PHOTO_COUNT) return json({ error: `Please add exactly ${PHOTO_COUNT} photos.` }, 400);
  const imgs: Img[] = [];
  for (const p of photoList) {
    const img = decodeImage(p, 3 * 1024 * 1024);
    if (!img) return json({ error: "One of the photos is not a valid image." }, 400);
    if (!isImg(img)) return json({ error: "A photo is too large." }, 413);
    imgs.push(img);
  }
  const thumbRaw = b.thumb ? decodeImage(b.thumb, 150 * 1024) : null;
  const thumb = isImg(thumbRaw) && thumbRaw.ext === "jpg" ? thumbRaw : null;

  const human = await verifyHuman(b.captchaToken, ip);
  if (human.misconfigured) { console.error("Human check is not configured"); return notConfigured(); }
  if (human.unavailable) return json({ error: "We couldn't run the human check. Please try again.", code: "captcha" }, 503);
  if (!human.ok) return json({ error: "The human check didn't pass. Please try again.", code: "captcha" }, 400);

  const duplicate = (t: Taken) => {
    const fields = (["email", "phone", "studentId"] as const).filter((f) => t[f]);
    return json({ error: TAKEN_MESSAGE[fields[0]], field: fields[0], fields, messages: Object.fromEntries(fields.map((f) => [f, TAKEN_MESSAGE[f]])) }, 409);
  };
  const id = crypto.randomUUID();
  const folder = `registrations/${id}`;
  const paths: string[] = [];
  // With Cloudflare R2 on, the 5 submitted photos go to the private "memberpictures" bucket. The public profile picture
  // is only published (to "otherphotos") when an admin approves the registration. Otherwise they go to Supabase as before.
  const useR2 = mediaReady;
  const cleanup = async () => {
    if (!paths.length) return;
    try { if (useR2) await deleteKeys("memberpictures", paths); else await sb.storage.from(BUCKET).remove(paths); } catch {}
  };

  try {
    // Email, mobile number and student ID can each belong to only one live registration (one in the 30-day rejected archive doesn't count).
    const taken = await findTaken({ email: m.email, phone, studentId: m.studentId });
    if (taken.email || taken.phone || taken.studentId) { console.warn("Registration refused: already used ->", Object.entries(taken).filter(([, v]) => v).map(([k]) => k).join(", ")); return duplicate(taken); }

    const jobs = imgs.map((img, i) => ({ path: `${folder}/${i + 1}.${img.ext}`, img }));
    if (thumb && !useR2) jobs.push({ path: `${folder}/thumb.jpg`, img: thumb });
    const failure = await mapLimit(jobs, UPLOAD_CONCURRENCY, async (j) => {
      if (useR2) {
        await putBytes("memberpictures", j.path, j.img.buf, j.img.type);
      } else {
        const { error } = await sb.storage.from(BUCKET).upload(j.path, j.img.buf, { contentType: j.img.type, upsert: false });
        if (error) throw new Error("storage: " + error.message);
      }
      paths.push(j.path);
    });
    if (failure) throw failure;

    const photoPaths = jobs.slice(0, PHOTO_COUNT).map((j) => j.path);
    // The 800 px profile photo, not the 192 px thumb: this is the picture the site shows once the registration is approved.
    const imageUrl = useR2 ? null : sb.storage.from(BUCKET).getPublicUrl(photoPaths[0]).data.publicUrl; // R2: nothing public until approval
    const { data, error } = await sb.schema("website").from("members").insert({
      name: `${m.firstName} ${m.lastName}`,
      image_url: imageUrl,
      is_active: true,
      first_name: m.firstName,
      last_name: m.lastName,
      gender: m.gender,
      birthday: m.birthday,
      email: m.email,
      student_id: m.studentId,
      phone,
      program: m.program,
      year_level: m.year,
      section: m.section,
      hobbies: m.hobbies,
      likes: m.likes,
      about: m.about,
      photo_paths: photoPaths,
      photo_store: useR2 ? "r2" : "supabase",
      registration_status: "pending",
      role,
      roles,
      is_accepted: false, // every new registration waits for approval
    }).select("id").single();
    if (error) {
      await cleanup();
      if (error.code === "23505") { // two people sent the same value at the same moment: the database rule decides
        const t: Taken = { email: /members_email_unique/i.test(error.message), phone: /members_phone_unique/i.test(error.message), studentId: /members_student_id_unique|student_id/i.test(error.message) };
        if (t.email || t.phone || t.studentId) return duplicate(t);
      }
      throw new Error("database: " + error.message);
    }
    // Tell every admin there is a new registration to review (never blocks or fails the sign-up).
    await notifyUsers(await approvedAccountIds(), {
      type: "registration",
      title: "New registration to review",
      body: `${m.firstName} ${m.lastName} signed up as ${roles.join(", ") || role}.`,
      link: "/admin#registrations",
      dedupe: `reg:${data.id}`,
    });
    // With Cloudflare R2 set up, the browser now uploads the full-resolution originals itself (see /api/members/originals).
    return json({ ok: true, id: data.id, ...(r2Enabled ? { upload: { ticket: makeTicket(id) } } : {}) }, 201);
  } catch (e) {
    console.error("Registration failed:", (e as Error).message);
    await cleanup();
    return json({ error: "We couldn't save your registration right now. Please try again in a moment." }, 502);
  }
}
