import { type NextRequest } from "next/server";
import { deleteKeys, listMatchKeys, mediaReady } from "../../../_media";
import { json, requireAdmin, service } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Called after a match is deleted in the admin: removes that match's video files from the "matches" bucket (the converted
   pieces, playlists and thumbnail, and the original upload if it was still waiting), so they don't pile up and cost storage.
   It only ever touches a folder that no remaining match points to, and only a folder shaped like <folder>/abr/<name>.m3u8
   on this site's own matches address, so a wrong or foreign link can't delete anything else. */
const BASE = (process.env.NEXT_PUBLIC_R2_URL_MATCHES || "").replace(/\/+$/, "");
const SOURCE = /^uploads\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;
const FOLDER = /^([A-Za-z0-9][A-Za-z0-9._\-\/ ()]*)\/abr\/[^/]+\.m3u8$/;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  if (!mediaReady || !BASE) return json({ removed: 0, skipped: "not-configured" });

  let b: { items?: { video_url?: unknown; source_key?: unknown }[] };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  const db = service!.schema("website");
  let removed = 0;

  for (const it of items) {
    try {
      // the original upload, if the video was never converted
      if (typeof it.source_key === "string" && SOURCE.test(it.source_key)) {
        const { data } = await db.from("matches").select("id").eq("source_key", it.source_key).limit(1);
        if (!data?.length) { await deleteKeys("matches", [it.source_key]); removed++; }
      }
      // the converted video folder
      if (typeof it.video_url === "string" && it.video_url.startsWith(`${BASE}/`)) {
        const path = decodeURIComponent(new URL(it.video_url).pathname.slice(1));
        const folder = FOLDER.exec(path)?.[1];
        if (!folder || folder === "uploads" || folder.startsWith("uploads/") || folder.includes("..")) continue;
        const { data: inUse } = await db.from("matches").select("id").like("video_url", `${BASE}/${folder}/%`).limit(1);
        if (inUse?.length) continue; // another match still plays from this folder
        const keys = await listMatchKeys(`${folder}/`);
        if (keys.length) { await deleteKeys("matches", keys); removed += keys.length; }
      }
    } catch (e) {
      console.error("match video cleanup failed:", (e as Error).message);
    }
  }
  return json({ removed });
}
