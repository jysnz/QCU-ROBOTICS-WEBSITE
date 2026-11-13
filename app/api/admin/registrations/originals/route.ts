import { type NextRequest } from "next/server";
import { folderOf, listOriginals, r2Enabled } from "../../../_r2";
import { json, requireAdmin, service } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Signed links to one person's original (full-resolution) photos in Cloudflare R2. Approved admins only. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  if (!r2Enabled) return json({ originals: [], enabled: false });

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return json({ error: "Bad request." }, 400);

  const { data } = await service!.schema("website").from("members").select("photo_paths").eq("id", id).maybeSingle();
  const folder = folderOf((data?.photo_paths as string[] | null)?.[0]);
  if (!folder) return json({ originals: [], enabled: true });

  try {
    const list = await listOriginals(folder);
    const originals = list.map((o) => ({ slot: Number(/orig-(\d+)\./.exec(o.key)?.[1] ?? 0), size: o.size, url: o.url }));
    return json({ originals, enabled: true });
  } catch (e) {
    console.error("R2 list failed:", (e as Error).message);
    return json({ originals: [], enabled: true, error: "Couldn't reach the original photos." });
  }
}
