import { type NextRequest } from "next/server";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The two numbers shown on the admin sidebar: registrations waiting for review and accounts waiting for approval.
   Counts only (no rows, no photos), so it is cheap to ask for often. Approved admins only. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  const [regs, accounts] = await Promise.all([
    service!.schema("website").from("members").select("id", { count: "exact", head: true }).eq("registration_status", "pending"),
    service!.from("user_accounts").select("id", { count: "exact", head: true }).eq("is_approved", false).is("rejected_at", null), // archived (rejected) accounts are not waiting
  ]);
  if (regs.error || accounts.error) return json({ error: "Couldn't count what's waiting." }, 500);
  return json({ registrations: regs.count ?? 0, accounts: accounts.count ?? 0 });
}
