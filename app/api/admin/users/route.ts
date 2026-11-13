import { type NextRequest } from "next/server";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Admin accounts: list everyone who signed up, approve or revoke access. Approved admins only. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  const { data, error } = await service!
    .from("user_accounts")
    .select("id, email, full_name, avatar_url, created_at, is_approved")
    .order("created_at", { ascending: false });
  if (error) return json({ error: "Couldn't load accounts." }, 500);
  return json({ accounts: data ?? [], me: admin.userId });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { id?: unknown; approved?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (typeof b.id !== "string" || typeof b.approved !== "boolean") return json({ error: "Bad request." }, 400);
  if (b.id === admin.userId && b.approved === false) return json({ error: "You can't revoke your own access." }, 400);
  const { error } = await service!.from("user_accounts").update({ is_approved: b.approved }).eq("id", b.id);
  if (error) return json({ error: "Couldn't update that account." }, 500);
  return json({ ok: true });
}
