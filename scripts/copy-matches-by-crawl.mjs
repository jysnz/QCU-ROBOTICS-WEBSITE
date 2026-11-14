/* Copies the match videos and thumbnails from the OLD public R2 address into the "matches" bucket, and rewrites
   matches.video_url / matches.thumbnail. Use it when the old bucket is in a different Cloudflare account than the new
   buckets (so Cloudflare can't copy between them): it finds every file by following each match's video playlist, downloads
   it over the old public address (no credentials needed for that) and uploads it with a short-lived link from the Supabase
   function "r2-media". Only the Supabase service key in .env.local is used. Safe to run again: files already there are skipped.
   Dry run:  node scripts/copy-matches-by-crawl.mjs        For real:  node scripts/copy-matches-by-crawl.mjs --run */
try { process.loadEnvFile(".env.local"); } catch { /* optional */ }

const RUN = process.argv.includes("--run");
const SB = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OLD = (process.argv.find((a) => a.startsWith("--from-url="))?.split("=").slice(1).join("=") || "https://pub-314eae37bf614f109a4283e5542c64da.r2.dev").replace(/\/$/, "");
const NEW = (process.env.NEXT_PUBLIC_R2_URL_MATCHES || "").replace(/\/$/, "");
if (!SB || !KEY || !NEW) { console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_R2_URL_MATCHES in .env.local"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, label, tries = 4) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (/HTTP 404/.test(e.message) || i >= tries) throw new Error(`${label}: ${e.message}`); await sleep(600 * i * i); }
  }
}
async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}
async function fn(body) {
  const res = await fetch(`${SB}/functions/v1/r2-media`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`r2-media ${body.action} -> ${res.status} ${text.slice(0, 150)}`);
  return JSON.parse(text);
}
const keyOf = (href) => decodeURIComponent(new URL(href).pathname.slice(1));
const TYPES = { m3u8: "application/vnd.apple.mpegurl", ts: "video/mp2t", m4s: "video/mp4", mp4: "video/mp4", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", aac: "audio/aac", vtt: "text/vtt" };
const typeOf = (key, header) => (header && /^[a-z]+\/[a-z0-9.+\-]+$/i.test(header) && header !== "binary/octet-stream" ? header : TYPES[key.split(".").pop().toLowerCase()] ?? "application/octet-stream");

console.log(RUN ? "Running for real." : "DRY RUN: nothing is changed. Add --run to do it.");

// 1. the matches that point at the old address
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "website", "Content-Profile": "website", "Content-Type": "application/json" };
const rowsRes = await fetch(`${SB}/rest/v1/matches?select=id,video_url,thumbnail&limit=10000`, { headers: H });
if (!rowsRes.ok) throw new Error(`reading matches -> ${rowsRes.status}`);
const rows = (await rowsRes.json()).filter((r) => [r.video_url, r.thumbnail].some((u) => typeof u === "string" && u.startsWith(OLD)));
console.log(`${rows.length} matches use the old address.`);

// 2. every file they need: follow playlists (.m3u8) to their segments
const files = new Map(); // href -> { text? } (playlists keep their text so absolute old addresses inside can be rewritten)
const queue = rows.flatMap((r) => [r.video_url, r.thumbnail]).filter((u) => typeof u === "string" && u.startsWith(OLD));
while (queue.length) {
  const href = queue.shift().split("#")[0];
  if (files.has(href)) continue;
  if (new URL(href).pathname.toLowerCase().endsWith(".m3u8")) {
    const text = await retry(async () => (await get(href)).text(), href);
    files.set(href, { text });
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const found = t.startsWith("#") ? [...t.matchAll(/URI="([^"]+)"/g)].map((m) => m[1]) : [t];
      for (const ref of found) { const abs = new URL(ref, href).href; if (abs.startsWith(OLD)) queue.push(abs); }
    }
  } else {
    files.set(href, {});
  }
}
const all = [...files.keys()];
const have = new Set();
let token;
do { const r = await fn({ action: "list", bucket: "matches", token }); r.keys.forEach((o) => have.add(o.key)); token = r.next; } while (token);
const todo = all.filter((h) => !have.has(keyOf(h)));
console.log(`${all.length} files found (${all.filter((h) => h.endsWith(".m3u8")).length} playlists). Already in matches: ${all.length - todo.length}. To copy: ${todo.length}.`);
if (todo[0]) console.log("  e.g. " + keyOf(todo[0]));

// 3. copy
const failed = [];
const missing = []; // listed in a playlist but not in the old bucket either (nothing to copy)
let done = 0, bytes = 0;
if (RUN) {
  for (let i = 0; i < todo.length; i += 48) {
    const batch = todo.slice(i, i + 48);
    const keys = batch.map(keyOf);
    let urls;
    try {
      urls = (await fn({ action: "sign", items: batch.map((h, j) => ({ bucket: "matches", key: keys[j], method: "PUT", type: typeOf(keys[j]), expires: 3600 })) })).urls;
    } catch (e) { batch.forEach((h) => failed.push(`${keyOf(h)}: ${e.message.slice(0, 90)}`)); continue; }
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const j = next++;
        const href = batch[j];
        try {
          await retry(async () => {
            const meta = files.get(href);
            let body, type;
            if (meta.text !== undefined) { body = Buffer.from(meta.text.split(OLD).join(NEW)); type = TYPES.m3u8; }
            else { const res = await get(href); body = Buffer.from(await res.arrayBuffer()); type = typeOf(keys[j], res.headers.get("content-type")); }
            // the signed link was made for the type guessed from the name, so send exactly that
            const put = await fetch(urls[j], { method: "PUT", headers: { "Content-Type": typeOf(keys[j]) }, body: new Uint8Array(body) });
            if (!put.ok) throw new Error(`upload ${put.status}`);
            bytes += body.length;
          }, keys[j]);
          done++;
        } catch (e) { if (/HTTP 404/.test(e.message)) missing.push(keys[j]); else failed.push(e.message.slice(0, 120)); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    console.log(`  ${Math.min(i + 48, todo.length)} / ${todo.length}  (${(bytes / 1048576).toFixed(0)} MB sent)`);
  }
}

// 4. links, only when every file arrived
let rewritten = 0;
if (RUN && !failed.length) {
  for (const r of rows) {
    const body = {};
    for (const col of ["video_url", "thumbnail"]) if (typeof r[col] === "string" && r[col].startsWith(OLD)) body[col] = NEW + r[col].slice(OLD.length);
    const res = await fetch(`${SB}/rest/v1/matches?id=eq.${r.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (res.ok) rewritten++; else failed.push(`match #${r.id}: ${res.status}`);
  }
}
if (RUN) console.log(`Copied ${done} files, rewrote ${rewritten} of ${rows.length} matches.`);
else console.log(`Would then rewrite ${rows.length} matches to ${NEW}/…`);
if (missing.length) {
  const by = new Map();
  for (const k of missing) { const f = k.split("/").slice(0, -1).join("/"); by.set(f, (by.get(f) ?? 0) + 1); }
  console.log(`\n${missing.length} files are listed in playlists but do not exist in the old bucket either (they were already missing there):`);
  [...by].forEach(([f, n]) => console.log(`  ${f}: ${n}`));
}
if (failed.length) { console.log(`\n${failed.length} problems (links were NOT changed):`); failed.slice(0, 20).forEach((f) => console.log("  " + f)); process.exitCode = 1; }
