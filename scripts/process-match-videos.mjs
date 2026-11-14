/* Background worker for match videos. When an admin adds a match with a video, the original file is uploaded to the
   "matches" bucket (uploads/...) and the match is marked is_processing. This script picks those up, converts each video to
   a streaming version (HLS: abr/master.m3u8 + 360p/480p/720p playlists + 4-second .ts pieces), uploads it, fills in the
   match's video_url and thumbnail, switches is_processing off and deletes the original. Until then the website shows
   "still processing". A failed conversion is retried (3 tries), then the match is marked as failed with the reason.

   Needs ffmpeg and ffprobe on PATH (Windows: winget install Gyan.FFmpeg). Only the Supabase service key from .env.local is
   used: files go to R2 through the "r2-media" function, so no R2 key is needed here.
   --wasm uses the ffmpeg that ships inside this project (@ffmpeg/core) instead, so nothing needs installing. It is many times
   slower and keeps the whole video in memory, so it is only meant for short clips (it refuses anything over 300 MB).
     node scripts/process-match-videos.mjs               process whatever is waiting, then stop
     node scripts/process-match-videos.mjs --watch       keep checking every minute
     node scripts/process-match-videos.mjs --wasm        process what is waiting without installing ffmpeg (short videos)
     node scripts/process-match-videos.mjs --pending     print how many are waiting (used by the GitHub workflow)
   It also runs on its own every few minutes through .github/workflows/process-match-videos.yml. */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, appendFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { buildHlsArgs, pickLadder } from "./lib/hls-args.mjs";

try { process.loadEnvFile(".env.local"); } catch { /* optional (the workflow passes real environment variables) */ }

const SB = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUB = (process.env.NEXT_PUBLIC_R2_URL_MATCHES || "").replace(/\/$/, "");
const WATCH = process.argv.includes("--watch");
const PENDING_ONLY = process.argv.includes("--pending");
const WASM = process.argv.includes("--wasm");
const MAX_TRIES = 3;
const STALE_MIN = 90; // a conversion that started longer ago than this is assumed to have died and is picked up again
if (!SB || !KEY || !PUB) { console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_R2_URL_MATCHES."); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "website", "Content-Profile": "website", "Content-Type": "application/json" };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rest(pathAndQuery, init = {}) {
  const res = await tough(`${SB}/rest/v1/${pathAndQuery}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`database ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.status === 204 ? null : res.json();
}
/* fetch that tries again when the connection fails. After a long conversion the pooled connections are stale and the
   first request on one fails with "fetch failed"; a retry opens a fresh connection. Real HTTP answers are never retried
   except server errors (5xx). */
async function tough(url, init, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || i >= tries) return res;
    } catch (e) {
      if (i >= tries) throw e;
    }
    await sleep(500 * i * i);
  }
}
async function fn(body) {
  const res = await tough(`${SB}/functions/v1/r2-media`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`r2-media ${body.action} ${res.status}`);
  return res.json();
}

const stale = () => new Date(Date.now() - STALE_MIN * 60000).toISOString();
const pendingQuery = () => `matches?select=id,name,source_key,retry_count&is_processing=eq.true&source_key=not.is.null&retry_count=lt.${MAX_TRIES}&or=(processing_started_at.is.null,processing_started_at.lt.${stale()})&order=id.asc`;

/* ---------- ffmpeg helpers ---------- */
function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + d).slice(-1500); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} failed (${code}): ${err.split("\n").slice(-4).join(" ").trim().slice(0, 400)}`))));
  });
}
function probe(file) {
  const out = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,height:format=duration", "-of", "json", file], { encoding: "utf8" });
  if (out.status !== 0) throw new Error("ffprobe could not read the video (is it a valid video file?)");
  const j = JSON.parse(out.stdout);
  const v = (j.streams ?? []).find((s) => s.codec_type === "video");
  if (!v) throw new Error("the file has no video");
  return { height: Number(v.height) || 360, hasAudio: (j.streams ?? []).some((s) => s.codec_type === "audio"), duration: Number(j.format?.duration) || 0 };
}

const TYPE = { m3u8: "application/vnd.apple.mpegurl", ts: "video/mp2t", jpg: "image/jpeg" };
const slugOf = (name, id) => `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "match"}_${id}`;

/* ---------- ffmpeg inside this project (wasm): for short videos, no install needed ---------- */
async function convertWithWasm(srcFile, ext) {
  const bytes = await fs.readFile(srcFile);
  if (bytes.length > 300 * 1024 * 1024) throw new Error("this video is too large for the built-in converter; use ffmpeg (see the top of scripts/process-match-videos.mjs) or the GitHub workflow");
  globalThis.self = globalThis;
  globalThis.location = { href: "file:///", pathname: "/" };
  const dir = path.join(process.cwd(), "node_modules/@ffmpeg/core/dist/umd");
  const core = await createRequire(import.meta.url)("@ffmpeg/core")({ wasmBinary: readFileSync(path.join(dir, "ffmpeg-core.wasm")), print() {}, printErr() {} });
  let logs = [];
  core.setLogger(({ message }) => logs.push(message));
  const exec = (...args) => { core.setTimeout(-1); core.exec(...args); const ret = core.ret; core.reset(); return ret; };
  const input = `in${ext}`;
  core.FS.writeFile(input, bytes);
  exec("-i", input); // no output file: this just makes ffmpeg describe the video in its log
  const text = logs.join("\n");
  const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  const size = /Video:[^\n]*?(\d{2,5})x(\d{2,5})/.exec(text);
  if (!size) throw new Error("ffmpeg could not read the video (is it a valid video file?)");
  const info = { height: Number(size[2]), hasAudio: /Audio:/.test(text), duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0 };
  const ladder = pickLadder(info.height);
  log(`${info.height}p source, ${Math.round(info.duration)}s, making ${ladder.map((l) => l.h + "p").join(" + ")} with the built-in converter (this is slow)`);
  logs = [];
  if (exec(...buildHlsArgs({ input, ladder, hasAudio: info.hasAudio })) !== 0) throw new Error(`ffmpeg failed: ${logs.slice(-3).join(" ").slice(0, 300)}`);
  if (exec("-y", "-ss", String(Math.max(0, Math.min(3, info.duration / 2))), "-i", input, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", "thumb.jpg") !== 0) throw new Error("could not make the thumbnail");
  const out = core.FS.readdir("/").filter((f) => /^(master\.m3u8|stream_.+\.(m3u8|ts))$/.test(f)).map((f) => ({ name: f, read: async () => Buffer.from(core.FS.readFile(f)) }));
  return { out, thumb: { read: async () => Buffer.from(core.FS.readFile("thumb.jpg")) } };
}

/* ---------- one match ---------- */
async function processMatch(m) {
  const work = path.join(os.tmpdir(), `match-video-${m.id}`);
  await fs.rm(work, { recursive: true, force: true });
  await fs.mkdir(path.join(work, "out"), { recursive: true });
  const src = path.join(work, "source" + (path.extname(m.source_key) || ".mp4"));
  try {
    log(`#${m.id} "${m.name}": downloading the original`);
    const { urls } = await fn({ action: "sign", items: [{ bucket: "matches", key: m.source_key, method: "GET", expires: 3600 }] });
    const dl = await fetch(urls[0]);
    if (!dl.ok) throw new Error(`the uploaded video is missing (${dl.status})`);
    await pipeline(Readable.fromWeb(dl.body), createWriteStream(src));

    let out, thumb;
    if (WASM) {
      ({ out, thumb } = await convertWithWasm(src, path.extname(src) || ".mp4"));
    } else {
      const info = probe(src);
      const ladder = pickLadder(info.height);
      log(`#${m.id}: ${info.height}p source, ${Math.round(info.duration)}s, making ${ladder.map((l) => l.h + "p").join(" + ")}`);
      await run("ffmpeg", buildHlsArgs({ input: src, ladder, hasAudio: info.hasAudio }), path.join(work, "out"));
      await run("ffmpeg", ["-y", "-ss", String(Math.max(0, Math.min(3, info.duration / 2))), "-i", src, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", path.join(work, "thumbnail.jpg")], work);
      out = (await fs.readdir(path.join(work, "out"))).map((f) => ({ name: f, read: () => fs.readFile(path.join(work, "out", f)) }));
      thumb = { read: () => fs.readFile(path.join(work, "thumbnail.jpg")) };
    }

    // upload everything under competition_matches/<slug>/
    const folder = `competition_matches/${slugOf(m.name, m.id)}`;
    const files = [...out.map((f) => ({ read: f.read, key: `${folder}/abr/${f.name}` })), { read: thumb.read, key: `${folder}/thumbnail.jpg` }];
    log(`#${m.id}: uploading ${files.length} files`);
    for (let i = 0; i < files.length; i += 40) {
      const batch = files.slice(i, i + 40);
      const { urls: puts } = await fn({ action: "sign", items: batch.map((f) => ({ bucket: "matches", key: f.key, method: "PUT", type: TYPE[f.key.split(".").pop()] ?? "application/octet-stream", expires: 3600 })) });
      let next = 0;
      await Promise.all(Array.from({ length: 6 }, async () => {
        while (next < batch.length) {
          const j = next++;
          const body = await batch[j].read();
          const r = await tough(puts[j], { method: "PUT", headers: { "Content-Type": TYPE[batch[j].key.split(".").pop()] ?? "application/octet-stream" }, body });
          if (!r.ok) throw new Error(`upload of ${batch[j].key} failed (${r.status})`);
        }
      }));
    }

    const updated = await rest(`matches?id=eq.${m.id}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ video_url: `${PUB}/${folder}/abr/master.m3u8`, thumbnail: `${PUB}/${folder}/thumbnail.jpg`, is_processing: false, source_key: null, processing_error: null, processing_started_at: null }) });
    if (!updated.length) {
      // the match was deleted while its video was being converted: don't leave the files behind
      const keys = [...files.map((f) => f.key), m.source_key];
      for (let i = 0; i < keys.length; i += 400) await fn({ action: "delete", bucket: "matches", keys: keys.slice(i, i + 400) }).catch(() => {});
      log(`#${m.id}: the match was deleted meanwhile, its files were removed`);
      return;
    }
    try { await fn({ action: "delete", bucket: "matches", keys: [m.source_key] }); } catch { /* the original is just left behind */ }
    log(`#${m.id}: done, ${PUB}/${folder}/abr/master.m3u8`);
  } catch (e) {
    const tries = (m.retry_count ?? 0) + 1;
    const giveUp = tries >= MAX_TRIES;
    log(`#${m.id}: failed (${tries}/${MAX_TRIES}): ${e.message}`);
    await rest(`matches?id=eq.${m.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ retry_count: tries, processing_error: String(e.message).slice(0, 400), processing_started_at: null, ...(giveUp ? { is_processing: false } : {}) }) }).catch(() => {});
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

/* ---------- main loop ---------- */
async function cycle() {
  const waiting = await rest(pendingQuery());
  for (const m of waiting) {
    // claim it so a second worker doesn't convert the same video
    const claimed = await rest(`matches?id=eq.${m.id}&is_processing=eq.true&or=(processing_started_at.is.null,processing_started_at.lt.${stale()})`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ processing_started_at: new Date().toISOString() }) });
    if (!claimed.length) continue;
    await processMatch(m);
  }
  return waiting.length;
}

if (PENDING_ONLY) {
  const n = (await rest(pendingQuery())).length;
  console.log(`pending=${n}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `pending=${n}
`);
} else if (!WASM && (spawnSync("ffmpeg", ["-version"]).status !== 0 || spawnSync("ffprobe", ["-version"]).status !== 0)) {
  console.error("ffmpeg and ffprobe are needed. On Windows: winget install Gyan.FFmpeg, then open a new terminal. Or add --wasm to use the converter built into this project (short videos only).");
  process.exitCode = 1;
} else {
  do {
    const n = await cycle();
    if (!WATCH) { log(n ? `finished ${n} video(s)` : "nothing waiting"); break; }
    await sleep(60000);
  } while (true);
}
