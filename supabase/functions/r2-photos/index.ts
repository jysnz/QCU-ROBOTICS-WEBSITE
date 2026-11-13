// Supabase Edge Function: r2-photos
//
// The ONLY place that holds the Cloudflare R2 keys. The website's server calls it (with the service-role key) to get
// short-lived signed links for the original, full-resolution registration photos in the private "memberpictures"
// bucket. The browser never sees an R2 key, and neither does the website's own server.
//
// Secrets (set once, they live in Supabase, not in the website):
//   supabase secrets set R2_ACCOUNT_ID=... R2_BUCKET=memberpictures R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=...
// Deploy:
//   supabase functions deploy r2-photos --project-ref szbtmeyoctkscwjcdrvg
//
// Actions (POST JSON):
//   { action: "put",    items: [{ key, type }] }  -> { urls: string[] }   signed upload links, valid 10 minutes
//   { action: "list",   folder }                  -> { objects: [{ key, size, url }] }  signed download links, valid 1 hour
//   { action: "delete", folder }                  -> { ok: true }
import { AwsClient } from "npm:aws4fetch@1.0.20";

const env = (k: string) => Deno.env.get(k) ?? "";
const ACCOUNT = env("R2_ACCOUNT_ID");
const BUCKET = env("R2_BUCKET");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY"); // injected by Supabase

const r2 = new AwsClient({ accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto" });
const BASE = `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}`;

const KEY_RE = /^registrations\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/orig-[1-5]\.(jpg|png|webp|heic|heif)$/i;
const FOLDER_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const objectUrl = (key: string) => new URL(`${BASE}/${key.split("/").map(encodeURIComponent).join("/")}`);

async function presign(method: "PUT" | "GET", key: string, expires: number, headers?: Record<string, string>) {
  const url = objectUrl(key);
  url.searchParams.set("X-Amz-Expires", String(expires));
  const signed = await r2.sign(new Request(url, { method, headers }), { aws: { signQuery: true } });
  return signed.url;
}

const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function list(folder: string) {
  const u = new URL(BASE);
  u.searchParams.set("list-type", "2");
  u.searchParams.set("prefix", `registrations/${folder}/orig-`);
  const res = await r2.fetch(u);
  if (!res.ok) throw new Error(`R2 list ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)]
    .map((m) => ({ key: unxml(m[1]), size: Number(m[2]) }))
    .filter((o) => KEY_RE.test(o.key))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

// "Verify JWT" must stay ON for this function: the gateway checks the token's signature, and here we then require that
// it is a service-role token (the injected key can be in a newer format than the key the website holds, so we check the
// token's role instead of comparing strings).
function isServiceRole(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (SERVICE_KEY && token === SERVICE_KEY) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  // Only the website's server (service-role key) may call this. The browser and the anon key are refused.
  if (!isServiceRole(req)) return json({ error: "Unauthorized" }, 401);
  if (!ACCOUNT || !BUCKET || !env("R2_ACCESS_KEY_ID") || !env("R2_SECRET_ACCESS_KEY")) return json({ error: "R2 is not configured" }, 503);

  let b: { action?: string; items?: { key?: unknown; type?: unknown }[]; folder?: unknown };
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  try {
    if (b.action === "put") {
      const items = Array.isArray(b.items) ? b.items.slice(0, 5) : [];
      if (!items.length) return json({ error: "No items" }, 400);
      const urls: string[] = [];
      for (const it of items) {
        if (typeof it.key !== "string" || !KEY_RE.test(it.key) || typeof it.type !== "string" || !TYPES.has(it.type)) return json({ error: "Invalid item" }, 400);
        urls.push(await presign("PUT", it.key, 600, { "Content-Type": it.type })); // note: R2 does not enforce the type or size through the link; the safeguards are the exact key, 10-minute expiry and the ticket
      }
      return json({ urls });
    }

    if (b.action === "list" || b.action === "delete") {
      if (typeof b.folder !== "string" || !FOLDER_RE.test(b.folder)) return json({ error: "Invalid folder" }, 400);
      const objects = await list(b.folder);
      if (b.action === "delete") {
        await Promise.all(objects.map((o) => r2.fetch(objectUrl(o.key), { method: "DELETE" })));
        return json({ ok: true });
      }
      return json({ objects: await Promise.all(objects.map(async (o) => ({ ...o, url: await presign("GET", o.key, 3600) }))) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("r2-photos failed:", (e as Error).message);
    return json({ error: "Storage request failed" }, 502);
  }
});
