import crypto from "node:crypto";

/* Full-resolution registration photos live in a private Cloudflare R2 bucket. The R2 keys are NOT here: they are
   secrets of the Supabase Edge Function "r2-photos" (supabase/functions/r2-photos), which hands out short-lived signed
   links. This file only calls that function with the server's service-role key (never sent to a browser).
   Turn it on by deploying the function and setting R2_ORIGINALS=1 on the server. Without that, everything here is off
   and the form keeps working with the 800 px copies. */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const r2Enabled = process.env.R2_ORIGINALS === "1" && !!SUPABASE_URL && !!SERVICE;

export const ORIGINALS_PREFIX = "registrations";
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const ORIGINAL_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

async function call<T>(body: unknown): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/r2-photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`r2-photos responded ${r.status}`);
  return (await r.json()) as T;
}

/* ---------- upload ticket: proof that a registration was just saved (so no second human check is needed) ---------- */
const sig = (payload: string) => crypto.createHmac("sha256", SERVICE).update(payload).digest("base64url");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function makeTicket(folder: string, ttlMs = 30 * 60 * 1000) {
  const payload = `${folder}.${Date.now() + ttlMs}`;
  return `${payload}.${sig(payload)}`;
}
export function readTicket(ticket: unknown): string | null {
  if (typeof ticket !== "string" || ticket.length > 200 || !SERVICE) return null;
  const parts = ticket.split(".");
  if (parts.length !== 3) return null;
  const [folder, exp, s] = parts;
  const a = Buffer.from(s);
  const b = Buffer.from(sig(`${folder}.${exp}`));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!UUID.test(folder) || Number(exp) < Date.now()) return null;
  return folder;
}

export const folderOf = (photoPath: string | undefined | null) => {
  const m = /^registrations\/([0-9a-f-]{36})\//i.exec(photoPath ?? "");
  return m && UUID.test(m[1]) ? m[1] : null;
};

/* ---------- signed links, made by the edge function ---------- */
export async function presignPuts(items: { key: string; type: string }[]) {
  return (await call<{ urls: string[] }>({ action: "put", items })).urls;
}
export async function listOriginals(folder: string) {
  return (await call<{ objects: { key: string; size: number; url: string }[] }>({ action: "list", folder })).objects;
}
export async function deleteOriginals(folder: string) {
  await call({ action: "delete", folder });
}
