import { type NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { json, requireAdmin, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Approved teammates a task can be assigned to (names only, no approval/signup details). Approved admins only.
   `mediaIds` lists the accounts that belong to the Media team: Media-role members have no login of their own,
   so an account counts as media when its email matches the email a Media member registered with. */
/* The two lookups are shared by every admin and change rarely, so they sit in the server cache for a minute
   (and are dropped at once when the database webhook reports a change to user_accounts or members). Errors are not cached. */
const loadAccounts = unstable_cache(async () => {
  const { data, error } = await service!
    .from("user_accounts")
    .select("id, email, full_name, avatar_url")
    .eq("is_approved", true)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}, ["admin-people-accounts"], { tags: ["user_accounts"], revalidate: 60 });

const loadMedia = unstable_cache(async () => {
  const { data } = await service!
    .schema("website")
    .from("members")
    .select("email, role, roles, registration_status")
    .not("email", "is", null);
  return data ?? [];
}, ["admin-people-media"], { tags: ["members"], revalidate: 60 });

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  let data: Awaited<ReturnType<typeof loadAccounts>>;
  try { data = await loadAccounts(); } catch { return json({ error: "Couldn't load teammates." }, 500); }
  const media = await loadMedia();
  const mediaEmails = new Set(
    (media ?? [])
      .filter((m: { role: string | null; roles: string[] | null; registration_status: string | null }) =>
        (m.role === "media" || (m.roles ?? []).includes("media")) && m.registration_status !== "pending" && m.registration_status !== "rejected")
      .map((m: { email: string | null }) => (m.email ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const mediaIds = (data ?? []).filter((p: { email: string }) => mediaEmails.has((p.email ?? "").trim().toLowerCase())).map((p: { id: string }) => p.id);

  return json({ people: data ?? [], me: admin.userId, mediaIds });
}
