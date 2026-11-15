import { type NextRequest } from "next/server";
import { notifyUsers } from "../../_notify";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Admin accounts: list everyone who signed up, approve or revoke access, reject one that is still waiting, or restore a rejected one.
   Rejecting moves the account to an archive (rejected_at is set); after 30 days its login is deleted for good. Approved admins only. */
const ARCHIVE_DAYS = 30;

/* Permanently deletes accounts that have been in the archive for more than 30 days. */
async function purgeExpired() {
  const cutoff = new Date(Date.now() - ARCHIVE_DAYS * 86_400_000).toISOString();
  const { data: old } = await service!.from("user_accounts").select("id").eq("is_approved", false).not("rejected_at", "is", null).lt("rejected_at", cutoff);
  for (const row of old ?? []) {
    const { error } = await service!.auth.admin.deleteUser(row.id); // the account row goes with it
    if (error) console.error("Account purge failed:", error.message);
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  await purgeExpired().catch((e) => console.error("Account purge failed:", (e as Error).message));
  const { data, error } = await service!
    .from("user_accounts")
    .select("id, email, full_name, avatar_url, created_at, is_approved, rejected_at")
    .order("created_at", { ascending: false });
  if (error) return json({ error: "Couldn't load accounts." }, 500);
  return json({ accounts: data ?? [], me: admin.userId });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { id?: unknown; approved?: unknown; restore?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (typeof b.id !== "string") return json({ error: "Bad request." }, 400);
  if (b.restore === true) {
    // archive -> back to "waiting"
    const { error } = await service!.from("user_accounts").update({ rejected_at: null }).eq("id", b.id).eq("is_approved", false).not("rejected_at", "is", null);
    if (error) return json({ error: "Couldn't restore that account." }, 500);
    return json({ ok: true });
  }
  if (typeof b.approved !== "boolean") return json({ error: "Bad request." }, 400);
  if (b.id === admin.userId && b.approved === false) return json({ error: "You can't revoke your own access." }, 400);
  const { error } = await service!.from("user_accounts").update({ is_approved: b.approved, rejected_at: null }).eq("id", b.id);
  if (error) return json({ error: "Couldn't update that account." }, 500);
  if (b.approved) {
    // the person is told they can come in (shows on their bell the first time they open the admin, and as a push if they had it on)
    await notifyUsers([b.id], { type: "account_approved", title: "Your account was approved", body: "You can now use the QCU Robotics admin area.", link: "/admin", dedupe: `approved:${b.id}` });
  }
  return json({ ok: true });
}

/* Reject an account that is still waiting: it moves to the archive (it can be restored for 30 days) and can't use the admin area.
   Approved accounts are never rejected here; use "Revoke access" for those. */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { id?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (typeof b.id !== "string") return json({ error: "Bad request." }, 400);
  if (b.id === admin.userId) return json({ error: "You can't reject your own account." }, 400);
  const { data: acct } = await service!.from("user_accounts").select("id, is_approved").eq("id", b.id).maybeSingle();
  if (!acct) return json({ error: "That account no longer exists." }, 404);
  if (acct.is_approved) return json({ error: "Only accounts that are waiting can be rejected. Use Revoke access for approved ones." }, 400);
  const { data: role } = await service!.schema("website").from("admin_roles").select("role").eq("user_id", b.id).maybeSingle();
  if (role) return json({ error: "That account holds an admin role." }, 400);
  const at = new Date().toISOString();
  const { error } = await service!.from("user_accounts").update({ rejected_at: at }).eq("id", b.id);
  if (error) return json({ error: "Couldn't reject that account." }, 500);
  // the key has the time in it, so a restored-then-rejected-again account is told again
  await notifyUsers([b.id], { type: "account_rejected", title: "Your access request wasn't approved", body: "An admin declined your request to use the QCU Robotics admin area.", link: "/admin", dedupe: `rejected:${b.id}:${at}` });
  return json({ ok: true });
}
