import { type NextRequest } from "next/server";
import { mediaReady, publicUrl, randomName, signOne } from "../../_media";
import { json, requireAdmin } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Photo uploads from the admin pages (PhotoDropzone). Returns a short-lived link the browser uploads to directly,
   plus the permanent public address to save in the database. Every picture goes to the public "otherphotos" bucket
   in a folder for its kind. When R2 isn't switched on it answers { fallback: true } and the page uses Supabase Storage. */
const FOLDERS = new Set(["members", "media_team", "team_members", "coaches", "Competition_pictures", "Achievement_pictures", "Sponsor_pictures", "uploads"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  if (!mediaReady) return json({ fallback: true });

  let b: { folder?: unknown; type?: unknown; size?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const folder = typeof b.folder === "string" ? b.folder : "";
  const type = typeof b.type === "string" ? b.type : "";
  if (!FOLDERS.has(folder) || !EXT[type] || typeof b.size !== "number" || b.size <= 0 || b.size > MAX) return json({ error: "That image can't be uploaded." }, 400);

  const key = `${folder}/${randomName(EXT[type])}`;
  try {
    const uploadUrl = await signOne({ bucket: "otherphotos", key, method: "PUT", type });
    return json({ uploadUrl, publicUrl: publicUrl("otherphotos", key), key });
  } catch (e) {
    console.error("media sign failed:", (e as Error).message);
    return json({ error: "Storage isn't available right now." }, 502);
  }
}
