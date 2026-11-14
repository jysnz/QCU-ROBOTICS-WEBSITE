/* Copies the match videos and thumbnails from the old R2 bucket (qcur-images) into the "matches" bucket and rewrites
   matches.video_url / matches.thumbnail. The copy happens inside Cloudflare through the Supabase function "r2-media", so
   no R2 key is needed here: only the Supabase service key already in .env.local. Safe to run again (skips what is there).
   Dry run:  node scripts/copy-matches-via-function.mjs        For real:  node scripts/copy-matches-via-function.mjs --run */
try { process.loadEnvFile(".env.local"); } catch { /* optional */ }

const RUN = process.argv.includes("--run");
const SB = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OLD_URL = (process.argv.find((a) => a.startsWith("--from-url="))?.split("=").slice(1).join("=") || "https://pub-314eae37bf614f109a4283e5542c64da.r2.dev").replace(/\/$/, "");
const NEW_URL = (process.env.NEXT_PUBLIC_R2_URL_MATCHES || "").replace(/\/$/, "");
if (!SB || !KEY || !NEW_URL) { console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_R2_URL_MATCHES in .env.local"); process.exit(1); }

async function fn(body) {
  const res = await fetch(`${SB}/functions/v1/r2-media`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`r2-media ${body.action} -> ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}
async function listAll(bucket) {
  const out = [];
  let token;
  do {
    const r = await fn({ action: "list", bucket, token });
    out.push(...r.keys);
    token = r.next;
  } while (token);
  return out;
}

console.log(RUN ? "Running for real." : "DRY RUN: nothing is changed. Add --run to do it.");
const legacy = await listAll("legacy");
const have = new Set((await listAll("matches")).map((o) => o.key));
const todo = legacy.filter((o) => !have.has(o.key));
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`Old bucket: ${legacy.length} files (${mb(legacy.reduce((a, o) => a + o.size, 0))} MB). Already in matches: ${legacy.length - todo.length}. To copy: ${todo.length}.`);

let copied = 0;
const failed = [];
if (RUN) {
  for (let i = 0; i < todo.length; i += 60) {
    const batch = todo.slice(i, i + 60);
    const items = batch.map((o) => ({ from: { bucket: "legacy", key: o.key }, to: { bucket: "matches", key: o.key } }));
    try {
      await fn({ action: "copy", items });
      copied += batch.length;
    } catch {
      // one bad file shouldn't sink the batch: retry them one by one
      for (const it of items) {
        try { await fn({ action: "copy", items: [it] }); copied++; } catch (e) { failed.push(`${it.from.key}: ${e.message.slice(0, 80)}`); }
      }
    }
    console.log(`  ${Math.min(i + 60, todo.length)} / ${todo.length}`);
  }
}

// links in the database
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "website", "Content-Profile": "website", "Content-Type": "application/json" };
const rowsRes = await fetch(`${SB}/rest/v1/matches?select=id,video_url,thumbnail&limit=10000`, { headers: H });
if (!rowsRes.ok) throw new Error(`reading matches -> ${rowsRes.status}`);
let rewritten = 0;
for (const r of await rowsRes.json()) {
  const body = {};
  for (const col of ["video_url", "thumbnail"]) if (typeof r[col] === "string" && r[col].startsWith(OLD_URL)) body[col] = NEW_URL + r[col].slice(OLD_URL.length);
  if (!Object.keys(body).length) continue;
  rewritten++;
  if (!RUN) continue;
  if (failed.length) continue; // don't point a match at files that didn't all arrive
  const res = await fetch(`${SB}/rest/v1/matches?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!res.ok) failed.push(`match #${r.id}: ${res.status}`);
}
console.log(`Links ${RUN ? "rewritten" : "that would be rewritten"}: ${rewritten}.`);
if (RUN) console.log(`Copied ${copied} files.`);
if (failed.length) { console.log(`\n${failed.length} problems:`); failed.slice(0, 15).forEach((f) => console.log("  " + f)); process.exitCode = 1; }
