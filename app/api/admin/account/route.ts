import { type NextRequest } from "next/server";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The signed-in admin's own account: read it (GET) and change their name (PATCH). */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  const [{ data: acct }, { data: u }, { data: role }] = await Promise.all([
    service!.from("user_accounts").select("id, email, full_name, avatar_url, created_at, has_password").eq("id", admin.userId).maybeSingle(),
    service!.auth.admin.getUserById(admin.userId),
    service!.schema("website").from("admin_roles").select("role").eq("user_id", admin.userId).maybeSingle(),
  ]);
  const providers = (u?.user?.identities ?? []).map((i) => i.provider);
  return json({
    account: { ...acct, email: acct?.email || admin.email },
    providers,
    // a Google-only account that later set a password has no "email" identity, so our own flag is the record
    hasPassword: providers.includes("email") || acct?.has_password === true,
    role: role?.role ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let b: { full_name?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  const name = typeof b.full_name === "string" ? b.full_name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 80) return json({ error: "Enter your full name (2 to 80 characters)." }, 400);
  const { error } = await service!.from("user_accounts").update({ full_name: name }).eq("id", admin.userId);
  if (error) return json({ error: "Couldn't save your name." }, 500);
  await service!.auth.admin.updateUserById(admin.userId, { user_metadata: { full_name: name } });
  return json({ ok: true, full_name: name });
}
