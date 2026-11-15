import { type NextRequest } from "next/server";
import { json, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Asked by the /admin login right after someone signs in. Continuing with Google creates an account on the spot. When that
   account is brand new (made in the last few minutes, Google only, no password, never approved, no admin role) the person has
   not set up an account yet, so it is removed again and the login page sends them to the Create Account tab instead.
   Anything older or approved is never touched. Only the caller's own account can be affected. */
const FRESH_MS = 3 * 60_000;

export async function POST(req: NextRequest) {
  if (!service) return json({ error: "The admin area isn't configured yet." }, 503);
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "")?.[1];
  if (!token) return json({ error: "Please sign in." }, 401);
  const { data, error } = await service.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return json({ error: "Please sign in again." }, 401);

  const providers = ((user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string]).filter(Boolean);
  const googleOnly = providers.length > 0 && providers.every((p) => p === "google");
  const fresh = Date.now() - new Date(user.created_at).getTime() < FRESH_MS;
  if (!googleOnly || !fresh) return json({ removed: false });

  const [{ data: acct }, { data: role }] = await Promise.all([
    service.from("user_accounts").select("is_approved, rejected_at, has_password").eq("id", user.id).maybeSingle(),
    service.schema("website").from("admin_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);
  if (role || acct?.is_approved || acct?.rejected_at || acct?.has_password) return json({ removed: false });

  await service.from("user_accounts").delete().eq("id", user.id);
  const { error: delError } = await service.auth.admin.deleteUser(user.id);
  if (delError) return json({ removed: false });
  return json({ removed: true, email: user.email ?? "", name: String(user.user_metadata?.full_name || user.user_metadata?.name || "") });
}
