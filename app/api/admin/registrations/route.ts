import { type NextRequest } from "next/server";
import { deleteOriginals, folderOf, r2Enabled } from "../../_r2";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Review member registrations submitted from /member-reg.
   Pending rows are hidden from every database role except the service role, so this route (approved admins only)
   is the only way to see or decide them. Approve = visible on the site; reject = row and photos deleted. */
const BUCKET = "member-pictures";
const COLUMNS =
  "id, name, first_name, last_name, gender, birthday, email, student_id, program, year_level, section, hobbies, likes, about, photo_paths, registration_status, role, is_accepted, submitted_at";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;

  const { data, error } = await service!
    .schema("website")
    .from("members")
    .select(COLUMNS)
    .not("registration_status", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (error) return json({ error: "Couldn't load registrations." }, 500);

  const rows = await Promise.all(
    (data ?? []).map(async (r: Record<string, unknown>) => {
      const paths = Array.isArray(r.photo_paths) ? (r.photo_paths as string[]).slice(0, 5) : [];
      let photos: string[] = [];
      if (paths.length) {
        const { data: signed } = await service!.storage.from(BUCKET).createSignedUrls(paths, 3600);
        photos = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
      }
      return { ...r, photo_paths: undefined, photos };
    }),
  );
  return json({ registrations: rows });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { id?: unknown; action?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const id = Number(b.id);
  if (!Number.isInteger(id) || (b.action !== "approve" && b.action !== "reject")) return json({ error: "Bad request." }, 400);

  const members = service!.schema("website").from("members");
  if (b.action === "approve") {
    const { error } = await members.update({ registration_status: "approved", is_accepted: true }).eq("id", id);
    if (error) return json({ error: "Couldn't approve that registration." }, 500);
    return json({ ok: true });
  }

  const { data: row } = await service!.schema("website").from("members").select("photo_paths").eq("id", id).maybeSingle();
  const { error } = await service!.schema("website").from("members").delete().eq("id", id);
  if (error) return json({ error: "Couldn't reject that registration." }, 500);
  const paths = Array.isArray(row?.photo_paths) ? (row!.photo_paths as string[]) : [];
  if (paths.length) await service!.storage.from(BUCKET).remove(paths);
  const folder = folderOf(paths[0]);
  if (r2Enabled && folder) { try { await deleteOriginals(folder); } catch (e) { console.error("R2 delete failed:", (e as Error).message); } }
  return json({ ok: true });
}
