import { type NextRequest } from "next/server";
import { isRegistered, json, service } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Asked by the /admin login right after someone signs in: has this email been used to register at /member-reg?
   Any signed-in account may ask (even one that isn't approved yet) but only about itself, and it only gets a yes or no. */
export async function GET(req: NextRequest) {
  if (!service) return json({ error: "The admin area isn't configured yet." }, 503);
  const token = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "")?.[1];
  if (!token) return json({ error: "Please sign in." }, 401);
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) return json({ error: "Please sign in again." }, 401);
  return json({ registered: await isRegistered(data.user.id, data.user.email ?? "") });
}
