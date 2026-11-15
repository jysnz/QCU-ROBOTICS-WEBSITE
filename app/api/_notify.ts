import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@supabase/supabase-js";

/* Server-side notifications for the admin area.
   notifyUsers() does two things for each person: it saves the notification (shown in the bell panel, with a "read" state)
   and, when Firebase is set up, pushes it to every device they turned notifications on for (FCM).
   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FIREBASE_SERVICE_ACCOUNT (the service-account JSON, or the same JSON base64-encoded).
   Without the Firebase variable the in-app panel still works; only the push part is skipped. */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const db = SERVICE_KEY && SUPABASE_URL
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export type Notice = {
  type: string;
  title: string;
  body?: string;
  /** Where clicking it goes, e.g. "/admin#tasks-todo". */
  link?: string;
  /** Same key + same person = notified only once (e.g. `due:<task id>`). */
  dedupe?: string;
};

function firebaseApp(): App | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  if (getApps().length) return getApp();
  try {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const acct = JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
    return initializeApp({ credential: cert({ projectId: acct.project_id, clientEmail: acct.client_email, privateKey: acct.private_key.replace(/\\n/g, "\n") }) });
  } catch (e) {
    console.error("Firebase service account is invalid:", (e as Error).message);
    return null;
  }
}

export const pushConfigured = () => !!process.env.FIREBASE_SERVICE_ACCOUNT;

/** Everyone who may use the admin area (approved accounts). */
export async function approvedAccountIds(): Promise<string[]> {
  if (!db) return [];
  const { data } = await db.from("user_accounts").select("id").eq("is_approved", true);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Saves the notification for each person, then pushes it to their devices. Never throws: a failed notification must not break the action that caused it. */
export async function notifyUsers(userIds: string[], n: Notice): Promise<void> {
  try {
    if (!db) return;
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return;

    const rows = ids.map((user_id) => ({ user_id, type: n.type, title: n.title.slice(0, 200), body: n.body?.slice(0, 500) ?? null, link: n.link ?? null, dedupe_key: n.dedupe ?? null }));
    // ignoreDuplicates: people who already got this exact event are skipped, and only the newly saved rows come back
    const { data: saved, error } = await db.from("notifications").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("user_id");
    if (error) { console.error("Saving notifications failed:", error.message); return; }
    const fresh = [...new Set((saved ?? []).map((r: { user_id: string }) => r.user_id))];
    if (fresh.length) await push(fresh, n);
  } catch (e) {
    console.error("notifyUsers failed:", (e as Error).message);
  }
}

export type PushResult = { configured: boolean; devices: number; sent: number; failed: number; errors: string[] };

async function push(userIds: string[], n: Notice): Promise<PushResult> {
  const out: PushResult = { configured: false, devices: 0, sent: 0, failed: 0, errors: [] };
  const app = firebaseApp();
  if (!app || !db) { console.warn("Push skipped: FIREBASE_SERVICE_ACCOUNT is missing or invalid"); return out; }
  out.configured = true;
  const { data: tokenRows } = await db.from("push_tokens").select("token").in("user_id", userIds);
  const tokens = [...new Set((tokenRows ?? []).map((r: { token: string }) => r.token))];
  out.devices = tokens.length;
  if (!tokens.length) { console.info(`Push: none of the ${userIds.length} people have a device with notifications on`); return out; }

  const messaging = getMessaging(app);
  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      // data-only, so the page's service worker decides how it is shown (and a message isn't shown twice)
      data: { title: n.title, body: n.body ?? "", link: n.link ?? "/admin", type: n.type },
      webpush: { headers: { Urgency: "high", TTL: "86400" } },
    });
    res.responses.forEach((r, j) => {
      if (r.success) { out.sent++; return; }
      out.failed++;
      const code = r.error?.code ?? "unknown";
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token" || code === "messaging/invalid-argument") dead.push(chunk[j]);
      else { out.errors.push(`${code}: ${r.error?.message ?? ""}`.slice(0, 300)); console.error("Push failed:", code, r.error?.message); }
    });
  }
  if (dead.length) await db.from("push_tokens").delete().in("token", dead); // devices that uninstalled / cleared the site
  console.info(`Push "${n.type}": ${out.sent} sent, ${out.failed} failed, ${out.devices} devices`);
  return out;
}

/** Sends a one-off test push to one person's devices (no saved notification, no dedupe) and reports exactly what happened. */
export async function sendTestPush(userId: string): Promise<PushResult> {
  try {
    return await push([userId], { type: "test", title: "Test notification", body: "Notifications are working on this device.", link: "/admin" });
  } catch (e) {
    return { configured: true, devices: 0, sent: 0, failed: 1, errors: [(e as Error).message.slice(0, 300)] };
  }
}
