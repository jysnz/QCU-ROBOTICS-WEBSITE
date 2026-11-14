import crypto from "node:crypto";

/* Server side of the Cloudflare R2 media storage. The R2 keys live only in the Supabase edge function "r2-media"
   (supabase/functions/r2-media); this file calls it with the service-role key and never sees them.

   Buckets: memberpictures (registration photos) and tasks (task attachments), both kept private and read through signed
   links; otherphotos (public: every other picture, one folder per kind); matches (public: match videos and thumbnails).

   It is switched on with R2_MEDIA=1 on the server AND the public address of the otherphotos bucket
   (NEXT_PUBLIC_R2_URL_OTHERPHOTOS). Until then every upload keeps going to Supabase Storage, so nothing breaks. */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type Bucket = "memberpictures" | "tasks" | "otherphotos" | "matches";

const PUBLIC_BASE: Record<Bucket, string> = {
  memberpictures: "",
  tasks: "",
  otherphotos: process.env.NEXT_PUBLIC_R2_URL_OTHERPHOTOS || "",
  matches: process.env.NEXT_PUBLIC_R2_URL_MATCHES || "",
};

export const mediaReady = process.env.R2_MEDIA === "1" && !!SUPABASE_URL && !!SERVICE && !!PUBLIC_BASE.otherphotos;

/** The public link of a file in a public bucket. */
export function publicUrl(bucket: "otherphotos" | "matches", key: string) {
  return `${PUBLIC_BASE[bucket].replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function call<T>(body: unknown): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/r2-media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`r2-media responded ${r.status}`);
  return (await r.json()) as T;
}

export type SignItem = { bucket: Bucket; key: string; method: "PUT" | "GET"; type?: string; filename?: string; expires?: number };

/** Short-lived signed links, one per item (same order). Big lists are sent in batches. */
export async function signMany(items: SignItem[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < items.length; i += 500) {
    out.push(...(await call<{ urls: string[] }>({ action: "sign", items: items.slice(i, i + 500) })).urls);
  }
  return out;
}
export const signOne = async (item: SignItem) => (await signMany([item]))[0];

export async function deleteKeys(bucket: Bucket, keys: string[]) {
  for (let i = 0; i < keys.length; i += 500) await call({ action: "delete", bucket, keys: keys.slice(i, i + 500) });
}
/** Every file key under a folder of the "matches" bucket (the folder must end with "/"). */
export async function listMatchKeys(prefix: string) {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const r = await call<{ keys: { key: string }[]; next?: string }>({ action: "list", bucket: "matches", prefix, token });
    keys.push(...r.keys.map((k) => k.key));
    token = r.next;
  } while (token);
  return keys;
}
export async function copyKey(from: { bucket: Bucket; key: string }, to: { bucket: Bucket; key: string }) {
  await call({ action: "copy", from, to });
}

/** Uploads bytes from the server itself (used for the registration photos). */
export async function putBytes(bucket: Bucket, key: string, bytes: Buffer, type: string) {
  const url = await signOne({ bucket, key, method: "PUT", type });
  const r = await fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`R2 upload responded ${r.status}`);
}

export const randomName = (ext: string) => `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
export const safeFileName = (n: string) => n.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/^[-.]+/, "").slice(-120) || "file";
