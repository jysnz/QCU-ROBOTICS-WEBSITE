import { type NextRequest } from "next/server";
import { sendTestPush } from "../../_notify";
import { json, requireAdmin } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* "Send a test notification" button in the notification panel: pushes to your own devices only and says what happened,
   so a problem (no device saved, Firebase not set up, Firebase refusing the message) can be seen instead of guessed. */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin.ok) return admin.res;
  return json(await sendTestPush(admin.userId));
}
