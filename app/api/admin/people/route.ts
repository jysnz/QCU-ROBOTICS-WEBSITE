import { type NextRequest } from "next/server";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Approved teammates a task can be assigned to (names only, no approval/signup details). Approved admins only. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  const { data, error } = await service!
    .from("user_accounts")
    .select("id, email, full_name, avatar_url")
    .eq("is_approved", true)
    .order("full_name", { ascending: true });
  if (error) return json({ error: "Couldn't load teammates." }, 500);
  return json({ people: data ?? [], me: admin.userId });
}
