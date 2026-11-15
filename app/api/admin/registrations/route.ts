import { type NextRequest } from "next/server";
import { deleteOriginals, folderOf, r2Enabled } from "../../_r2";
import { copyKey, deleteKeys, mediaReady, publicUrl, signMany } from "../../_media";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Review member registrations submitted from /member-reg.
   Pending rows are hidden from every database role except the service role, so this route (approved admins only)
   is the only way to see or decide them. Approve = visible on the site; reject = moved to the archive for 30 days, then deleted with its photos. */
const BUCKET = "member-pictures";
const COLUMNS =
  "id, name, first_name, last_name, gender, birthday, email, phone, student_id, program, year_level, section, hobbies, likes, about, photo_paths, registration_status, role, roles, is_accepted, submitted_at, photo_store, rejected_at";
const ARCHIVE_DAYS = 30;
const ROLES = ["member", "media", "player"];
const ROLE_PRIORITY = ["player", "media", "member"]; // which one counts as the person's main role (the `role` column), as on the sign-up form

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;

  await purgeExpired().catch((e) => console.error("Archive purge failed:", (e as Error).message));
  await syncMediaTeam().catch((e) => console.error("Media team sync failed:", (e as Error).message)); // also catches people approved before this existed

  const { data, error } = await service!
    .schema("website")
    .from("members")
    .select(COLUMNS)
    .not("registration_status", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (error) return json({ error: "Couldn't load registrations." }, 500);

  // Photos stored in Cloudflare R2 are signed in one batch; older ones in Supabase Storage as before.
  const r2Rows = (data ?? []).filter((r: Record<string, unknown>) => r.photo_store === "r2");
  const r2Items = r2Rows.flatMap((r: Record<string, unknown>) => (Array.isArray(r.photo_paths) ? (r.photo_paths as string[]).slice(0, 5) : []).map((key) => ({ bucket: "memberpictures" as const, key, method: "GET" as const })));
  let r2Urls: string[] = [];
  if (r2Items.length) {
    try { r2Urls = await signMany(r2Items); } catch (e) { console.error("R2 sign failed:", (e as Error).message); }
  }
  let cursor = 0;
  const r2Photos = new Map<unknown, string[]>();
  for (const r of r2Rows as Record<string, unknown>[]) {
    const n = Array.isArray(r.photo_paths) ? Math.min((r.photo_paths as string[]).length, 5) : 0;
    r2Photos.set(r.id, r2Urls.slice(cursor, cursor + n).filter(Boolean));
    cursor += n;
  }

  const rows = await Promise.all(
    (data ?? []).map(async (r: Record<string, unknown>) => {
      if (r.photo_store === "r2") return { ...r, photo_paths: undefined, photos: r2Photos.get(r.id) ?? [] };
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
  let b: { id?: unknown; action?: unknown; roles?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const id = Number(b.id);
  if (!Number.isInteger(id) || (b.action !== "approve" && b.action !== "reject" && b.action !== "restore" && b.action !== "roles")) return json({ error: "Bad request." }, 400);

  const members = service!.schema("website").from("members");

  // Change what a person is registered as (Member, Media team, Player: one or more). `role` stays the main one, same priority as the sign-up form.
  if (b.action === "roles") {
    const picked = Array.isArray(b.roles) ? b.roles.filter((x): x is string => typeof x === "string") : [];
    if (!picked.length || picked.some((x) => !ROLES.includes(x))) return json({ error: "Choose at least one: Member, Media team or Player." }, 400);
    const roles = ROLE_PRIORITY.filter((r) => picked.includes(r));
    const { data: updated, error } = await members.update({ role: roles[0], roles }).eq("id", id).in("registration_status", ["pending", "approved"]).select("id, registration_status").maybeSingle();
    if (error) return json({ error: "Couldn't change the roles." }, 500);
    if (!updated) return json({ error: "That registration can't be edited any more." }, 404);
    if (updated.registration_status === "approved") await syncMediaTeam().catch((e) => console.error("Media team sync failed:", (e as Error).message));
    return json({ ok: true, role: roles[0], roles });
  }
  if (b.action === "approve") {
    // The site shows image_url on its portrait cards. A new sign-up saves a tiny 192 px preview there, which looks
    // blurry once it goes live, so approving swaps in the 800 px profile photo (the first of the person's photos).
    const { data: row } = await service!.schema("website").from("members").select("photo_paths, photo_store").eq("id", id).maybeSingle();
    const first = Array.isArray(row?.photo_paths) ? (row!.photo_paths as string[])[0] : null;
    const update: Record<string, unknown> = { registration_status: "approved", is_accepted: true };
    if (first && row?.photo_store === "r2") {
      // Publish the profile photo: copy it from the private bucket into the public "otherphotos/members" folder.
      if (!mediaReady) return json({ error: "Cloudflare R2 isn't fully set up (R2_MEDIA and the otherphotos public URL), so the photo can't be published yet." }, 503);
      const key = `members/${(first.split("/")[1] ?? crypto.randomUUID())}-${Date.now()}.${first.split(".").pop() === "png" ? "png" : "jpg"}`;
      try {
        await copyKey({ bucket: "memberpictures", key: first }, { bucket: "otherphotos", key });
      } catch (e) {
        console.error("R2 publish failed:", (e as Error).message);
        return json({ error: "Couldn't publish the photo. Please try again." }, 502);
      }
      update.image_url = publicUrl("otherphotos", key);
    } else if (first) {
      update.image_url = service!.storage.from(BUCKET).getPublicUrl(first).data.publicUrl;
    }
    const { error } = await members.update(update).eq("id", id);
    if (error) return json({ error: "Couldn't approve that registration." }, 500);
    await syncMediaTeam().catch((e) => console.error("Media team sync failed:", (e as Error).message));
    return json({ ok: true });
  }

  if (b.action === "restore") {
    const { error } = await members.update({ registration_status: "pending", is_accepted: false, rejected_at: null }).eq("id", id).eq("registration_status", "rejected");
    if (error) return json({ error: "Couldn't restore that registration." }, 500);
    return json({ ok: true });
  }

  // Reject = move to the archive. Photos stay until the 30 days are up (purgeExpired).
  const { error } = await members.update({ registration_status: "rejected", is_accepted: false, rejected_at: new Date().toISOString() }).eq("id", id).eq("registration_status", "pending");
  if (error) return json({ error: "Couldn't reject that registration." }, 500);
  return json({ ok: true });
}

/* The Media team page (and the Media team section of the site) lists website.media_team, which has nothing to do with the registration
   form. Someone who registered as Media and was approved is therefore added there too, once: matched by name, so it is safe to run
   again and never duplicates, and a person an admin already added by hand is left alone. People who are later removed from the
   Media team page by an admin come back only if their registration is approved again. */
async function syncMediaTeam() {
  const db = service!.schema("website");
  const { data: approved, error } = await db.from("members").select("id, name, image_url, role, roles").eq("registration_status", "approved");
  if (error) throw new Error(error.message);
  const media = (approved ?? []).filter((m) => m.name && (m.role === "media" || (Array.isArray(m.roles) && m.roles.includes("media"))));
  if (!media.length) return;
  const { data: existing, error: e2 } = await db.from("media_team").select("name");
  if (e2) throw new Error(e2.message);
  const have = new Set((existing ?? []).map((r) => String(r.name ?? "").trim().toLowerCase()));
  const add = media.filter((m) => !have.has(String(m.name).trim().toLowerCase())).map((m) => ({ name: String(m.name).trim(), image_url: m.image_url ?? null, is_active: true }));
  if (add.length) {
    const { error: e3 } = await db.from("media_team").insert(add);
    if (e3) throw new Error(e3.message);
  }
}

/* Permanently deletes rejected registrations that have been in the archive for more than 30 days, with their photos. */
async function purgeExpired() {
  const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 86_400_000).toISOString();
  const { data: old } = await service!.schema("website").from("members").select("id, photo_paths, photo_store").eq("registration_status", "rejected").lt("rejected_at", cutoff);
  for (const row of old ?? []) {
    const paths = Array.isArray(row.photo_paths) ? (row.photo_paths as string[]) : [];
    try {
      if (paths.length) {
        if (row.photo_store === "r2") await deleteKeys("memberpictures", paths);
        else await service!.storage.from(BUCKET).remove(paths);
      }
      const folder = folderOf(paths[0]);
      if (r2Enabled && folder) await deleteOriginals(folder);
    } catch (e) { console.error("Archive photo purge failed:", (e as Error).message); continue; } // keep the row so the purge retries next time
    await service!.schema("website").from("members").delete().eq("id", row.id);
    await service!.from("notifications").delete().eq("dedupe_key", `reg:${row.id}`); // the bell must not keep pointing at a registration that no longer exists
  }
}
