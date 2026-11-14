/* One-time move of the files that are in Supabase Storage (and the match videos in the old R2 bucket) to the Cloudflare R2
   buckets, then the links in the database are rewritten to match. Safe to run again: files already copied are skipped.
   It never deletes anything, so the old copies stay until you remove them yourself.

   Dry run (default, changes nothing):  node scripts/migrate-to-r2.mjs
   For real:                            node scripts/migrate-to-r2.mjs --run
   Only some steps:                     --only=photos,registrations,tasks,matches

   Needs these in the environment. The Supabase and public-URL values are read from .env.local; the R2 key is not stored
   there, so pass it on the command line (use an API token that can read and write all four buckets):
     R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY
   Steps:
     photos         images + member-pictures (Supabase) -> otherphotos (R2, same folders), links rewritten in the database
     registrations  the 5 submitted photos of each registration -> memberpictures (private); approved people get their profile
                    photo published to otherphotos/members
     tasks          task attachments (Supabase task-files) -> tasks (private)
     matches        needs  --matches-from-bucket=<old bucket>  --matches-from-url=<its old public address>
                    copies every object into the matches bucket and rewrites matches.video_url / matches.thumbnail */
import { AwsClient } from "aws4fetch";
import crypto from "node:crypto";

try { process.loadEnvFile(".env.local"); } catch { /* optional */ }

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const RUN = args.includes("--run");
const ONLY = (flag("only") ?? "photos,registrations,tasks,matches").split(",");

const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}`); process.exit(1); } return v; };
const SB = (process.env.SUPABASE_URL || need("NEXT_PUBLIC_SUPABASE_URL")).replace(/\/$/, "");
const SB_KEY = need("SUPABASE_SERVICE_ROLE_KEY");
const ACCOUNT = need("R2_ACCOUNT_ID");
const B = {
  memberpictures: process.env.R2_BUCKET || "memberpictures",
  tasks: process.env.R2_BUCKET_TASKS || "tasks",
  otherphotos: process.env.R2_BUCKET_OTHERPHOTOS || "otherphotos",
  matches: process.env.R2_BUCKET_MATCHES || "matches",
};
const PUB = {
  otherphotos: (process.env.NEXT_PUBLIC_R2_URL_OTHERPHOTOS || "").replace(/\/$/, ""),
  matches: (process.env.NEXT_PUBLIC_R2_URL_MATCHES || "").replace(/\/$/, ""),
};
const r2 = new AwsClient({ accessKeyId: need("R2_ACCESS_KEY_ID"), secretAccessKey: need("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto" });

const enc = (k) => k.split("/").map(encodeURIComponent).join("/");
const r2Url = (bucket, key = "") => `https://${ACCOUNT}.r2.cloudflarestorage.com/${bucket}${key ? "/" + enc(key) : ""}`;
const log = (...a) => console.log(...a);
const tally = {};
const count = (k) => { tally[k] = (tally[k] ?? 0) + 1; };

/* ---------- R2 ---------- */
async function r2Exists(bucket, key) { return (await r2.fetch(r2Url(bucket, key), { method: "HEAD" })).ok; }
async function r2Put(bucket, key, bytes, type) {
  const res = await r2.fetch(r2Url(bucket, key), { method: "PUT", headers: { "Content-Type": type || "application/octet-stream" }, body: bytes });
  if (!res.ok) throw new Error(`R2 PUT ${bucket}/${key} -> ${res.status}`);
}
async function r2Copy(fromBucket, fromKey, toBucket, toKey) {
  const res = await r2.fetch(r2Url(toBucket, toKey), { method: "PUT", headers: { "x-amz-copy-source": `/${fromBucket}/${enc(fromKey)}` } });
  if (!res.ok) throw new Error(`R2 COPY ${fromBucket}/${fromKey} -> ${res.status}`);
}
async function r2List(bucket) {
  const keys = [];
  let token = "";
  for (;;) {
    const u = new URL(r2Url(bucket));
    u.searchParams.set("list-type", "2");
    if (token) u.searchParams.set("continuation-token", token);
    const res = await r2.fetch(u);
    if (!res.ok) throw new Error(`R2 LIST ${bucket} -> ${res.status}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    token = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "";
    if (!token) return keys;
  }
}

/* ---------- Supabase ---------- */
const sbH = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
async function sbWalk(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const res = await fetch(`${SB}/storage/v1/object/list/${bucket}`, { method: "POST", headers: { ...sbH, "Content-Type": "application/json" }, body: JSON.stringify({ prefix, limit: 100, offset }) });
    if (!res.ok) throw new Error(`Supabase list ${bucket}/${prefix} -> ${res.status}`);
    const page = await res.json();
    for (const it of page) {
      if (it.id) out.push(prefix + it.name);
      else out.push(...(await sbWalk(bucket, `${prefix}${it.name}/`)));
    }
    if (page.length < 100) return out;
  }
}
async function sbDownload(bucket, path) {
  const res = await fetch(`${SB}/storage/v1/object/${bucket}/${enc(path)}`, { headers: sbH });
  if (!res.ok) throw new Error(`Supabase download ${bucket}/${path} -> ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") };
}
const rest = (table, qs = "", init = {}) => fetch(`${SB}/rest/v1/${table}${qs}`, { ...init, headers: { ...sbH, "Accept-Profile": "website", "Content-Profile": "website", "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) } });
async function rows(table, select, filter = "") {
  const res = await rest(table, `?select=${select}${filter}&limit=10000`, { method: "GET", headers: { Prefer: "" } });
  if (!res.ok) { log(`  (skipping ${table}: ${res.status})`); return []; }
  return res.json();
}
async function patch(table, id, body) {
  if (!RUN) return;
  const res = await rest(table, `?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PATCH ${table} ${id} -> ${res.status} ${await res.text()}`);
}

/* Copies one Supabase object into an R2 bucket (skips it if already there). */
async function moveObject(sbBucket, path, r2Bucket, r2Key = path) {
  if (await r2Exists(r2Bucket, r2Key)) { count("already there"); return true; }
  if (!RUN) { count("would copy"); return true; }
  try {
    const { bytes, type } = await sbDownload(sbBucket, path);
    await r2Put(r2Bucket, r2Key, bytes, type);
    count("copied");
    return true;
  } catch (e) { log("  ! " + e.message); count("failed"); return false; }
}

const PUBLIC_RE = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

/* ---------- steps ---------- */
// Folders in otherphotos, and which one each table's pictures belong in.
const FOLDERS = new Set(["members", "media_team", "team_members", "coaches", "Competition_pictures", "Achievement_pictures", "Sponsor_pictures", "uploads"]);
const TABLE_FOLDER = { team_members: "team_members", media_team: "media_team", members: "members", Coaches: "coaches", competitions: "Competition_pictures", Achievements: "Achievement_pictures", sponsor_company: "Sponsor_pictures", sponsors: "Sponsor_pictures" };

async function photos() {
  log("\n== photos: site pictures -> otherphotos ==");
  if (!PUB.otherphotos) throw new Error("NEXT_PUBLIC_R2_URL_OTHERPHOTOS is not set");
  const done = new Set(); // "bucket/path" that is in R2 now
  for (const bucket of ["images", "member-pictures"]) {
    for (const path of await sbWalk(bucket)) {
      // Only the site's own picture folders. (The images bucket is shared with another app; registrations have their own step.)
      if (!FOLDERS.has(path.split("/")[0])) { count("skipped (not a site picture)"); continue; }
      if (await moveObject(bucket, path, "otherphotos")) done.add(`${bucket}/${path}`);
    }
  }
  for (const [table, col] of Object.entries({ team_members: "profile_image_url", media_team: "image_url", members: "image_url", Coaches: "image_url", competitions: "image_url", Achievements: "image_url", sponsor_company: "image_url", sponsors: "image_url" })) {
    for (const r of await rows(table, `id,${col}`, `&${col}=like.*/storage/v1/object/public/*`)) {
      const url = r[col] ?? "";
      const m = PUBLIC_RE.exec(url.split("?")[0]);
      if (!m) continue;
      const path = decodeURIComponent(m[2]);
      if (path.startsWith("registrations/")) continue; // handled in the registrations step
      let key = path;
      if (!(url.startsWith(SB) && done.has(`${m[1]}/${path}`))) {
        // A picture in another Supabase project (or one the walk didn't list): fetch it from its public address.
        key = FOLDERS.has(path.split("/")[0]) ? path : `${TABLE_FOLDER[table]}/${path.split("/").pop()}`;
        if (!(await r2Exists("otherphotos", key))) {
          if (!RUN) { count("would copy (other project)"); }
          else {
            const res = await fetch(url.split("?")[0]);
            if (!res.ok) { log(`  ! ${table} #${r.id}: could not fetch ${url} (${res.status}), link left as it is`); count("failed"); continue; }
            await r2Put("otherphotos", key, Buffer.from(await res.arrayBuffer()), res.headers.get("content-type"));
            count("copied (other project)");
          }
        }
      }
      const next = `${PUB.otherphotos}/${enc(key)}`;
      log(`  ${table} #${r.id}: -> ${next}`);
      await patch(table, r.id, { [col]: next });
      count("links rewritten");
    }
  }
}

async function registrations() {
  log("\n== registrations: submitted photos -> memberpictures (private), profile photo -> otherphotos/members ==");
  for (const r of await rows("members", "id,name,photo_paths,photo_store,registration_status,image_url", "&photo_store=eq.supabase&photo_paths=not.is.null")) {
    const paths = r.photo_paths ?? [];
    if (!paths.length) continue;
    let ok = true;
    for (const p of paths) ok = (await moveObject("member-pictures", p, "memberpictures")) && ok;
    if (!ok) { log(`  ! ${r.name}: some photos failed, left on Supabase`); continue; }
    const update = { photo_store: "r2" };
    if (r.registration_status === "pending") update.image_url = null; // nothing is public before approval
    else if (r.image_url) {
      const key = `members/${(paths[0].split("/")[1] ?? crypto.randomUUID())}-${Date.now()}.${paths[0].endsWith(".png") ? "png" : "jpg"}`;
      if (RUN) await r2Copy(B.memberpictures, paths[0], B.otherphotos, key);
      update.image_url = `${PUB.otherphotos}/${key}`;
    }
    log(`  ${r.name}: ${paths.length} photos -> R2${update.image_url ? `, profile ${update.image_url}` : ""}`);
    await patch("members", r.id, update);
    count("registrations moved");
  }
}

async function tasks() {
  log("\n== tasks: attachments -> tasks bucket (private) ==");
  for (const f of await rows("task_files", "id,path,name", "&store=eq.supabase")) {
    if (await moveObject("task-files", f.path, "tasks")) {
      await patch("task_files", f.id, { store: "r2" });
      count("task files moved");
    }
  }
}

async function matches() {
  log("\n== matches: old bucket -> matches ==");
  const from = flag("matches-from-bucket");
  const fromUrl = (flag("matches-from-url") ?? "").replace(/\/$/, "");
  if (!from || !fromUrl || !PUB.matches) { log("  skipped: pass --matches-from-bucket=<name> and --matches-from-url=<old public address> (and set NEXT_PUBLIC_R2_URL_MATCHES)"); return; }
  const keys = await r2List(from);
  log(`  ${keys.length} objects in ${from}`);
  for (const k of keys) {
    if (await r2Exists(B.matches, k)) { count("already there"); continue; }
    if (!RUN) { count("would copy"); continue; }
    try { await r2Copy(from, k, B.matches, k); count("copied"); } catch (e) { log("  ! " + e.message); count("failed"); }
  }
  for (const r of await rows("matches", "id,video_url,thumbnail")) {
    const body = {};
    for (const col of ["video_url", "thumbnail"]) if (typeof r[col] === "string" && r[col].startsWith(fromUrl)) body[col] = PUB.matches + r[col].slice(fromUrl.length);
    if (Object.keys(body).length) { log(`  match #${r.id}: ${Object.values(body).join(" , ")}`); await patch("matches", r.id, body); count("links rewritten"); }
  }
}

log(RUN ? "Running for real." : "DRY RUN: nothing is changed. Add --run to do it.");
const steps = { photos, registrations, tasks, matches };
for (const s of ONLY) {
  if (!steps[s]) { log(`Unknown step "${s}"`); continue; }
  await steps[s]();
}
log("\nDone.", JSON.stringify(tally));
