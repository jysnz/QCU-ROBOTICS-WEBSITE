/* Rebuilds the video pieces that are missing from the higher-quality versions (480p / 720p) of the matches in the
   "matches" bucket. Each match has several versions of the same video split into the same pieces; where a 480p or 720p
   piece is missing, the same piece of the smallest version (360p) is scaled up to that size and uploaded under the exact
   name the playlist expects. The timestamps are kept, so it slots in between the real pieces. The picture in those
   seconds is an enlarged 360p, because the extra detail was never saved.
   It runs ffmpeg from the project's own @ffmpeg/core (wasm), a few pieces at a time, and uses only the Supabase service
   key in .env.local (uploads go through the "r2-media" function).
   Dry run:  node scripts/fill-missing-pieces.mjs        For real:  node scripts/fill-missing-pieces.mjs --run
   Try a few first:  --limit=3 */
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

/* ---------- worker: one ffmpeg per thread ---------- */
if (!isMainThread) {
  globalThis.self = globalThis;
  globalThis.location = { href: "file:///", pathname: "/" };
  const dir = path.join(process.cwd(), "node_modules/@ffmpeg/core/dist/umd");
  const core = await require("@ffmpeg/core")({ wasmBinary: fs.readFileSync(path.join(dir, "ffmpeg-core.wasm")), print() {}, printErr() {} });
  core.setLogger(() => {});
  parentPort.on("message", async (t) => {
    try {
      const res = await fetch(t.srcUrl);
      if (!res.ok) throw new Error(`source piece HTTP ${res.status}`);
      core.FS.writeFile("in.ts", Buffer.from(await res.arrayBuffer()));
      core.setTimeout(-1);
      core.exec("-i", "in.ts", "-vf", `scale=${t.w}:${t.h}:flags=lanczos`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p",
        "-c:a", "copy", "-copyts", "-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts", "out.ts");
      const ret = core.ret;
      core.reset();
      if (ret !== 0) throw new Error(`ffmpeg exited with ${ret}`);
      const out = core.FS.readFile("out.ts");
      core.FS.unlink("in.ts");
      core.FS.unlink("out.ts");
      parentPort.postMessage({ id: t.id, ok: true, data: out }, [out.buffer]);
    } catch (e) {
      try { core.reset(); } catch { /* ignore */ }
      parentPort.postMessage({ id: t.id, ok: false, error: String(e?.message ?? e) });
    }
  });
  parentPort.postMessage({ ready: true });
} else {
  await main();
}

/* ---------- main ---------- */
async function main() {
  try { process.loadEnvFile(".env.local"); } catch { /* optional */ }
  const RUN = process.argv.includes("--run");
  const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || Infinity;
  const WORKERS = Number(process.argv.find((a) => a.startsWith("--workers="))?.split("=")[1]) || 5;
  const SB = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const NEW = (process.env.NEXT_PUBLIC_R2_URL_MATCHES || "").replace(/\/$/, "");
  if (!SB || !KEY || !NEW) { console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_R2_URL_MATCHES in .env.local"); process.exit(1); }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const exists = async (url) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(url, { method: "HEAD" }); if (r.status === 200) return true; if (r.status === 404) return false; } catch { /* retry */ } await sleep(400 * (i + 1)); } return false; };
  const keyOf = (href) => decodeURIComponent(new URL(href).pathname.slice(1));
  const lines = (t) => t.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));

  console.log(RUN ? "Running for real." : "DRY RUN: nothing is changed. Add --run to do it.");
  const rowsRes = await fetch(`${SB}/rest/v1/matches?select=id,video_url&video_url=not.is.null&limit=10000`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "website" } });
  if (!rowsRes.ok) throw new Error(`reading matches -> ${rowsRes.status}`);
  const masters = (await rowsRes.json()).map((r) => r.video_url).filter((u) => u.startsWith(NEW) && u.endsWith(".m3u8"));

  // find what is missing
  const tasks = [];
  const problems = [];
  for (const master of masters) {
    const base = master.slice(0, master.lastIndexOf("/") + 1);
    const mtext = await (await fetch(master)).text();
    const variants = [...mtext.matchAll(/RESOLUTION=(\d+)x(\d+)[^\n]*\n([^\n#]+)/g)].map((m) => ({ w: +m[1], h: +m[2], file: m[3].trim() })).sort((a, b) => a.h - b.h);
    if (variants.length < 2) continue;
    const lists = [];
    for (const v of variants) lists.push(lines(await (await fetch(base + v.file)).text()));
    const source = lists[0]; // the smallest version
    for (let vi = 1; vi < variants.length; vi++) {
      if (lists[vi].length !== source.length) { problems.push(`${keyOf(master)}: ${variants[vi].h}p lists ${lists[vi].length} pieces but ${variants[0].h}p lists ${source.length}, skipped`); continue; }
      for (let i = 0; i < source.length; i++) {
        if (await exists(base + lists[vi][i])) continue;
        if (!(await exists(base + source[i]))) { problems.push(`${keyOf(base + lists[vi][i])}: the ${variants[0].h}p piece to build it from is missing too`); continue; }
        tasks.push({ srcUrl: base + source[i], dstUrl: base + lists[vi][i], w: variants[vi].w, h: variants[vi].h });
      }
    }
  }
  const byMatch = new Map();
  for (const t of tasks) { const f = keyOf(t.dstUrl).split("/").slice(0, -2).join("/") + ` ${t.h}p`; byMatch.set(f, (byMatch.get(f) ?? 0) + 1); }
  console.log(`${tasks.length} missing pieces to rebuild:`);
  [...byMatch].forEach(([f, n]) => console.log(`  ${f}: ${n}`));
  problems.slice(0, 10).forEach((p) => console.log("  ! " + p));
  if (!RUN) return;

  // rebuild + upload
  const todo = tasks.slice(0, LIMIT).map((t, id) => ({ ...t, id }));
  async function fn(body) {
    const res = await fetch(`${SB}/functions/v1/r2-media`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`r2-media ${res.status}`);
    return res.json();
  }
  const queue = [...todo];
  const done = [];
  const failed = [];
  const t0 = Date.now();
  const spawn = () => new Worker(new URL(import.meta.url));

  async function runWorker() {
    let w = spawn();
    await new Promise((r) => w.once("message", r)); // ready
    while (queue.length) {
      const t = queue.shift();
      const result = await new Promise((resolve) => {
        const onMsg = (m) => { if (m.id === t.id) { w.off("message", onMsg); w.off("error", onErr); resolve(m); } };
        const onErr = (e) => { w.off("message", onMsg); resolve({ id: t.id, ok: false, error: String(e?.message ?? e), crashed: true }); };
        w.on("message", onMsg);
        w.once("error", onErr);
        w.postMessage({ id: t.id, srcUrl: t.srcUrl, w: t.w, h: t.h });
      });
      if (result.crashed) { w = spawn(); await new Promise((r) => w.once("message", r)); }
      if (!result.ok) { t.tries = (t.tries ?? 0) + 1; if (t.tries < 2) queue.push(t); else failed.push(`${keyOf(t.dstUrl)}: ${result.error.slice(0, 100)}`); continue; }
      try {
        const key = keyOf(t.dstUrl);
        const { urls } = await fn({ action: "sign", items: [{ bucket: "matches", key, method: "PUT", type: "video/mp2t", expires: 3600 }] });
        const put = await fetch(urls[0], { method: "PUT", headers: { "Content-Type": "video/mp2t" }, body: result.data });
        if (!put.ok) throw new Error(`upload ${put.status}`);
        const head = await fetch(t.dstUrl, { method: "HEAD" });
        if (head.status !== 200 || Number(head.headers.get("content-length")) !== result.data.length) throw new Error(`check ${head.status}`);
        done.push(key);
        if (done.length % 10 === 0 || done.length === todo.length) console.log(`  ${done.length} / ${todo.length} done  (${Math.round((Date.now() - t0) / 60000)} min)`);
      } catch (e) { failed.push(`${keyOf(t.dstUrl)}: ${String(e.message).slice(0, 100)}`); }
    }
    await w.terminate();
  }
  await Promise.all(Array.from({ length: Math.min(WORKERS, todo.length) }, runWorker));
  console.log(`\nRebuilt and verified ${done.length} of ${todo.length} pieces in ${Math.round((Date.now() - t0) / 60000)} min.`);
  if (failed.length) { console.log(`${failed.length} problems:`); failed.slice(0, 15).forEach((f) => console.log("  " + f)); process.exitCode = 1; }
}
