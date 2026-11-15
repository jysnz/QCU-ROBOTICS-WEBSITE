import { type NextRequest } from "next/server";
import { notifyUsers } from "../../_notify";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Events the admin pages report after they act. The server re-checks who is allowed to cause each one, so nobody can
   send notifications to people they have nothing to do with.
     task-assigned { taskId, userIds? }  you created the task -> its assignees are told (only the new ones when you pass userIds)
     task-done     { taskId }            you are an assignee who finished it -> the person who assigned it is told            */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const db = () => service!.schema("website");

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { event?: unknown; taskId?: unknown; userIds?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (typeof b.taskId !== "string" || !UUID.test(b.taskId)) return json({ error: "Bad request." }, 400);

  const { data: task } = await db().from("tasks").select("id, title, due_at, created_by").eq("id", b.taskId).maybeSingle();
  if (!task) return json({ error: "Not found." }, 404);
  const { data: assignees } = await db().from("task_assignees").select("user_id, status").eq("task_id", task.id);
  const people = assignees ?? [];

  if (b.event === "task-assigned") {
    if (task.created_by !== admin.userId) return json({ error: "Not allowed." }, 403);
    const wanted = Array.isArray(b.userIds) ? new Set(b.userIds.filter((x): x is string => typeof x === "string")) : null;
    const to = people.map((p) => p.user_id).filter((id) => id !== admin.userId && (!wanted || wanted.has(id)));
    const due = when(task.due_at);
    await notifyUsers(to, {
      type: "task_assigned",
      title: `New task: ${task.title}`,
      body: due ? `Due ${due}` : "You have a new task.",
      link: "/admin#tasks-todo",
      dedupe: `assigned:${task.id}`,
    });
    return json({ ok: true, notified: to.length });
  }

  if (b.event === "task-done") {
    const mine = people.find((p) => p.user_id === admin.userId);
    if (!mine || mine.status !== "done" || task.created_by === admin.userId) return json({ ok: true, notified: 0 });
    const { data: who } = await service!.from("user_accounts").select("full_name, email").eq("id", admin.userId).maybeSingle();
    const doneCount = people.filter((p) => p.status === "done").length;
    await notifyUsers([task.created_by], {
      type: "task_done",
      title: `${who?.full_name || who?.email || "Someone"} finished a task`,
      body: `${task.title} · ${doneCount}/${people.length} done`,
      link: "/admin#tasks-assign",
      dedupe: `done:${task.id}:${admin.userId}`,
    });
    return json({ ok: true, notified: 1 });
  }

  return json({ error: "Bad request." }, 400);
}
