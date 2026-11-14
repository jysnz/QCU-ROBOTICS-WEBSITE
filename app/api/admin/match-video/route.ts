import crypto from "node:crypto";
import { type NextRequest } from "next/server";
import { mediaReady, signOne } from "../../_media";
import { json, requireAdmin } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Upload ticket for a match video. The admin picks a normal video file; the browser sends it straight to the "matches"
   bucket in Cloudflare R2 (uploads/<random>.<ext>) with the short-lived link returned here, because a match video is far
   too big to pass through the website. A background worker (scripts/process-match-videos.mjs) later converts it to
   streaming pieces (.m3u8 + .ts) and fills in the match's video link. */
const EXT: Record<string, string> = {
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-matroska": "mkv", "video/x-msvideo": "avi", "video/mpeg": "mpg", "video/3gpp": "3gp",
};
const MAX_BYTES = 4 * 1024 * 1024 * 1024; // one upload link can carry up to 5 GB

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  if (!mediaReady) return json({ error: "Video storage (Cloudflare R2) isn't switched on yet, so videos can't be uploaded. See supabase/r2-media-setup.md." }, 503);

  let b: { type?: unknown; size?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const type = typeof b.type === "string" ? b.type : "";
  if (!EXT[type]) return json({ error: "Use an MP4, MOV, WebM, MKV or AVI video." }, 400);
  if (typeof b.size !== "number" || b.size <= 0 || b.size > MAX_BYTES) return json({ error: "That video is too large (the limit is 4 GB)." }, 400);

  const key = `uploads/${crypto.randomUUID()}.${EXT[type]}`;
  try {
    return json({ key, uploadUrl: await signOne({ bucket: "matches", key, method: "PUT", type, expires: 3600 }) });
  } catch (e) {
    console.error("match video sign failed:", (e as Error).message);
    return json({ error: "Storage isn't available right now." }, 502);
  }
}
