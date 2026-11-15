import { type NextRequest } from "next/server";
import { json, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* A browser/device turns push notifications on (POST) or off (DELETE). The token is Firebase's address for that device.
   Any signed-in account may do this for itself, including one that is still waiting for approval or was declined, so it can
   hear about the decision. Notifications are only ever sent to the account they are addressed to. */
async function me(req: NextRequest): Promise<string | null> {
  if (!service) return null;
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "")?.[1];
  if (!token) return null;
  const { data, error } = await service.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}
const TOKEN = /^[\w\-:.]{20,4096}$/;

export async function POST(req: NextRequest) {
  const uid = await me(req);
  if (!uid) return json({ error: "Please sign in." }, 401);
  let b: { token?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (typeof b.token !== "string" || !TOKEN.test(b.token)) return json({ error: "Bad request." }, 400);
  const { error } = await service!.from("push_tokens").upsert(
    { user_id: uid, token: b.token, user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300), last_seen_at: new Date().toISOString() },
    { onConflict: "token" }, // a device that switches accounts moves to the new one
  );
  if (error) return json({ error: "Couldn't turn notifications on." }, 500);
  return json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const uid = await me(req);
  if (!uid) return json({ error: "Please sign in." }, 401);
  let b: { token?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (typeof b.token !== "string") return json({ error: "Bad request." }, 400);
  await service!.from("push_tokens").delete().eq("token", b.token).eq("user_id", uid);
  return json({ ok: true });
}
