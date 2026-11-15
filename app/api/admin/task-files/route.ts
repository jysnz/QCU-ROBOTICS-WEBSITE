import { type NextRequest } from "next/server";
import { deleteKeys, mediaReady, randomName, safeFileName, signMany, signOne } from "../../_media";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Task attachments in the private "tasks" bucket (<task id>/...). The browser never gets a bucket key:
   only short-lived signed links, and only after this route has checked that the person may use that task.
   When R2 isn't switched on, POST answers { r2: false } and the page uses Supabase Storage as before. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = /\.(png|jpe?g|gif|webp|avif|heic|heif|pdf|docx?)$/i; // pictures, PDFs and Word documents only
const TYPE_RE = /^[a-z]+\/[a-z0-9.+\-]+$/i;

const db = () => service!.schema("website");

async function isCreator(taskId: string, userId: string) {
  const { data } = await db().from("tasks").select("id").eq("id", taskId).eq("created_by", userId).maybeSingle();
  return !!data;
}
async function isAssignee(taskId: string, userId: string) {
  const { data } = await db().from("task_assignees").select("task_id").eq("task_id", taskId).eq("user_id", userId).maybeSingle();
  return !!data;
}
async function mayAssign(userId: string) {
  const { data } = await db().from("admin_roles").select("role").eq("user_id", userId).maybeSingle();
  return !!data && ["super_admin", "media_head", "media_assistant"].includes(data.role);
}

/* Upload ticket for one file of a task you created, or (submission: true) for a file you hand in as its assignee. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  if (!mediaReady) return json({ r2: false });

  let b: { taskId?: unknown; name?: unknown; type?: unknown; size?: unknown; submission?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const taskId = typeof b.taskId === "string" ? b.taskId : "";
  const name = typeof b.name === "string" ? b.name : "";
  const type = typeof b.type === "string" && TYPE_RE.test(b.type) ? b.type : "application/octet-stream";
  if (!UUID.test(taskId) || !name || !ALLOWED.test(name) || typeof b.size !== "number" || b.size <= 0 || b.size > MAX_BYTES) return json({ error: "That file can't be attached." }, 400);
  const submission = b.submission === true;
  const allowed = submission ? await isAssignee(taskId, admin.userId) : (await isCreator(taskId, admin.userId)) && (await mayAssign(admin.userId));
  if (!allowed) return json({ error: "You can't add files to that task." }, 403);

  const key = `${taskId}/${submission ? `submissions/${admin.userId}/` : ""}${randomName("bin").replace(/\.bin$/, "")}-${safeFileName(name)}`;
  try {
    return json({ r2: true, key, uploadUrl: await signOne({ bucket: "tasks", key, method: "PUT", type }) });
  } catch (e) {
    console.error("task file sign failed:", (e as Error).message);
    return json({ error: "Storage isn't available right now." }, 502);
  }
}

/* Links to view / download the R2-stored files of a task you created or were assigned. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  const taskId = req.nextUrl.searchParams.get("taskId") ?? "";
  if (!UUID.test(taskId)) return json({ error: "Bad request." }, 400);
  const mine = await isCreator(taskId, admin.userId);
  if (!mine) {
    const { data } = await db().from("task_assignees").select("task_id").eq("task_id", taskId).eq("user_id", admin.userId).maybeSingle();
    if (!data) return json({ error: "Not found." }, 404);
  }
  const { data: rows } = await db().from("task_files").select("id, path, name").eq("task_id", taskId).eq("store", "r2");
  // Submitted files: the creator sees everyone's, an assignee only their own.
  let subQuery = db().from("task_submissions").select("id, path, name").eq("task_id", taskId).eq("store", "r2");
  if (!mine) subQuery = subQuery.eq("user_id", admin.userId);
  const { data: subRows } = await subQuery;
  const files = [...(rows ?? []), ...(subRows ?? [])];
  if (!files.length) return json({ files: [] });
  try {
    const urls = await signMany(files.flatMap((f) => [
      { bucket: "tasks" as const, key: f.path, method: "GET" as const },
      { bucket: "tasks" as const, key: f.path, method: "GET" as const, filename: f.name },
    ]));
    return json({ files: files.map((f, i) => ({ id: f.id, url: urls[i * 2], dl: urls[i * 2 + 1] })) });
  } catch (e) {
    console.error("task file links failed:", (e as Error).message);
    return json({ error: "Couldn't get the files." }, 502);
  }
}

/* Deletes R2 files of a task you created (called when you remove a file, edit a task or delete it). */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { taskId?: unknown; keys?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const taskId = typeof b.taskId === "string" ? b.taskId : "";
  const keys = Array.isArray(b.keys) ? b.keys.filter((k): k is string => typeof k === "string" && k.startsWith(`${taskId}/`)) : [];
  if (!UUID.test(taskId)) return json({ error: "Not allowed." }, 403);
  // the creator may delete any file of the task; anyone else only their own submitted files
  const own = `${taskId}/submissions/${admin.userId}/`;
  if (!(await isCreator(taskId, admin.userId)) && !(keys.length > 0 && keys.every((k) => k.startsWith(own)))) return json({ error: "Not allowed." }, 403);
  if (!keys.length) return json({ ok: true });
  try { await deleteKeys("tasks", keys); } catch (e) { console.error("task file delete failed:", (e as Error).message); return json({ error: "Couldn't delete the files." }, 502); }
  return json({ ok: true });
}
