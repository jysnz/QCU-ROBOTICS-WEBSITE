import { type NextRequest } from "next/server";
import { approvedAccountIds, notifyUsers } from "../../_notify";
import { json, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Called by the "waiting for approval" screen: someone has signed in and is asking for admin access, so every approved admin is told.
   The caller is only identified by their own sign-in (they aren't approved yet), can only ask for themselves, and the
   same account never notifies twice. */
export async function POST(req: NextRequest) {
  if (!service) return json({ error: "The admin area isn't configured yet." }, 503);
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "")?.[1];
  if (!token) return json({ error: "Please sign in." }, 401);
  const { data: u, error } = await service.auth.getUser(token);
  if (error || !u.user) return json({ error: "Please sign in again." }, 401);

  const { data: acct } = await service.from("user_accounts").select("is_approved, rejected_at, full_name, email").eq("id", u.user.id).maybeSingle();
  if (!acct || acct.is_approved || acct.rejected_at) return json({ ok: true, notified: 0 }); // only a genuine request, still waiting

  const admins = await approvedAccountIds();
  await notifyUsers(admins, {
    type: "access_request",
    title: "New access request",
    body: `${acct.full_name || acct.email} is waiting for approval.`,
    link: "/admin#accounts",
    dedupe: `access:${u.user.id}`,
  });
  return json({ ok: true, notified: admins.length });
}
