import { type NextRequest } from "next/server";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Everyone who can be named media head or assistant, for the Assign page. Only the super admin, the media head and assistants can ask.
   It is the union of
     - admin accounts (anyone who hasn't been rejected), and
     - everyone who registered at /member-reg (a rejected registration doesn't count),
   joined by email. A registered person who hasn't made an account yet comes back with `accountId: null`: naming them saves a
   pending role against their email, and it is handed over the moment they create an account with that email.
   Registration details are private, so this goes through the server (the browser can't read website.members' email). */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;

  const { data: role } = await service!.schema("website").from("admin_roles").select("role").eq("user_id", admin.userId).maybeSingle();
  if (!role || !["super_admin", "media_head", "media_assistant"].includes(role.role)) return json({ error: "Only people who assign tasks can see this." }, 403);

  const [accounts, members] = await Promise.all([
    service!.from("user_accounts").select("id, email, full_name, avatar_url, is_approved").is("rejected_at", null).limit(1000),
    service!.schema("website").from("members").select("name, email, image_url, registration_status").not("email", "is", null).or("registration_status.is.null,registration_status.neq.rejected").limit(2000),
  ]);
  if (accounts.error || members.error) return json({ error: "Couldn't load the list." }, 500);

  type Row = { email: string; name: string; avatar_url: string | null; accountId: string | null; approved: boolean; registered: boolean };
  const byEmail = new Map<string, Row>();
  for (const a of accounts.data ?? []) {
    const email = (a.email ?? "").trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, { email, name: a.full_name || a.email, avatar_url: a.avatar_url ?? null, accountId: a.id, approved: !!a.is_approved, registered: false });
  }
  for (const m of members.data ?? []) {
    const email = (m.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const cur = byEmail.get(email);
    if (cur) { cur.registered = true; continue; }
    byEmail.set(email, { email, name: m.name || email, avatar_url: m.image_url ?? null, accountId: null, approved: false, registered: true });
  }
  const people = [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return json({ people, me: admin.userId });
}
